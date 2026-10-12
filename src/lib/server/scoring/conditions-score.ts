/**
 * Pure, deterministic Conditions Score computation (ADR-0009).
 *
 * Rules encoded here:
 * - Missing (null/uncomputable) and stale (older than per-component policy vs. the
 *   injected asOf clock) inputs are EXCLUDED from the weighted sum; the score is
 *   computed over available weights only and the coverage share is reported explicitly.
 * - Out-of-range inputs are excluded AND block publication (inconsistent input).
 * - Below the coverage gate: score = null, published = false, explicit reason keys.
 * - At/above the gate: the numeric score is returned; `published = true` only when no
 *   out-of-range inputs exist. Staleness alone downgrades to warnings, per docs/scoring.md.
 * - No Date.now, no Math.random, no globals, no mutation of inputs (deep-freeze safe).
 */
import {
	resolveConditionsScoreConfig,
	type ConditionsComponentConfig,
	type ConditionsScoreConfig
} from './config.js';
import type {
	CategoricalComponentInput,
	ConditionsComponentId,
	ConditionsScoreComponentResult,
	ConditionsScoreExplanation,
	ConditionsScoreInputs,
	ConditionsScoreResult,
	NumericComponentInput,
	RatioComponentInput,
	ScoringComponentStatus,
	ScoringExplanationMessage,
	ScoringFreshnessState
} from './types.js';
import type { ScoringComputeOptions } from './types.js';
import {
	clip,
	dedupeComponentIds,
	dedupeStrings,
	evaluatedStatusToMissing,
	piecewiseLinear,
	round4
} from './scoring-math.js';

const FUTURE_SKEW_TOLERANCE_MS = 5 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reason(
	key: string,
	subjectId: string | null,
	params: Record<string, string | number> = {}
): ScoringExplanationMessage {
	return Object.freeze({ key, subjectId, params: Object.freeze({ ...params }) });
}

interface FreshnessOutcome {
	readonly state: ScoringFreshnessState;
	/** False when the observation time is missing or inconsistent (in the future). */
	readonly observedAtUsable: boolean;
	readonly ageHours: number | null;
}

function evaluateFreshness(
	observedAt: string | null,
	maxAgeHours: number,
	maximumStalenessHours: number,
	asOfMs: number
): FreshnessOutcome {
	if (typeof observedAt !== 'string' || observedAt.trim() === '') {
		return { state: 'unknown', observedAtUsable: false, ageHours: null };
	}
	const observedMs = Date.parse(observedAt);
	if (!Number.isFinite(observedMs)) {
		return { state: 'unknown', observedAtUsable: false, ageHours: null };
	}
	const ageMs = asOfMs - observedMs;
	if (ageMs < -FUTURE_SKEW_TOLERANCE_MS) {
		// Observation stamped in the future relative to asOf is inconsistent.
		return { state: 'unknown', observedAtUsable: false, ageHours: null };
	}
	const ageHours = ageMs < 0 ? 0 : ageMs / 3_600_000;
	// Cross-component ceiling: the per-component effective limit is the tighter of the
	// component staleness policy and the version's global maximumStalenessHours gate.
	const effectiveLimit = Math.min(maxAgeHours, maximumStalenessHours);
	return {
		state: ageHours <= effectiveLimit ? 'fresh' : 'stale',
		observedAtUsable: true,
		ageHours: round4(ageHours)
	};
}

interface EvaluationOutcome {
	readonly status: ScoringComponentStatus;
	readonly freshnessState: ScoringFreshnessState;
	readonly raw: number | string | null;
	readonly reasons: readonly ScoringExplanationMessage[];
}

function stalenessReason(
	freshness: FreshnessOutcome,
	component: ConditionsComponentConfig,
	maximumStalenessHours: number
): ScoringExplanationMessage | null {
	if (freshness.state !== 'stale') return null;
	return reason('scoring_input_stale', component.id, {
		maxAgeHours: Math.min(component.maxAgeHours, maximumStalenessHours),
		ageHours: freshness.ageHours ?? 0
	});
}

