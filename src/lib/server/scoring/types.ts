/**
 * Domain contracts for the scoring layer (dynamic Conditions Score + permanent Resort Rating).
 *
 * Layer rules (see docs/architecture/decisions/0009-scoring-boundaries.md):
 * - Pure server domain code: no DB, no SvelteKit, no network, no clocks or randomness.
 * - Missing, stale or invalid data stays explicit: it is never silently zero-filled.
 * - Conditions Score, Resort Rating and any external rating/review concept are three
 *   separate concerns; nothing in this layer reads or exposes external ratings or reviews.
 *
 * Timestamps are ISO-8601 strings in UTC (the same convention as the collection pipeline).
 * `observedAt` describes when the value was observed/valid at the source, so freshness can
 * always be recomputed at any `asOf` clock instead of being persisted.
 */

/**
 * Runtime tuple so the union type and the config-validation list can never drift apart.
 * The order is the canonical display/computation order.
 */
export const CONDITIONS_COMPONENT_IDS = [
	'snow_depth',
	'recent_snow',
	'forecast_snow',
	'terrain_open_ratio',
	'lifts_open_ratio',
	'temperature',
	'wind',
	'snow_quality'
] as const;

export type ConditionsComponentId = (typeof CONDITIONS_COMPONENT_IDS)[number];

/** Categorical snow quality observed on site (null = not observed anywhere yet). */
export const SNOW_QUALITY_VALUES = [
	'powder',
	'packed_powder',
	'piste',
	'icy',
	'slush',
	'spring'
] as const;

export type SnowQuality = (typeof SNOW_QUALITY_VALUES)[number];

/** One numeric component observation. `value: null` means the datum is missing at the source. */
export interface NumericComponentInput {
	readonly value: number | null;
	/** Source observation/valid time; null when the source provides no reference time. */
	readonly observedAt: string | null;
}

/**
 * Open/total counts for a ratio component. The ratio is *not* pre-divided: the scoring
 * layer owns the division guards, because `total: 0`/`total: null` must degrade to an
 * unavailable component (a coverage hit), never to 0.
 */
export interface RatioComponentInput {
	readonly open: number | null;
	readonly total: number | null;
	readonly observedAt: string | null;
}

/** Categorical component observation. Unknown categories are excluded, never guessed. */
export interface CategoricalComponentInput {
	readonly value: SnowQuality | null;
	readonly observedAt: string | null;
}

/**
 * The eight Conditions Score component inputs. Every field must be present (use null
 * values for missing data) so the result coverage is a statement about the world,
 * not about a partially built record.
 */
export interface ConditionsScoreInputs {
	readonly snowDepthCm: NumericComponentInput;
	readonly recentSnowCm: NumericComponentInput;
	readonly forecastSnowCm: NumericComponentInput;
	readonly terrainOpenRatio: RatioComponentInput;
	readonly liftsOpenRatio: RatioComponentInput;
	readonly temperatureC: NumericComponentInput;
	readonly windMs: NumericComponentInput;
	readonly snowQuality: CategoricalComponentInput;
}

/** Recomputed time state of one input relative to the `asOf` clock. */
export type ScoringFreshnessState = 'fresh' | 'stale' | 'unknown';

/**
 * Per-component outcome:
 * - `ok`          present, fresh, in range → contributes.
 * - `stale`       present but older than the staleness policy → excluded.
 * - `missing`     raw value null, uncomputable ratio, or unusable observation time → excluded.
 * - `out_of_range` present but outside the plausible range / non-finite → excluded and
 *                 blocks publication (inconsistent input, ADR-0009).
 */
export type ScoringComponentStatus = 'ok' | 'stale' | 'missing' | 'out_of_range';

/** How the normalization band moves with the input (metadata for explainability). */
export type ScoreDirection = 'higher_is_better' | 'lower_is_better' | 'non_monotonic';

/**
 * Stable, language-independent explanation message. `key` + `params` are handed to the
 * i18n layer; no user-facing prose may be embedded in the scoring layer itself.
 */
export interface ScoringExplanationMessage {
	readonly key: string;
	/** Component/category id the message is about, or null for result-level messages. */
	readonly subjectId: string | null;
	readonly params: Readonly<Record<string, string | number>>;
}

/** Injected clock. Production callers pass `() => new Date()`; tests pin an instant. */
export interface ScoringComputeOptions {
	readonly now: () => Date;
}

export interface ConditionsScoreComponentResult {
	readonly id: ConditionsComponentId;
	readonly weight: number;
	/**
	 * Weight share of the weights actually used (available weight sum). 0 for components
	 * that did not contribute. With full coverage this equals the component weight.
	 */
	readonly shareOfWeights: number;
	readonly input: {
		/** Raw observation as evaluated: numeric value, ratio (open/total), or category string. */
		readonly raw: number | string | null;
		readonly observedAt: string | null;
		readonly freshnessState: ScoringFreshnessState;
	};
	readonly normalized: number | null;
	readonly direction: ScoreDirection;
	readonly contribution: number | null;
	readonly points: number | null;
	readonly status: ScoringComponentStatus;
	readonly reasons: readonly ScoringExplanationMessage[];
}

