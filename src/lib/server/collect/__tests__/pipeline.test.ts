import { describe, expect, it } from 'vitest';
import { createInMemoryPersister } from '../persister.js';
import { runPipeline, type Approval } from '../runner.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHttpCollector } from '../collector.js';
import { parseSnowResponse } from '../parsers/levi/snow.js';
import { normalizeSnow } from '../normalizers/snow.js';
import { createRangeValidator } from '../validator.js';
import { scoreConfidence } from '../confidence.js';
import { detectConflicts } from '../conflicts.js';
import { createStructuredLogger } from '../logger.js';
import { type Clock, type SourceConfig, type SourceId } from '../types.js';
import { vi } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
	readFileSync(
		resolve(here, '../../../../../tests/fixtures/resorts/levi/snow/synthetic-response.json'),
		'utf8'
	)
);

const FIXTURE_CLOCK: Clock = { now: () => new Date('2026-02-20T09:00:00.000Z') };

const SOURCE: SourceConfig = {
	sourceId: 'levi-fixture' as SourceId,
	sourceKind: 'synthetic',
	endpoint: 'https://example.invalid/levi/snow',
	requestTimeoutMs: 1000,
	retry: { maxAttempts: 1, baseMs: 1, capMs: 1, jitterRatio: 0 },
	rateLimit: { requestsPerWindow: 1000, windowMs: 1000 },
	cacheTtlMs: 0,
	staleAfterMs: 24 * 60 * 60 * 1000
};

const APPROVAL = {
	approvalId: '00000000-0000-0000-0000-000000000010',
	status: 'approved' as const,
	collectionAllowed: true,
	normalizedStorageAllowed: true,
	rawStorageAllowed: false,
	expiresAt: '2026-12-31T23:59:59.000Z',
	normalizedRetentionMs: 7 * 24 * 60 * 60 * 1000,
	permittedFields: [
		'snow_base_depth',
		'snow_mid_depth',
		'snow_summit_depth',
		'snow_new_24h',
		'snow_new_72h',
		'snow_surface_condition'
	],
	sourceReferenceIdsByField: {
		snow_base_depth: '00000000-0000-0000-0000-000000000021',
		snow_mid_depth: '00000000-0000-0000-0000-000000000022',
		snow_summit_depth: '00000000-0000-0000-0000-000000000023',
		snow_new_24h: '00000000-0000-0000-0000-000000000024',
		snow_new_72h: '00000000-0000-0000-0000-000000000025',
		snow_surface_condition: '00000000-0000-0000-0000-000000000026'
	}
};

