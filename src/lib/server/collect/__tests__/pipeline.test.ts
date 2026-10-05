import { describe, expect, it } from 'vitest';
import { createInMemoryPersister } from '../persister.js';
import { runPipeline } from '../runner.js';
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
import { SYSTEM_CLOCK, type SourceConfig, type SourceId } from '../types.js';
import { vi } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
	readFileSync(
		resolve(here, '../../../../../tests/fixtures/resorts/levi/snow/synthetic-response.json'),
		'utf8'
	)
);

const SOURCE: SourceConfig = {
	sourceId: 'levi-fixture' as SourceId,
	sourceKind: 'synthetic',
	endpoint: 'https://example.invalid/levi/snow',
	requestTimeoutMs: 1000,
	retry: { maxAttempts: 1, baseMs: 1, capMs: 1, jitterRatio: 0 },
	rateLimit: { requestsPerWindow: 1000, windowMs: 1000 },
	cacheTtlMs: 0,
	staleAfterMs: 60_000,
	permitRawStorage: false
};

const APPROVAL = {
	approvalId: '00000000-0000-0000-0000-000000000010',
	sourceReferenceId: '00000000-0000-0000-0000-000000000020'
};

function buildRunner() {
	const collector = createHttpCollector({
		fetchImpl: vi.fn().mockResolvedValue(
			new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } })
		)
	});
	const validator = createRangeValidator([
		{ key: 'base_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'mid_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'summit_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'new_snow_24h', min: 0, max: 100, unit: 'cm' },
		{ key: 'new_snow_72h', min: 0, max: 300, unit: 'cm' }
	]);
	const persister = createInMemoryPersister();

	const logger = createStructuredLogger('levi-snow-collector');

	return {
		logger,
		persister,
		runner: runPipeline({
			source: SOURCE,
			approval: APPROVAL,
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: (parsed: unknown) => normalizeSnow(parsed) },
			validator,
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: SYSTEM_CLOCK
		})
	};
}

describe('runPipeline', () => {
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
			'collect',
			'parse',
			'normalize',
			'validate',
			'confidence',
			'conflict',
			'persist'
		]);
		expect(persister.lastOutcome()?.accepted.length).toBe(summary.factsPersisted);
	});

	it('records a collection_failure when the collector exhausts its retries', async () => {
		const logger = createStructuredLogger('levi-snow-collector');
		const persister = createInMemoryPersister();
		const collector = createHttpCollector({ fetchImpl: vi.fn().mockRejectedValue(new Error('boom')) });
		const summary = await runPipeline({
			source: { ...SOURCE, retry: { maxAttempts: 2, baseMs: 1, capMs: 1, jitterRatio: 0 } },
			approval: APPROVAL,
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: (parsed: unknown) => normalizeSnow(parsed) },
			validator: createRangeValidator([]),
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: SYSTEM_CLOCK
		}).run();

		expect(summary.status).toBe('error');
		expect(summary.outcome).toBe('collection_failure');
		expect(summary.collectionFailures).toBe(1);
		expect(summary.factsPersisted).toBe(0);
		expect(persister.lastOutcome()).toBeNull();
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
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: (parsed: unknown) => normalizeSnow(parsed) },
			validator: createRangeValidator([]),
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: SYSTEM_CLOCK
		}).run();

		expect(summary.status).toBe('error');
		expect(summary.outcome).toBe('parse_failure');
		expect(summary.parseFailures).toBe(1);
		expect(summary.factsPersisted).toBe(0);
		expect(persister.lastOutcome()).toBeNull();
	});

	it('records a validation_failure when the validator rejects all facts', async () => {
		const logger = createStructuredLogger('levi-snow-collector');
		const persister = createInMemoryPersister();
		const collector = createHttpCollector({
			fetchImpl: vi.fn().mockResolvedValue(
				new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } })
			)
		});
		const summary = await runPipeline({
			source: SOURCE,
			approval: APPROVAL,
			collector,
			parser: { name: 'snow', parse: parseSnowResponse },
			normalizer: { name: 'snow-normalizer', normalize: (parsed: unknown) => normalizeSnow(parsed) },
			validator: createRangeValidator([{ key: 'base_depth', min: 1000, max: 2000, unit: 'cm' }]),
			scorer: { name: 'confidence', score: scoreConfidence },
			conflictDetector: { detect: detectConflicts },
			persister,
			logger,
			clock: SYSTEM_CLOCK
		}).run();

		expect(summary.status).toBe('error');
		expect(summary.outcome).toBe('validation_failure');
		expect(summary.validationFailures).toBeGreaterThan(0);
		expect(summary.factsPersisted).toBe(0);
		expect(persister.lastOutcome()).toBeNull();
	});
});