export interface ConditionsScoreCoverage {
	readonly availableComponentCount: number;
	readonly totalComponentCount: number;
	/** Available weight share in [0, 1]; the publish gate compares against this. */
	readonly availableWeightShare: number;
	readonly publishThreshold: number;
}

export interface ConditionsScoreExplanation {
	readonly type: 'conditions_score_explanation';
	readonly version: string;
	readonly score: number | null;
	readonly published: boolean;
	readonly computedAt: string;
	readonly coverage: ConditionsScoreCoverage;
	readonly gate: { readonly passed: boolean; readonly reasonKeys: readonly string[] };
	readonly components: readonly {
		readonly id: ConditionsComponentId;
		readonly weight: number;
		readonly status: ScoringComponentStatus;
		readonly normalized: number | null;
		readonly contribution: number | null;
		readonly points: number | null;
		readonly reasons: readonly ScoringExplanationMessage[];
	}[];
	readonly missingComponentIds: readonly ConditionsComponentId[];
	readonly unavailableComponentIds: readonly ConditionsComponentId[];
	readonly staleComponentIds: readonly ConditionsComponentId[];
	readonly outOfRangeComponentIds: readonly ConditionsComponentId[];
	readonly warnings: readonly ScoringExplanationMessage[];
}

export interface ConditionsScoreResult {
	/**
	 * 0–100 conditions score, or null. Null whenever publication is blocked by the
	 * coverage gate; numeric (with `published: false`) when only out-of-range inputs
	 * block publication. See docs/scoring.md for the exact policy.
	 */
	readonly score: number | null;
	readonly published: boolean;
	readonly version: string;
	readonly computedAt: string;
	readonly coverage: ConditionsScoreCoverage;
	readonly components: readonly ConditionsScoreComponentResult[];
	/** Components whose input value was missing (null/uncomputable). */
	readonly missingComponentIds: readonly ConditionsComponentId[];
	/** Subset of missing components whose ratio was undefined (unknown/zero totals). */
	readonly unavailableComponentIds: readonly ConditionsComponentId[];
	readonly staleComponentIds: readonly ConditionsComponentId[];
	readonly outOfRangeComponentIds: readonly ConditionsComponentId[];
	readonly warnings: readonly ScoringExplanationMessage[];
	/** Machine-readable, i18n-safe explanation derived from this exact result. */
	explanation(): ConditionsScoreExplanation;
}

/** Permanent Resort Rating category ids (Master Product Context, seven categories). */
export const RESORT_RATING_CATEGORY_IDS = [
	'atmosphere_environment',
	'slopes',
	'lifts',
	'off_piste',
	'accommodation',
	'food',
	'apres_ski'
] as const;

export type ResortRatingCategoryId = (typeof RESORT_RATING_CATEGORY_IDS)[number];

/** Category values live on the internal 0–100 computation scale (see config/docs). */
export type ResortRatingInputCategoryValues = Partial<
	Record<ResortRatingCategoryId, number | null>
>;

export interface ResortRatingCategoryResult {
	readonly id: ResortRatingCategoryId;
	readonly weight: number;
	readonly value: number | null;
	readonly contribution: number | null;
	readonly status: 'ok' | 'missing';
	readonly reasons: readonly ScoringExplanationMessage[];
}

export interface ResortRatingCoverage {
	readonly availableCategoryCount: number;
	readonly totalCategoryCount: number;
	/** Available weight share in [0, 1]; the publish gate compares against this. */
	readonly coverageShare: number;
	readonly coverageThreshold: number;
}

export interface ResortRatingExplanation {
	readonly type: 'resort_rating_explanation';
	readonly version: string;
	readonly rating: number | null;
	readonly published: boolean;
	readonly computedAt: string;
	readonly coverage: ResortRatingCoverage;
	readonly gate: { readonly passed: boolean; readonly reasonKeys: readonly string[] };
	readonly categories: readonly {
		readonly id: ResortRatingCategoryId;
		readonly weight: number;
		readonly value: number | null;
		readonly contribution: number | null;
		readonly status: 'ok' | 'missing';
		readonly reasons: readonly ScoringExplanationMessage[];
	}[];
	readonly missingCategoryIds: readonly ResortRatingCategoryId[];
	readonly ignoredInputKeys: readonly string[];
	readonly warnings: readonly ScoringExplanationMessage[];
}

export interface ResortRatingResult {
	/** 0–100 weighted mean, or null when publication is blocked by the coverage gate. */
	readonly rating: number | null;
	readonly published: boolean;
	readonly version: string;
	readonly computedAt: string;
	readonly coverage: ResortRatingCoverage;
	readonly categories: readonly ResortRatingCategoryResult[];
	readonly missingCategoryIds: readonly ResortRatingCategoryId[];
	/**
	 * Non-category keys found in the input (e.g. foreign review payloads). They are
	 * reported here for explicitness and can never influence the rating: structural
	 * separation from external ratings/reviews.
	 */
	readonly ignoredInputKeys: readonly string[];
	readonly warnings: readonly ScoringExplanationMessage[];
	/** Machine-readable, i18n-safe explanation derived from this exact result. */
	explanation(): ResortRatingExplanation;
}
