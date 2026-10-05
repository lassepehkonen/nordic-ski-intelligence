/**
 * Server-only trigger that wires the reusable stages together for a real run.
 * Frontend code must NOT import this module — collection must be initiated
 * server-side so that provider costs cannot be driven by client traffic.
 *
 * The trigger returns the {@link PipelineSummary} from the runner. Callers
 * should keep the trigger pure (no I/O outside of the injected adapters) so
 * tests can exercise the full pipeline with in-memory doubles.
 */
import type { Clock, Logger } from './types.js';
import { SYSTEM_CLOCK } from './types.js';
import { createHttpCollector } from './collector.js';
import { createRangeValidator } from './validator.js';
import { scoreConfidence } from './confidence.js';
import { detectConflicts } from './conflicts.js';
import { createStructuredLogger } from './logger.js';
import { createInMemorySourceHealth, type SourceHealth } from './source-health.js';
import { createInMemoryPersister, type InMemoryPersister } from './persister.js';
import { normalizeSnow } from './normalizers/snow.js';
import { normalizeLifts } from './normalizers/lifts.js';
import { normalizeSlopes } from './normalizers/slopes.js';
import { parseSnowResponse } from './parsers/levi/snow.js';
import { parseLiftResponse } from './parsers/levi/lifts.js';
import { parseSlopeResponse } from './parsers/levi/slopes.js';
import { runPipeline, type Approval, type PipelineSummaryResult } from './runner.js';

export type PipelineKind = 'snow' | 'lifts' | 'slopes';

export interface TriggerDeps {
	readonly fetchImpl?: typeof fetch;
	readonly clock?: Clock;
	readonly logger?: Logger;
	readonly sourceHealth?: SourceHealth;
	readonly persister?: InMemoryPersister;
	readonly rangeRules?: ReadonlyArray<{
		readonly key: string;
		readonly min: number;
		readonly max: number;
		readonly unit: string;
		readonly allowText?: boolean;
	}>;
	readonly existingValues?: ReadonlyMap<string, unknown>;
	readonly retentionMs?: number;
	readonly validityMs?: number;
}

export interface TriggerInput {
	readonly source: Parameters<typeof createHttpCollector>[0] extends never
		? never
		: import('./types.js').SourceConfig;
	readonly approval: Approval;
	readonly kind: PipelineKind;
}

/** Default per-adapter range rules used when none are injected. */
export const DEFAULT_RANGE_RULES: ReadonlyArray<{
	key: string;
	min: number;
	max: number;
	unit: string;
	allowText?: boolean;
}> = [
	{ key: 'base_depth', min: 0, max: 1000, unit: 'cm' },
	{ key: 'mid_depth', min: 0, max: 1000, unit: 'cm' },
	{ key: 'summit_depth', min: 0, max: 1000, unit: 'cm' },
	{ key: 'new_snow_24h', min: 0, max: 100, unit: 'cm' },
	{ key: 'new_snow_72h', min: 0, max: 300, unit: 'cm' },
	{ key: 'open_count', min: 0, max: 200, unit: 'count' },
	{ key: 'total_count', min: 0, max: 200, unit: 'count' }
];

function selectAdapters(kind: PipelineKind) {
	switch (kind) {
		case 'snow':
			return {
				parser: { name: 'levi.snow', parse: parseSnowResponse as (raw: unknown) => import('./types.js').ParseResult<unknown> },
				normalizer: {
					name: 'levi.snow.normalize',
					normalize: (parsed: unknown) => normalizeSnow(parsed)
				}
			};
		case 'lifts':
			return {
				parser: { name: 'levi.lifts', parse: parseLiftResponse as (raw: unknown) => import('./types.js').ParseResult<unknown> },
				normalizer: {
					name: 'levi.lifts.normalize',
					normalize: (parsed: unknown) => normalizeLifts(parsed)
				}
			};
		case 'slopes':
			return {
				parser: { name: 'levi.slopes', parse: parseSlopeResponse as (raw: unknown) => import('./types.js').ParseResult<unknown> },
				normalizer: {
					name: 'levi.slopes.normalize',
					normalize: (parsed: unknown) => normalizeSlopes(parsed)
				}
			};
	}
}

export async function runCollectPipeline(
	input: TriggerInput,
	deps: TriggerDeps = {}
): Promise<PipelineSummaryResult> {
	const clock = deps.clock ?? SYSTEM_CLOCK;
	const logger = deps.logger ?? createStructuredLogger('collect-pipeline');
	const sourceHealth = deps.sourceHealth ?? createInMemorySourceHealth();
	const persister = deps.persister ?? createInMemoryPersister();
	const validator = createRangeValidator(deps.rangeRules ?? DEFAULT_RANGE_RULES);
	const collector = createHttpCollector({ fetchImpl: deps.fetchImpl });

	const adapters = selectAdapters(input.kind);

	const runner = runPipeline({
		source: input.source,
		approval: input.approval,
		collector,
		parser: adapters.parser,
		normalizer: adapters.normalizer,
		validator,
		scorer: { name: 'confidence', score: scoreConfidence },
		conflictDetector: { detect: detectConflicts },
		persister,
		logger,
		clock,
		existingValues: deps.existingValues,
		retentionMs: deps.retentionMs,
		validityMs: deps.validityMs
	});

	const summary = await runner.run();
	if (summary.status === 'ok') {
		sourceHealth.recordSuccess(input.source.sourceId, summary.latencyMs);
	} else {
		sourceHealth.recordFailure(input.source.sourceId, summary.outcome);
	}
	return summary;
}