import { describe, expect, it, vi } from 'vitest';
import { createHttpCollector } from '../collector.js';
import type { SourceConfig, SourceId } from '../types.js';

const TEST_SOURCE: SourceConfig = {
	sourceId: 'levi-fixture' as SourceId,
	sourceKind: 'synthetic',
	endpoint: 'https://example.invalid/levi/snow',
	requestTimeoutMs: 1000,
	retry: { maxAttempts: 3, baseMs: 5, capMs: 50, jitterRatio: 0 },
	rateLimit: { requestsPerWindow: 2, windowMs: 1000 },
	cacheTtlMs: 5000,
	staleAfterMs: 60_000,
	permitRawStorage: false
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
		const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
			new Promise<Response>((resolve, reject) => {
				const t = setTimeout(
					() => resolve(jsonResponse({ value: 'late' })),
					500
				);
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

	it('rejects requests that exceed the per-source rate limit window', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ value: 1 }));
		const tightSource: SourceConfig = {
			...TEST_SOURCE,
			cacheTtlMs: 0,
			rateLimit: { requestsPerWindow: 1, windowMs: 60_000 }
		};
		const collector = createHttpCollector({ fetchImpl });

		const first = await collector.collect(tightSource);
		const second = await collector.collect(tightSource);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(false);
		expect(second.errors[0]).toMatch(/rate limit/i);
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

	it('marks a cached response as stale when older than staleAfterMs', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ value: 1 }));
		const collector = createHttpCollector({ fetchImpl });
		await collector.collect(TEST_SOURCE);
		const futureNow = new Date(Date.now() + TEST_SOURCE.staleAfterMs + 10_000);
		const second = await collector.collect(TEST_SOURCE, { now: () => futureNow });

		expect(second.ok).toBe(true);
		expect(second.data?.stale).toBe(true);
		expect(second.data?.cacheHit).toBe(true);
	});
});