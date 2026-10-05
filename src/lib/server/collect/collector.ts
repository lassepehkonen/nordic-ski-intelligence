import type { RawResponse, SourceConfig, SourceId, StageResult } from './types.js';

export interface CollectOptions {
	readonly now?: () => Date;
	readonly sleep?: (ms: number) => Promise<void>;
}

export interface HttpCollectorDeps {
	readonly fetchImpl?: typeof fetch;
	readonly now?: () => Date;
	readonly sleep?: (ms: number) => Promise<void>;
}

interface CacheState {
	readonly data: RawResponse;
	readonly fetchedAtMs: number;
	readonly etag?: string;
}

export interface CollectedResponse extends RawResponse {
	readonly attempts: number;
	readonly cacheHit: boolean;
	readonly stale: boolean;
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

function computeBackoff(policy: SourceConfig['retry'], attempt: number): number {
	const exp = Math.min(policy.capMs, policy.baseMs * 2 ** (attempt - 1));
	const jitter = exp * policy.jitterRatio;
	return Math.max(0, exp + jitter);
}

interface RateBucket {
	readonly timestamps: number[];
}

export function createHttpCollector(deps: HttpCollectorDeps = {}) {
	const fetchImpl: typeof fetch = deps.fetchImpl ?? globalThis.fetch;
	const now: () => Date = deps.now ?? (() => new Date());
	const sleeper: (ms: number) => Promise<void> = deps.sleep ?? sleep;

	const cache = new Map<string, CacheState>();
	const rateLimits = new Map<SourceId, RateBucket>();

	function cacheKey(source: SourceConfig): string {
		return `${source.sourceId}::${source.endpoint}`;
	}

	function withinRateLimit(source: SourceConfig): boolean {
		const bucket = rateLimits.get(source.sourceId) ?? { timestamps: [] };
		const windowStart = now().getTime() - source.rateLimit.windowMs;
		const recent = bucket.timestamps.filter((t) => t >= windowStart);
		if (recent.length >= source.rateLimit.requestsPerWindow) {
			rateLimits.set(source.sourceId, { timestamps: recent });
			return false;
		}
		recent.push(now().getTime());
		rateLimits.set(source.sourceId, { timestamps: recent });
		return true;
	}

	async function attemptFetch(source: SourceConfig, localNow: () => Date): Promise<RawResponse> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), source.requestTimeoutMs);
		const start = localNow().getTime();
		try {
			const response = await fetchImpl(source.endpoint, {
				method: 'GET',
				headers: { accept: 'application/json' },
				signal: controller.signal
			});
			const body = await response.text();
			const headers: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				headers[key] = value;
			});
			return {
				body,
				headers,
				status: response.status,
				fetchedAt: localNow().toISOString(),
				durationMs: localNow().getTime() - start,
				sourceId: source.sourceId,
				endpoint: source.endpoint,
				bytes: body.length
			};
		} finally {
			clearTimeout(timeout);
		}
	}

	function isTransient(error: unknown): boolean {
		if (error instanceof Error) {
			if (error.name === 'AbortError') return true;
			if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(error.message)) {
				return true;
			}
		}
		return false;
	}

	async function collect(
		source: SourceConfig,
		options: CollectOptions = {}
	): Promise<StageResult<CollectedResponse>> {
		const localNow = options.now ?? now;

		const key = cacheKey(source);
		const cached = cache.get(key);
		if (cached) {
			const ageMs = localNow().getTime() - cached.fetchedAtMs;
			const fresh = ageMs <= source.cacheTtlMs;
			if (fresh) {
				return {
					ok: true,
					data: { ...cached.data, attempts: 0, cacheHit: true, stale: false },
					errors: [],
					warnings: []
				};
			}
			// Stale: serve from cache but also revalidate in the background
			// only if the rate limit allows it. For determinism we return the
			// stale cache and surface `stale: true` so the runner can record it.
			return {
				ok: true,
				data: { ...cached.data, attempts: 0, cacheHit: true, stale: true },
				errors: [],
				warnings: []
			};
		}

		if (!withinRateLimit(source)) {
			return {
				ok: false,
				errors: [`rate limit exceeded for source ${source.sourceId}`],
				warnings: []
			};
		}

		const errors: string[] = [];
		for (let attempt = 1; attempt <= source.retry.maxAttempts; attempt += 1) {
			try {
				const response = await attemptFetch(source, localNow);
				if (response.status >= 500 || response.status === 429) {
					errors.push(`HTTP ${response.status}`);
					if (attempt < source.retry.maxAttempts) {
						await sleeper(computeBackoff(source.retry, attempt));
						continue;
					}
					return { ok: false, errors, warnings: [] };
				}
				if (response.status >= 400) {
					return {
						ok: false,
						errors: [`HTTP ${response.status} from ${source.endpoint}`],
						warnings: []
					};
				}
				const fetchedAtMs = localNow().getTime();
				cache.set(key, {
					data: response,
					fetchedAtMs,
					etag: response.headers['etag']
				});
				return {
					ok: true,
					data: { ...response, attempts: attempt, cacheHit: false, stale: false },
					errors: [],
					warnings: []
				};
			} catch (err) {
				if (isTransient(err)) {
					errors.push(err instanceof Error ? err.message : String(err));
					if (attempt < source.retry.maxAttempts) {
						await sleeper(computeBackoff(source.retry, attempt));
						continue;
					}
				} else {
					errors.push(err instanceof Error ? err.message : String(err));
				}
				break;
			}
		}

		return {
			ok: false,
			errors: [`exhausted retries: ${errors.join('; ')}`],
			warnings: []
		};
	}

	return { collect };
}

export type HttpCollector = ReturnType<typeof createHttpCollector>;