function evaluateNumeric(
	component: ConditionsComponentConfig,
	maximumStalenessHours: number,
	input: NumericComponentInput,
	asOfMs: number
): EvaluationOutcome {
	const freshness = evaluateFreshness(
		input.observedAt,
		component.maxAgeHours,
		maximumStalenessHours,
		asOfMs
	);
	const params = { min: component.validRange.min, max: component.validRange.max };

	if (input.value === null) {
		return {
			status: 'missing',
			freshnessState: freshness.observedAtUsable ? freshness.state : 'unknown',
			raw: null,
			reasons: [reason('scoring_missing_input', component.id, params)]
		};
	}
	if (
		input.value === undefined ||
		typeof input.value !== 'number' ||
		!Number.isFinite(input.value)
	) {
		return {
			status: 'missing',
			freshnessState: freshness.observedAtUsable ? freshness.state : 'unknown',
			raw: null,
			reasons: [reason('scoring_input_unusable_value', component.id, params)]
		};
	}
	if (input.value < component.validRange.min || input.value > component.validRange.max) {
		return {
			status: 'out_of_range',
			freshnessState: freshness.observedAtUsable ? freshness.state : 'unknown',
			raw: input.value,
			reasons: [reason('scoring_input_out_of_range', component.id, params)]
		};
	}
	const staleReason = stalenessReason(freshness, component, maximumStalenessHours);
	return {
		status: freshness.state === 'stale' ? 'stale' : 'ok',
		freshnessState: freshness.state,
		raw: input.value,
		reasons: staleReason ? [staleReason] : []
	};
}

/**
 * Open/total with division guards. Unknown or zero totals are UNAVAILABLE (undefined
 * share → coverage hit), never 0. Zero pistes open with a positive total is a
 * legitimate 0 that scores as 0.
 */
function evaluateRatio(
	component: ConditionsComponentConfig,
	maximumStalenessHours: number,
	input: RatioComponentInput,
	asOfMs: number
): EvaluationOutcome {
	const freshness = evaluateFreshness(
		input.observedAt,
		component.maxAgeHours,
		maximumStalenessHours,
		asOfMs
	);
	const missingState: ScoringFreshnessState = freshness.observedAtUsable
		? freshness.state
		: 'unknown';

	if (
		typeof input.total !== 'number' ||
		!Number.isFinite(input.total) ||
		input.total === undefined
	) {
		return {
			status: 'missing',
			freshnessState: missingState,
			raw: null,
			reasons: [reason('scoring_ratio_total_unknown', component.id)]
		};
	}
	if (input.total < 0) {
		// A negative total is inconsistent data, not an unknown share.
		return {
			status: 'out_of_range',
			freshnessState: missingState,
			raw: input.total,
			reasons: [reason('scoring_input_out_of_range', component.id, { min: 0, max: input.total })]
		};
	}
	if (input.total === 0) {
		return {
			status: 'missing',
			freshnessState: missingState,
			raw: null,
			reasons: [reason('scoring_ratio_total_zero', component.id)]
		};
	}
	if (input.open === null) {
		return {
			status: 'missing',
			freshnessState: missingState,
			raw: null,
			reasons: [reason('scoring_ratio_open_unknown', component.id)]
		};
	}
	if (
		typeof input.open !== 'number' ||
		!Number.isFinite(input.open) ||
		input.open < 0 ||
		input.open > input.total
	) {
		return {
			status: 'out_of_range',
			freshnessState: missingState,
			raw: input.open,
			reasons: [reason('scoring_input_out_of_range', component.id, { min: 0, max: input.total })]
		};
	}
	const staleReason = stalenessReason(freshness, component, maximumStalenessHours);
	return {
		status: freshness.state === 'stale' ? 'stale' : 'ok',
		freshnessState: freshness.state,
		raw: input.open / input.total,
		reasons: staleReason ? [staleReason] : []
	};
}

