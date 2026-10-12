import { describe, expect, it, vi } from 'vitest';
import { createHttpCollector } from '../collector.js';
import { MAX_PAYLOAD_BYTES } from '../parsers/json-object.js';
import type { SourceConfig, SourceId } from '../types.js';

const TEST_SOURCE: SourceConfig = {
	sourceId: 'levi-fixture' as SourceId,
	sourceKind: 'synthetic',
	endpoint: 'https://example.invalid/levi/snow',
	requestTimeoutMs: 1000,
	retry: { maxAttempts: 3, baseMs: 5, capMs: 50, jitterRatio: 0 },
	rateLimit: { requestsPerWindow: 5, windowMs: 1000 },
	cacheTtlMs: 5000,
	staleAfterMs: 60_000
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('HTTP collector', () => {
	it('returns a successful response on the first attempt', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ value: 1 }));
		const collector = createHttpCollector({ fetchImpl });

		const result = await collector.collect(TEST_SOURCE);

		expect(result.ok).toBe(true);
		expect(result.data?.status).toBe(200);
		expect(result.data?.attempts).toBe(1);
		expect(result.data?.cacheHit).toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(result.errors).toEqual([]);
	});

	it('retries on a transient error and returns success within the attempt budget', async () => {
		const fetchImpl = vi
			.fn()
			.mockRejectedValueOnce(new Error('ECONNRESET'))
			.mockResolvedValueOnce(jsonResponse({ value: 2 }));

		const collector = createHttpCollector({ fetchImpl });
		const result = await collector.collect(TEST_SOURCE);

		expect(result.ok).toBe(true);
		expect(result.data?.attempts).toBe(2);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('fails after the configured max attempts and surfaces a clear error', async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
		const collector = createHttpCollector({ fetchImpl });

		const result = await collector.collect(TEST_SOURCE);

		expect(result.ok).toBe(false);
		expect(result.errors[0]).toMatch(/exhausted retries/i);
		expect(fetchImpl).toHaveBeenCalledTimes(TEST_SOURCE.retry.maxAttempts);
	});

	it('aborts the request when it exceeds the per-request timeout', async () => {
		const fetchImpl = vi.fn().mockImplementation(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((resolve, reject) => {
					const t = setTimeout(() => resolve(jsonResponse({ value: 'late' })), 500);
					init?.signal?.addEventListener('abort', () => {
						clearTimeout(t);
						reject(new DOMException('aborted', 'AbortError'));
					});
				})
		);

		const fastSource: SourceConfig = { ...TEST_SOURCE, requestTimeoutMs: 50 };
		const collector = createHttpCollector({ fetchImpl });

		const result = await collector.collect(fastSource);

		expect(result.ok).toBe(false);
		expect(result.errors[0]).toMatch(/timeout|aborted/i);
	});

	it('rejects a response larger than the parser payload cap without retrying it', async () => {
		const fetchImpl = vi
			.fn()
			.mockImplementation(() => new Response('x'.repeat(MAX_PAYLOAD_BYTES + 1), { status: 200 }));
		const collector = createHttpCollector({ fetchImpl });

		const result = await collector.collect(TEST_SOURCE);

		expect(result.ok).toBe(false);
		expect(result.errors.join(' ')).toMatch(/payload_too_large/i);
		expect(result.providerRequests).toBe(1);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('rejects a second outbound request within the per-source rate limit window', async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
		const tightSource: SourceConfig = {
			...TEST_SOURCE,
			rateLimit: { requestsPerWindow: 1, windowMs: 60_000 }
		};
		const collector = createHttpCollector({ fetchImpl, sleep: async () => undefined });

		const first = await collector.collect(tightSource);
		const second = await collector.collect(tightSource);

		expect(first.ok).toBe(false);
		expect(second.ok).toBe(false);
		expect(second.errors[0]).toMatch(/rate limit/i);
		expect(second.providerRequests).toBe(0);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('serves a cached response within the TTL and skips the network', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ value: 1 }));
		const collector = createHttpCollector({ fetchImpl });

		await collector.collect(TEST_SOURCE);
		const second = await collector.collect(TEST_SOURCE);

		expect(second.ok).toBe(true);
		expect(second.data?.cacheHit).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('disables caching when cache TTL is zero', async () => {
		const fetchImpl = vi.fn().mockImplementation(() => jsonResponse({ value: 1 }));
		const now = () => new Date('2026-02-20T09:00:00.000Z');
		const source: SourceConfig = { ...TEST_SOURCE, cacheTtlMs: 0 };
		const collector = createHttpCollector({ fetchImpl, now });

		await collector.collect(source);
		await collector.collect(source);

		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('marks a cached response as stale when older than staleAfterMs', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ value: 1 }));
		const collector = createHttpCollector({ fetchImpl });
		const source = { ...TEST_SOURCE, cacheTtlMs: TEST_SOURCE.staleAfterMs + 60_000 };
		await collector.collect(source);
		const futureNow = new Date(Date.now() + source.staleAfterMs + 10_000);
		const second = await collector.collect(source, { now: () => futureNow });

		expect(second.ok).toBe(true);
		expect(second.data?.stale).toBe(true);
		expect(second.data?.cacheHit).toBe(true);
	});

	it('serves the last cached response as stale after a refresh failure', async () => {
		let time = Date.parse('2026-02-20T09:00:00.000Z');
		const now = () => new Date(time);
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ value: 'last-valid' }))
			.mockRejectedValueOnce(new Error('ECONNRESET'));
		const source: SourceConfig = {
			...TEST_SOURCE,
			retry: { ...TEST_SOURCE.retry, maxAttempts: 1 }
		};
		const collector = createHttpCollector({ fetchImpl, now, sleep: async () => undefined });

		const first = await collector.collect(source);
		time += source.staleAfterMs + 1;
		const refresh = await collector.collect(source);

		expect(first.ok).toBe(true);
		expect(refresh.ok).toBe(true);
		expect(refresh.data?.body).toBe(JSON.stringify({ value: 'last-valid' }));
		expect(refresh.data?.stale).toBe(true);
		expect(refresh.data?.cacheHit).toBe(true);
		expect(refresh.providerRequests).toBe(1);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});
});