function buildRunner(
	options: {
		persister?: ReturnType<typeof createInMemoryPersister>;
		fetchImpl?: typeof fetch;
		approval?: Approval;
		clock?: Clock;
		source?: SourceConfig;
		sink?: (event: Record<string, unknown>) => void;
	} = {}
) {
	const runClock = options.clock ?? FIXTURE_CLOCK;
	const source = options.source ?? SOURCE;
	const fetchImpl =
		options.fetchImpl ??
		vi.fn().mockResolvedValue(
			new Response(JSON.stringify(fixture), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
	const collector = createHttpCollector({
		fetchImpl,
		now: () => runClock.now(),
		sleep: async () => undefined
	});
	const validator = createRangeValidator([
		{ key: 'base_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'mid_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'summit_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'new_snow_24h', min: 0, max: 100, unit: 'cm' },
		{ key: 'new_snow_72h', min: 0, max: 300, unit: 'cm' },
		{
			key: 'surface_condition',
			min: 0,
			max: 0,
			unit: '',
			allowText: true,
			allowedValues: ['packed_powder', 'hardpack', 'wet_snow', 'icy']
		}
	]);
	const persister = options.persister ?? createInMemoryPersister();

	const logger = createStructuredLogger(
		'levi-snow-collector',
		options.sink ? { sink: options.sink } : {}
	);

	return {
		logger,
		persister,
		runner: runPipeline({
			source,
			approval: options.approval ?? APPROVAL,
			fieldKeys: APPROVAL.permittedFields,
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: normalizeSnow },
			validator,
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: runClock
		})
	};
}

describe('runPipeline', () => {
	it('blocks provider access when source rights are not approved', async () => {
		const fetchImpl = vi.fn();
		const { runner } = buildRunner({ approval: { ...APPROVAL, status: 'pending' }, fetchImpl });

		const summary = await runner.run();

		expect(summary.outcome).toBe('rights_blocked');
		expect(summary.providerRequests).toBe(0);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('logs structured error codes without exposing provider error text', async () => {
		const logs: Record<string, unknown>[] = [];
		const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET with secret-token'));
		const { runner } = buildRunner({ fetchImpl, sink: (event) => logs.push(event) });

		const summary = await runner.run();
		const collectLog = logs.find((record) => record.stage === 'collect');

		expect(summary.outcome).toBe('collection_failure');
		expect(collectLog?.error_codes).toEqual(['provider_retry_exhausted']);
		expect(JSON.stringify(logs)).not.toContain('secret-token');
	});

	it('does not retain raw provider bodies in the fixture store', async () => {
		const approval: Approval = {
			...APPROVAL,
			rawStorageAllowed: true,
			rawRetentionMs: 24 * 60 * 60 * 1000
		};
		const { runner, persister } = buildRunner({ approval });

		await runner.run();

		expect(
			persister.recordsSnapshot().some((record: { kind: string }) => record.kind === 'raw')
		).toBe(false);
	});

	it('runs all stages in order and persists the validated facts', async () => {
		const { runner, persister } = buildRunner();
		const summary = await runner.run();

		expect(summary.status).toBe('ok');
		expect(summary.outcome).toBe('success');
		expect(summary.providerRequests).toBe(1);
		expect(summary.parseFailures).toBe(0);
		expect(summary.validationFailures).toBe(0);
		expect(summary.factsPersisted).toBeGreaterThan(0);
		expect(summary.stages.map((s) => s.stage)).toEqual([
			'approval',
			'collect',
			'parse',
			'normalize',
			'validate',
			'confidence',
			'conflict',
			'persist'
		]);
		expect(persister.lastOutcome()?.accepted.length).toBe(summary.factsPersisted);
		expect(
			persister.recordsSnapshot().some((record: { kind: string }) => record.kind === 'raw')
		).toBe(false);
	});

	it('records a collection_failure when the collector exhausts its retries', async () => {
		const logger = createStructuredLogger('levi-snow-collector');
		const persister = createInMemoryPersister();
		const collector = createHttpCollector({
			fetchImpl: vi.fn().mockRejectedValue(new Error('boom'))
		});
		const summary = await runPipeline({
			source: { ...SOURCE, retry: { maxAttempts: 2, baseMs: 1, capMs: 1, jitterRatio: 0 } },
			approval: APPROVAL,
			fieldKeys: APPROVAL.permittedFields,
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: normalizeSnow },
			validator: createRangeValidator([]),
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: FIXTURE_CLOCK
		}).run();

		expect(summary.status).toBe('error');
		expect(summary.outcome).toBe('collection_failure');
		expect(summary.collectionFailures).toBe(1);
		expect(summary.providerRequests).toBe(2);
		expect(summary.factsPersisted).toBe(0);
		expect(persister.lastOutcome()?.accepted).toEqual([]);
		expect(persister.recordsSnapshot().some((record) => record.kind === 'run')).toBe(true);
		expect(persister.recordsSnapshot().some((record) => record.kind === 'normalized')).toBe(false);
		expect(
			persister.recordsSnapshot().some((record: { kind: string }) => record.kind === 'raw')
		).toBe(false);
	});

	it('records a parse_failure when the parser returns a fatal result', async () => {
		const logger = createStructuredLogger('levi-snow-collector');
		const persister = createInMemoryPersister();
		const collector = createHttpCollector({
			fetchImpl: vi.fn().mockResolvedValue(new Response('not json', { status: 200 }))
		});
		const summary = await runPipeline({
			source: SOURCE,
			approval: APPROVAL,
			fieldKeys: APPROVAL.permittedFields,
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: normalizeSnow },
			validator: createRangeValidator([]),
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: FIXTURE_CLOCK
		}).run();

		expect(summary.status).toBe('error');
		expect(summary.outcome).toBe('parse_failure');
		expect(summary.parseFailures).toBe(1);
		expect(summary.providerRequests).toBe(1);
		expect(summary.factsPersisted).toBe(0);
		expect(persister.lastOutcome()?.accepted).toEqual([]);
		expect(persister.recordsSnapshot().some((record) => record.kind === 'run')).toBe(true);
	});

	it('skips stale cached data and preserves the last valid observation', async () => {
		let time = Date.parse('2026-02-20T09:00:00.000Z');
		const clock: Clock = { now: () => new Date(time) };
		const source: SourceConfig = {
			...SOURCE,
			cacheTtlMs: 4 * 60 * 60 * 1000,
			staleAfterMs: 60 * 60 * 1000
		};
		const fetchImpl = vi
			.fn()
			.mockImplementation(() => new Response(JSON.stringify(fixture), { status: 200 }));
		const persister = createInMemoryPersister();
		const { runner } = buildRunner({ clock, source, fetchImpl, persister });

		const first = await runner.run();
		const previous = persister.currentValues().get('snow.base_depth');
		time += 2 * 60 * 60 * 1000;
		const stale = await runner.run();

		expect(first.factsPersisted).toBeGreaterThan(0);
		expect(stale.outcome).toBe('stale_skipped');
		expect(stale.providerRequests).toBe(0);
		expect(stale.factsPersisted).toBe(0);
		expect(persister.currentValues().get('snow.base_depth')).toEqual(previous);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('fails closed when existing values cannot be loaded for conflict detection', async () => {
		const backing = createInMemoryPersister();
		const persister = {
			...backing,
			getCurrentValues: async () => {
				throw new Error('database unavailable');
			}
		};
		const { runner } = buildRunner({ persister });

		const summary = await runner.run();

		expect(summary.outcome).toBe('conflict_check_failure');
		expect(summary.factsPersisted).toBe(0);
		expect(backing.lastOutcome()?.accepted).toEqual([]);
	});

	it('rejects future-dated observations instead of persisting them', async () => {
		const futureFixture = JSON.parse(JSON.stringify(fixture)) as {
			snow: { last_measured_at: string };
		};
		futureFixture.snow.last_measured_at = '2026-02-20T10:00:00.000Z';
		const fetchImpl = vi
			.fn()
			.mockImplementation(() => new Response(JSON.stringify(futureFixture), { status: 200 }));
		const persister = createInMemoryPersister();
		const { runner } = buildRunner({ fetchImpl, persister });

		const summary = await runner.run();

		expect(summary.outcome).toBe('validation_failure');
		expect(summary.validationFailures).toBeGreaterThan(0);
		expect(summary.factsPersisted).toBe(0);
		expect(persister.lastOutcome()?.accepted).toEqual([]);
	});

	it('preserves the last valid value when the provider collection fails', async () => {
		const persister = createInMemoryPersister({
			initialValues: new Map([['snow.base_depth', 44]])
		});
		const { runner } = buildRunner({
			persister,
			fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNRESET'))
		});

		const summary = await runner.run();

		expect(summary.outcome).toBe('collection_failure');
		expect(summary.providerRequests).toBe(1);
		expect(persister.currentValues().get('snow.base_depth')).toBe(44);
		expect(persister.lastOutcome()?.accepted).toEqual([]);
	});

	it('records a validation_failure when the validator rejects all facts', async () => {
		const logger = createStructuredLogger('levi-snow-collector');
		const persister = createInMemoryPersister();
		const collector = createHttpCollector({
			fetchImpl: vi.fn().mockResolvedValue(
				new Response(JSON.stringify(fixture), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
		});
		const summary = await runPipeline({
			source: SOURCE,
			approval: APPROVAL,
			fieldKeys: APPROVAL.permittedFields,
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: normalizeSnow },
			validator: createRangeValidator([{ key: 'base_depth', min: 1000, max: 2000, unit: 'cm' }]),
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: FIXTURE_CLOCK
		}).run();

		expect(summary.status).toBe('error');
		expect(summary.outcome).toBe('validation_failure');
		expect(summary.validationFailures).toBeGreaterThan(0);
		expect(summary.providerRequests).toBe(1);
		expect(summary.factsPersisted).toBe(0);
		expect(persister.lastOutcome()?.accepted).toEqual([]);
		expect(persister.recordsSnapshot().some((record) => record.kind === 'run')).toBe(true);
	});
});