/** Categorical inputs: unknown category values are excluded, never guessed. */
function evaluateCategorical(
	component: ConditionsComponentConfig,
	maximumStalenessHours: number,
	input: CategoricalComponentInput,
	asOfMs: number
): EvaluationOutcome {
	const freshness = evaluateFreshness(
		input.observedAt,
		component.maxAgeHours,
		maximumStalenessHours,
		asOfMs
	);
	const missingState: ScoringFreshnessState = freshness.observedAtUsable
		? freshness.state
		: 'unknown';

	if (input.value === null) {
		return {
			status: 'missing',
			freshnessState: missingState,
			raw: null,
			reasons: [reason('scoring_missing_input', component.id)]
		};
	}
	if (component.normalization.kind !== 'categorical') {
		return {
			status: 'missing',
			freshnessState: missingState,
			raw: input.value,
			reasons: [reason('scoring_missing_input', component.id)]
		};
	}
	const factor = component.normalization.table[input.value];
	if (typeof factor !== 'number') {
		return {
			status: 'missing',
			freshnessState: missingState,
			raw: input.value,
			reasons: [reason('scoring_category_unknown', component.id, { value: String(input.value) })]
		};
	}
	const staleReason = stalenessReason(freshness, component, maximumStalenessHours);
	return {
		status: freshness.state === 'stale' ? 'stale' : 'ok',
		freshnessState: freshness.state,
		raw: input.value,
		reasons: staleReason ? [staleReason] : []
	};
}

function normalizeValue(
	component: ConditionsComponentConfig,
	raw: number | string | null
): number | null {
	if (component.normalization.kind === 'categorical') {
		if (typeof raw !== 'string') return null;
		const factor = component.normalization.table[raw as keyof typeof component.normalization.table];
		if (typeof factor !== 'number') return null;
		return round4(clip(factor, component.clip));
	}
	if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
	return round4(clip(piecewiseLinear(component.normalization.points, raw), component.clip));
}

interface EvaluatedComponent {
	readonly component: ConditionsComponentConfig;
	status: ScoringComponentStatus;
	readonly freshnessState: ScoringFreshnessState;
	readonly observedAt: string | null;
	readonly raw: number | string | null;
	reasons: ScoringExplanationMessage[];
	normalized: number | null;
}

function evaluateComponents(
	config: ConditionsScoreConfig,
	inputs: ConditionsScoreInputs,
	asOfMs: number
): Map<ConditionsComponentId, EvaluatedComponent> {
	const maximumStalenessHours = config.gates.maximumStalenessHours;
	const rawInputs: Record<ConditionsComponentId, unknown> = {
		snow_depth: inputs.snowDepthCm,
		recent_snow: inputs.recentSnowCm,
		forecast_snow: inputs.forecastSnowCm,
		terrain_open_ratio: inputs.terrainOpenRatio,
		lifts_open_ratio: inputs.liftsOpenRatio,
		temperature: inputs.temperatureC,
		wind: inputs.windMs,
		snow_quality: inputs.snowQuality
	};

	const evaluated = new Map<ConditionsComponentId, EvaluatedComponent>();
	for (const component of config.components) {
		const raw = rawInputs[component.id];
		if (!isRecord(raw)) {
			// Field absent from the record: structurally missing, never zero-filled.
			evaluated.set(component.id, {
				component,
				status: 'missing',
				freshnessState: 'unknown',
				observedAt: null,
				raw: null,
				reasons: [reason('scoring_missing_input', component.id)],
				normalized: null
			});
			continue;
		}
		const input = raw as {
			open?: unknown;
			total?: unknown;
			value?: unknown;
			observedAt?: unknown;
		};
		let outcome: EvaluationOutcome;
		if ('open' in input || 'total' in input) {
			outcome = evaluateRatio(
				component,
				maximumStalenessHours,
				input as RatioComponentInput,
				asOfMs
			);
		} else {
			const value = (input as { value?: unknown }).value;
			outcome =
				typeof value === 'string'
					? evaluateCategorical(
							component,
							maximumStalenessHours,
							input as CategoricalComponentInput,
							asOfMs
						)
					: evaluateNumeric(
							component,
							maximumStalenessHours,
							input as NumericComponentInput,
							asOfMs
						);
		}
		evaluated.set(component.id, {
			component,
			status: outcome.status,
			freshnessState: outcome.freshnessState,
			observedAt:
				typeof (input as { observedAt?: unknown }).observedAt === 'string'
					? ((input as { observedAt: string }).observedAt as string)
					: null,
			raw: outcome.raw,
			reasons: [...outcome.reasons],
			normalized: null
		});
	}
	return evaluated;
}

