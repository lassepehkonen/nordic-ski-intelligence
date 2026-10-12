import type { RawResponse, SourceConfig, SourceId, StageResult } from './types.js';
import { MAX_PAYLOAD_BYTES } from './parsers/json-object.js';

export interface CollectOptions {
	readonly now?: () => Date;
	readonly sleep?: (ms: number) => Promise<void>;
}

export interface HttpCollectorDeps {
	readonly fetchImpl?: typeof fetch;
	readonly now?: () => Date;
	readonly sleep?: (ms: number) => Promise<void>;
	readonly random?: () => number;
}

interface CacheState {
	readonly data: RawResponse;
	readonly fetchedAtMs: number;
}

export interface CollectedResponse extends RawResponse {
	/** Number of outbound attempts made for this collection call. */
	readonly attempts: number;
	readonly cacheHit: boolean;
	/** True when the source response is past its freshness threshold or stale fallback was used. */
	readonly stale: boolean;
}

const defaultSleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

function computeBackoff(
	policy: SourceConfig['retry'],
	attempt: number,
	random: () => number
): number {
	const exponential = Math.min(policy.capMs, policy.baseMs * 2 ** (attempt - 1));
	const ratio = Math.max(0, Math.min(1, policy.jitterRatio));
	const multiplier = 1 - ratio + 2 * ratio * Math.max(0, Math.min(1, random()));
	return Math.max(0, Math.round(exponential * multiplier));
}

interface RateBucket {
	readonly timestamps: number[];
}

const SAFE_RESPONSE_HEADERS = new Set([
	'content-type',
	'date',
	'etag',
	'last-modified',
	'cache-control'
]);

function safeHeaders(headers: Headers): Record<string, string> {
	const safe: Record<string, string> = {};
	headers.forEach((value, key) => {
		const normalizedKey = key.toLowerCase();
		if (SAFE_RESPONSE_HEADERS.has(normalizedKey)) safe[normalizedKey] = value;
	});
	return safe;
}

function retryableStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

class PayloadTooLargeError extends Error {
	constructor() {
		super('payload_too_large');
		this.name = 'PayloadTooLargeError';
	}
}

async function readBoundedBody(
	body: ReadableStream<Uint8Array> | null
): Promise<{ text: string; bytes: number }> {
	if (!body) return { text: '', bytes: 0 };
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const chunks: string[] = [];
	let bytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			bytes += value.byteLength;
			if (bytes > MAX_PAYLOAD_BYTES) {
				await reader.cancel().catch(() => undefined);
				throw new PayloadTooLargeError();
			}
			chunks.push(decoder.decode(value, { stream: true }));
		}
		chunks.push(decoder.decode());
		return { text: chunks.join(''), bytes };
	} finally {
		reader.releaseLock();
	}
}

function transientError(error: unknown): string {
	if (!(error instanceof Error)) return 'network_error';
	if (error instanceof PayloadTooLargeError) return 'payload_too_large';
	if (error.name === 'AbortError') return 'timeout';
	if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(error.message))
		return 'network_error';
	return 'request_error';
}

