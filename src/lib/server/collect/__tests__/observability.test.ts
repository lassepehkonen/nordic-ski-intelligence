import { describe, expect, it } from 'vitest';
import { createStructuredLogger } from '../logger.js';
import { createInMemorySourceHealth, recordCollectionHealth } from '../source-health.js';

describe('Structured logger', () => {
	it('emits one JSON record per call with run_id, stage, duration_ms, outcome', () => {
		const records: unknown[] = [];
		const logger = createStructuredLogger('test', {
			sink: (event) => records.push(event)
		});
		logger.info({
			run_id: 'r-1',
			source_id: 'levi',
			stage: 'collect',
			duration_ms: 12,
			outcome: 'success'
		});
		expect(records).toHaveLength(1);
		const record = records[0] as Record<string, unknown>;
		expect(record.run_id).toBe('r-1');
		expect(record.stage).toBe('collect');
		expect(record.outcome).toBe('success');
		expect(typeof record.duration_ms).toBe('number');
	});

	it('does not log secret-like keys when provided', () => {
		const records: unknown[] = [];
		const logger = createStructuredLogger('test', {
			sink: (event) => records.push(event)
		});
		logger.info({ source_id: 'levi', api_key: 'top-secret', token: 't', stage: 'collect' });
		const record = records[0] as Record<string, unknown>;
		expect(record.api_key).toBeUndefined();
		expect(record.token).toBeUndefined();
		expect(record.source_id).toBe('levi');
	});

	it('redacts sensitive keys recursively in nested objects and arrays', () => {
		const records: unknown[] = [];
		const logger = createStructuredLogger('test', {
			sink: (event: Record<string, unknown>) => records.push(event)
		});
		logger.info({
			request: { Authorization: 'Bearer secret', url: 'https://example.invalid' },
			items: [{ id: 'lift-1', refreshToken: 'secret-token' }]
		});
		const record = records[0] as {
			request: Record<string, unknown>;
			items: Array<Record<string, unknown>>;
		};
		expect(record.request.Authorization).toBeUndefined();
		expect(record.request.url).toBe('https://example.invalid');
		expect(record.items[0].refreshToken).toBeUndefined();
		expect(record.items[0].id).toBe('lift-1');
	});
});

describe('In-memory source health', () => {
	it('updates availability only for provider-backed collection outcomes', () => {
		const health = createInMemorySourceHealth();
		recordCollectionHealth(health, 'levi', {
			providerRequests: 0,
			collectionFailures: 0,
			stages: [{ stage: 'collect', outcome: 'success', durationMs: 12 }]
		});
		expect(health.snapshot('levi').total_successes).toBe(0);

		recordCollectionHealth(health, 'levi', {
			providerRequests: 1,
			collectionFailures: 0,
			stages: [{ stage: 'collect', outcome: 'success', durationMs: 12 }]
		});
		expect(health.snapshot('levi').total_successes).toBe(1);
		expect(health.snapshot('levi').last_latency_ms).toBe(12);

		recordCollectionHealth(health, 'levi', {
			providerRequests: 1,
			collectionFailures: 1,
			stages: [{ stage: 'collect', outcome: 'stale_skipped', durationMs: 20 }]
		});
		expect(health.snapshot('levi').total_failures).toBe(1);
		expect(health.snapshot('levi').last_error).toBe('stale_refresh_failed');
	});

	it('starts healthy for an unseen source', () => {
		const health = createInMemorySourceHealth();
		expect(health.isHealthy('levi')).toBe(true);
	});

	it('records a successful collection and keeps the source healthy', () => {
		const health = createInMemorySourceHealth();
		health.recordSuccess('levi', 100);
		expect(health.isHealthy('levi')).toBe(true);
		expect(health.consecutiveFailures('levi')).toBe(0);
		expect(health.snapshot('levi').last_latency_ms).toBe(100);
	});

	it('marks a source unhealthy after consecutive failures exceed the threshold', () => {
		const health = createInMemorySourceHealth({ unhealthyAfter: 3, cooldownMs: 60_000 });
		health.recordFailure('levi', 'timeout');
		health.recordFailure('levi', 'timeout');
		health.recordFailure('levi', 'timeout');
		expect(health.isHealthy('levi')).toBe(false);
		expect(health.consecutiveFailures('levi')).toBe(3);
	});

	it('returns a snapshot suitable for observability rows', () => {
		const health = createInMemorySourceHealth();
		health.recordSuccess('levi', 50);
		const snapshot = health.snapshot('levi');
		expect(snapshot.source_id).toBe('levi');
		expect(snapshot.consecutive_failures).toBe(0);
		expect(snapshot.is_healthy).toBe(true);
		expect(snapshot.last_success_at).toBeTruthy();
	});
});