function buildComponents(
	config: ConditionsScoreConfig,
	evaluated: Map<ConditionsComponentId, EvaluatedComponent>,
	availableWeightSum: number
): ConditionsScoreComponentResult[] {
	const results: ConditionsScoreComponentResult[] = [];
	for (const component of config.components) {
		const item = evaluated.get(component.id);
		if (!item) continue;
		let normalized: number | null = null;
		let contribution: number | null = null;
		let points: number | null = null;
		let shareOfWeights = 0;
		if (item.status === 'ok') {
			normalized = normalizeValue(component, item.raw);
			if (normalized === null) {
				// Defensive: an ok component failed to normalize — downgrade to missing.
				item.status = 'missing';
				item.reasons = [...item.reasons, reason('scoring_missing_input', component.id)];
				normalized = null;
			} else {
				shareOfWeights = round4(availableWeightSum > 0 ? component.weight / availableWeightSum : 0);
				contribution = normalized;
				points = round4((normalized * component.weight * 100) / availableWeightSum);
			}
		}
		results.push({
			id: component.id,
			weight: component.weight,
			shareOfWeights,
			input: {
				raw: item.raw,
				observedAt: item.observedAt,
				freshnessState: item.freshnessState
			},
			normalized,
			direction: component.direction,
			contribution,
			points,
			status: item.status,
			reasons: item.reasons
		});
	}
	return results;
}

interface ResultParts {
	readonly config: ConditionsScoreConfig;
	readonly computedAt: string;
	readonly score: number | null;
	readonly published: boolean;
	readonly coverageShare: number;
	readonly gatePassed: boolean;
	readonly componentResults: ConditionsScoreComponentResult[];
	readonly missingIds: readonly ConditionsComponentId[];
	readonly unavailableIds: readonly ConditionsComponentId[];
	readonly staleIds: readonly ConditionsComponentId[];
	readonly outOfRangeIds: readonly ConditionsComponentId[];
	readonly warnings: readonly ScoringExplanationMessage[];
}

function buildResult(parts: ResultParts): ConditionsScoreResult {
	const { config } = parts;
	const componentIds = config.components.map(
		(component) => component.id
	) as ConditionsComponentId[];

	const result: ConditionsScoreResult = {
		score: parts.score,
		published: parts.published,
		version: config.versionId,
		computedAt: parts.computedAt,
		coverage: {
			availableComponentCount: parts.componentResults.filter((c) => c.status === 'ok').length,
			totalComponentCount: componentIds.length,
			availableWeightShare: parts.coverageShare,
			publishThreshold: config.gates.minimumCoverageShare
		},
		components: parts.componentResults,
		missingComponentIds: parts.missingIds,
		unavailableComponentIds: parts.unavailableIds,
		staleComponentIds: parts.staleIds,
		outOfRangeComponentIds: parts.outOfRangeIds,
		warnings: parts.warnings,
		explanation(): ConditionsScoreExplanation {
			const gateReasonKeys: string[] = [];
			if (!parts.gatePassed) gateReasonKeys.push('scoring_coverage_below_threshold');
			if (parts.outOfRangeIds.length > 0) gateReasonKeys.push('scoring_out_of_range_block');
			return {
				type: 'conditions_score_explanation',
				version: config.versionId,
				score: result.score,
				published: result.published,
				computedAt: result.computedAt,
				coverage: result.coverage,
				gate: {
					passed: parts.gatePassed,
					reasonKeys: dedupeStrings(gateReasonKeys)
				},
				components: parts.componentResults.map((component) => ({
					id: component.id,
					weight: component.weight,
					status: component.status,
					normalized: component.normalized,
					contribution: component.contribution,
					points: component.points,
					reasons: component.reasons
				})),
				missingComponentIds: result.missingComponentIds,
				unavailableComponentIds: result.unavailableComponentIds,
				staleComponentIds: result.staleComponentIds,
				outOfRangeComponentIds: result.outOfRangeComponentIds,
				warnings: result.warnings
			};
		}
	};
	return result;
}