export function createHttpCollector(deps: HttpCollectorDeps = {}) {
	const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
	const now = deps.now ?? (() => new Date());
	const sleep = deps.sleep ?? defaultSleep;
	const random = deps.random ?? Math.random;
	const cache = new Map<string, CacheState>();
	const rateLimits = new Map<SourceId, RateBucket>();

	function cacheKey(source: SourceConfig): string {
		return `${source.sourceId}::${source.endpoint}`;
	}

	function reserveProviderRequest(source: SourceConfig, atMs: number): boolean {
		const prior = rateLimits.get(source.sourceId) ?? { timestamps: [] };
		const cutoff = atMs - source.rateLimit.windowMs;
		const recent = prior.timestamps.filter((timestamp) => timestamp > cutoff);
		if (recent.length >= source.rateLimit.requestsPerWindow) {
			rateLimits.set(source.sourceId, { timestamps: recent });
			return false;
		}
		recent.push(atMs);
		rateLimits.set(source.sourceId, { timestamps: recent });
		return true;
	}

	async function attemptFetch(source: SourceConfig): Promise<RawResponse> {
		const controller = new AbortController();
		const start = now().getTime();
		const timeout = setTimeout(() => controller.abort(), source.requestTimeoutMs);
		try {
			const response = await fetchImpl(source.endpoint, {
				method: 'GET',
				headers: {
					accept: source.requestAccept ?? 'application/json',
					...(source.requestUserAgent ? { 'user-agent': source.requestUserAgent } : {})
				},
				signal: controller.signal,
				redirect: 'error'
			});
			let body = '';
			let bytes = 0;
			if (response.ok) {
				const declaredBytes = Number(response.headers.get('content-length'));
				if (Number.isFinite(declaredBytes) && declaredBytes > MAX_PAYLOAD_BYTES) {
					await response.body?.cancel().catch(() => undefined);
					throw new PayloadTooLargeError();
				}
				const bounded = await readBoundedBody(response.body);
				body = bounded.text;
				bytes = bounded.bytes;
			} else {
				await response.body?.cancel().catch(() => undefined);
			}
			return {
				body,
				headers: safeHeaders(response.headers),
				status: response.status,
				fetchedAt: now().toISOString(),
				durationMs: Math.max(0, now().getTime() - start),
				sourceId: source.sourceId,
				endpoint: source.endpoint,
				bytes
			};
		} finally {
			clearTimeout(timeout);
		}
	}

	function staleFallback(
		cached: CacheState,
		attempts: number,
		providerRequests: number,
		warnings: ReadonlyArray<string>,
		errors: ReadonlyArray<string>
	): StageResult<CollectedResponse> {
		return {
			ok: true,
			data: { ...cached.data, attempts, cacheHit: true, stale: true },
			errors,
			warnings: [...warnings, 'Refresh failed; serving the last cached response as stale'],
			providerRequests
		};
	}

	async function collect(
		source: SourceConfig,
		options: CollectOptions = {}
	): Promise<StageResult<CollectedResponse>> {
		const localNow = options.now ?? now;
		const localSleep = options.sleep ?? sleep;
		const key = cacheKey(source);
		const cached = cache.get(key);
		const currentTime = localNow().getTime();

		if (cached) {
			const ageMs = Math.max(0, currentTime - cached.fetchedAtMs);
			if (source.cacheTtlMs > 0 && ageMs <= source.cacheTtlMs) {
				return {
					ok: true,
					data: {
						...cached.data,
						attempts: 0,
						cacheHit: true,
						stale: ageMs > source.staleAfterMs
					},
					errors: [],
					warnings:
						ageMs > source.staleAfterMs ? ['Cached response is past its freshness threshold'] : [],
					providerRequests: 0
				};
			}
		}

		const errors: string[] = [];
		let providerRequests = 0;
		let attempts = 0;
		const maxAttempts = Math.max(1, Math.floor(source.retry.maxAttempts));

		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			if (!reserveProviderRequest(source, localNow().getTime())) {
				const rateLimitError = `rate limit exceeded for source ${source.sourceId}`;
				errors.push(rateLimitError);
				if (cached) return staleFallback(cached, attempts, providerRequests, [], errors);
				return { ok: false, errors, warnings: [], providerRequests };
			}

			attempts += 1;
			providerRequests += 1;
			try {
				const response = await attemptFetch(source);
				if (retryableStatus(response.status)) {
					errors.push(`HTTP ${response.status}`);
					if (attempt < maxAttempts) {
						await localSleep(computeBackoff(source.retry, attempt, random));
						continue;
					}
					break;
				}
				if (response.status < 200 || response.status >= 300) {
					errors.push(`HTTP ${response.status}`);
					break;
				}

				if (source.cacheTtlMs > 0)
					cache.set(key, { data: response, fetchedAtMs: localNow().getTime() });
				return {
					ok: true,
					data: { ...response, attempts, cacheHit: false, stale: false },
					errors: [],
					warnings: [],
					providerRequests
				};
			} catch (error) {
				const errorCode = transientError(error);
				errors.push(errorCode);
				if (errorCode === 'payload_too_large') break;
				if (attempt < maxAttempts) {
					await localSleep(computeBackoff(source.retry, attempt, random));
					continue;
				}
				break;
			}
		}

		if (cached) {
			return staleFallback(
				cached,
				attempts,
				providerRequests,
				[],
				[`refresh failed: ${errors.join('; ')}`]
			);
		}
		return {
			ok: false,
			errors: [`exhausted retries: ${errors.join('; ')}`],
			warnings: [],
			providerRequests
		};
	}

	return { collect };
}

export type HttpCollector = ReturnType<typeof createHttpCollector>;
