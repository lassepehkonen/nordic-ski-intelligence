import type {
	Clock,
	Collector,
	Logger,
	NormalizedFactCandidate,
	Parser,
	Persister,
	SourceConfig
} from './types.js';
import { SYSTEM_CLOCK } from './types.js';
import { createRangeValidator, type RangeRule } from './validator.js';
import { scoreConfidence } from './confidence.js';
import { detectConflicts } from './conflicts.js';
import { createStructuredLogger } from './logger.js';
import { recordCollectionHealth, type SourceHealth } from './source-health.js';
import { normalizeSnow } from './normalizers/snow.js';
import { normalizeLifts } from './normalizers/lifts.js';
import { normalizeSlopes } from './normalizers/slopes.js';
import { parseSnowResponse, type SnowSnapshot } from './parsers/levi/snow.js';
import { parseLiftResponse, type LiftSnapshot } from './parsers/levi/lifts.js';
import { parseSlopeResponse, type SlopeSnapshot } from './parsers/levi/slopes.js';
import { runPipeline, type Approval, type PipelineSummaryResult } from './runner.js';

export type PipelineKind = 'snow' | 'lifts' | 'slopes';

export interface TriggerDeps {
	/** Inject an approved server-side collector; never accept one from a request body. */
	readonly collector: Collector;
	/** A real database persister is required; in-memory persistence is test-only. */
	readonly persister: Persister;
	readonly clock?: Clock;
	readonly logger?: Logger;
	readonly sourceHealth: SourceHealth;
	readonly rangeRules?: ReadonlyArray<RangeRule>;
	readonly existingValues?: ReadonlyMap<string, unknown>;
}

export interface TriggerInput {
	readonly source: SourceConfig;
	readonly approval: Approval;
	readonly kind: PipelineKind;
}

export const DEFAULT_RANGE_RULES: ReadonlyArray<RangeRule> = [
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
	},
	{ key: 'open_count', min: 0, max: 200, unit: 'count' },
	{ key: 'total_count', min: 0, max: 200, unit: 'count' },
	{
		key: 'operating_status',
		min: 0,
		max: 0,
		unit: '',
		allowText: true,
		allowedValues: ['open', 'closed']
	}
];

interface TypedAdapter<TParsed> {
	readonly parser: Parser<unknown, TParsed>;
	readonly normalizer: {
		readonly name: string;
		normalize(input: TParsed): ReadonlyArray<NormalizedFactCandidate>;
	};
	readonly fieldKeys: ReadonlyArray<string>;
}

function runWithAdapter<TParsed>(
	input: TriggerInput,
	deps: TriggerDeps,
	adapter: TypedAdapter<TParsed>
): Promise<PipelineSummaryResult> {
	const clock = deps.clock ?? SYSTEM_CLOCK;
	const logger = deps.logger ?? createStructuredLogger('collect-pipeline');
	const sourceHealth = deps.sourceHealth;
	const runner = runPipeline({
		source: input.source,
		approval: input.approval,
		fieldKeys: adapter.fieldKeys,
		collector: deps.collector,
		parser: adapter.parser,
		normalizer: adapter.normalizer,
		validator: createRangeValidator(deps.rangeRules ?? DEFAULT_RANGE_RULES),
		scorer: { name: 'confidence', score: scoreConfidence },
		conflictDetector: { detect: detectConflicts },
		persister: deps.persister,
		logger,
		clock,
		existingValues: deps.existingValues
	});
	return runner.run().then((summary) => {
		recordCollectionHealth(sourceHealth, input.source.sourceId, summary);
		return summary;
	});
}

export function runCollectPipeline(
	input: TriggerInput,
	deps: TriggerDeps
): Promise<PipelineSummaryResult> {
	switch (input.kind) {
		case 'snow':
			return runWithAdapter<SnowSnapshot>(input, deps, {
				parser: { name: 'levi.snow', parse: parseSnowResponse },
				normalizer: { name: 'levi.snow.normalize', normalize: normalizeSnow },
				fieldKeys: [
					'snow_base_depth',
					'snow_mid_depth',
					'snow_summit_depth',
					'snow_new_24h',
					'snow_new_72h',
					'snow_surface_condition'
				]
			});
		case 'lifts':
			return runWithAdapter<LiftSnapshot>(input, deps, {
				parser: { name: 'levi.lifts', parse: parseLiftResponse },
				normalizer: { name: 'levi.lifts.normalize', normalize: normalizeLifts },
				fieldKeys: ['open_lift_count', 'total_lift_count', 'operating_status']
			});
		case 'slopes':
			return runWithAdapter<SlopeSnapshot>(input, deps, {
				parser: { name: 'levi.slopes', parse: parseSlopeResponse },
				normalizer: { name: 'levi.slopes.normalize', normalize: normalizeSlopes },
				fieldKeys: ['open_piste_count', 'total_piste_count', 'operating_status']
			});
	}
}