export function computeConditionsScore(
	inputs: ConditionsScoreInputs,
	versionId: string | undefined,
	options: ScoringComputeOptions
): ConditionsScoreResult {
	if (!isRecord(options) || typeof options.now !== 'function') {
		throw new Error('scoring_compute_requires_injected_clock');
	}
	const config = resolveConditionsScoreConfig(versionId);
	const asOf = options.now();
	const asOfMs = asOf.getTime();
	if (!Number.isFinite(asOfMs)) throw new Error('scoring_clock_invalid');

	const evaluated = evaluateComponents(config, inputs, asOfMs);

	const totalWeight = config.components.reduce((sum, c) => sum + c.weight, 0);
	let availableWeightSum = 0;
	for (const item of evaluated.values()) {
		if (item.status === 'ok') availableWeightSum += item.component.weight;
	}

	const coverageShare = totalWeight > 0 ? availableWeightSum / totalWeight : 0;
	const roundedShare = round4(coverageShare);
	const gatePassed = coverageShare >= config.gates.minimumCoverageShare;

	const statusIds = (status: ScoringComponentStatus): ConditionsComponentId[] =>
		[...evaluated.entries()].filter(([, item]) => item.status === status).map(([id]) => id);

	const outOfRangeIds = dedupeComponentIds(statusIds('out_of_range'));
	const staleIds = dedupeComponentIds(statusIds('stale'));
	let missingIds = dedupeComponentIds(statusIds('missing'));
	const unavailableIds = missingIds.filter((id) => {
		const item = evaluated.get(id);
		return Boolean(
			item?.reasons.some(
				(entry) =>
					entry.key === 'scoring_ratio_total_unknown' || entry.key === 'scoring_ratio_total_zero'
			)
		);
	});

	const componentResults = buildComponents(config, evaluated, availableWeightSum);
	missingIds = evaluatedStatusToMissing(componentResults);

	const warnings: ScoringExplanationMessage[] = [];
	for (const id of staleIds) warnings.push(reason('scoring_stale_component_excluded', id));
	for (const id of missingIds) warnings.push(reason('scoring_missing_component_excluded', id));
	// Freshness-unknown inputs that still contribute must stay explicit (ADR-0009).
	for (const component of componentResults) {
		if (component.status === 'ok' && component.input.freshnessState === 'unknown') {
			warnings.push(reason('scoring_freshness_unknown', component.id));
		}
	}

	if (!gatePassed) {
		// Conservative policy (docs/scoring.md): below the publish threshold → no score.
		return buildResult({
			config,
			computedAt: asOf.toISOString(),
			score: null,
			published: false,
			coverageShare: roundedShare,
			gatePassed: false,
			componentResults,
			missingIds,
			unavailableIds,
			staleIds,
			outOfRangeIds,
			warnings: [
				...warnings,
				reason('scoring_coverage_below_threshold', null, {
					coverageShare: roundedShare,
					threshold: config.gates.minimumCoverageShare
				})
			]
		});
	}

	const weightedSum = componentResults.reduce(
		(sum, component) =>
			sum +
			(component.normalized !== null && component.status === 'ok'
				? component.normalized * component.weight
				: 0),
		0
	);
	const scaleSpan = config.computationScale.max - config.computationScale.min;
	const scoreValue =
		availableWeightSum > 0
			? round4((weightedSum / availableWeightSum) * scaleSpan + config.computationScale.min)
			: null;

	if (outOfRangeIds.length > 0) {
		// Inconsistent inputs block publication but the score is kept for auditability.
		const rangeWarnings = outOfRangeIds.map((id) =>
			reason('scoring_out_of_range_block', id, {
				min: evaluated.get(id)?.component.validRange.min ?? 0,
				max: evaluated.get(id)?.component.validRange.max ?? 1
			})
		);
		return buildResult({
			config,
			computedAt: asOf.toISOString(),
			score: scoreValue,
			published: false,
			coverageShare: roundedShare,
			gatePassed: true,
			componentResults,
			missingIds,
			unavailableIds,
			staleIds,
			outOfRangeIds,
			warnings: [...warnings, ...rangeWarnings]
		});
	}

	return buildResult({
		config,
		computedAt: asOf.toISOString(),
		score: scoreValue,
		published: true,
		coverageShare: roundedShare,
		gatePassed: true,
		componentResults,
		missingIds,
		unavailableIds,
		staleIds,
		outOfRangeIds,
		warnings
	});
}
