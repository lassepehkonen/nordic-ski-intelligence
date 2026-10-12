/**
 * Versioned, frozen, immutable scoring configuration registry.
 *
 * Version-bump policy (binding for future changes):
 * - Any change to a weight, direction, valid range, clip range, normalization band,
 *   staleness limit, gate threshold or the forecast window creates a NEW version id
 *   (e.g. "v1.1") and the previous version stays registered as-is.
 * - Old versions are never mutated or removed, so every stored condition_score row and
 *   resort rating remains interpretable for its lifetime (ADR-0009).
 * - The active pointer switches only together with a documentation update in
 *   docs/scoring.md and tests pinning the new values.
 * - Resolve functions never fall back silently: an unknown or invalid version is an
 *   explicit ScoringConfigError.
 *
 * Internal computation scale for both scores is 0–100 ("points"). Conditions Score and
 * Resort Rating share the scale convention but nothing else — they are independent
 * concepts (ADR-0009) and never mixed.
 */
import type {
	ConditionsComponentId,
	ResortRatingCategoryId,
	ScoreDirection,
	SnowQuality
} from './types.js';

/** Explicit error for unknown/invalid versions and invalid configurations. */
export class ScoringConfigError extends Error {
	/** Stable machine-readable reason keys, never user-facing prose. */
	readonly reasonKeys: readonly string[];

	constructor(reasonKeys: readonly string[], message?: string) {
		super(message ?? `scoring_config_error: ${reasonKeys.join(', ')}`);
		this.name = 'ScoringConfigError';
		this.reasonKeys = reasonKeys;
	}
}

export interface LinearBandPoint {
	/** Input value at which the band yields `y`. Points must be strictly increasing in x. */
	readonly x: number;
	/** Normalized 0–1 quality at that input. */
	readonly y: number;
}

export interface PiecewiseLinearNormalization {
	readonly kind: 'piecewise_linear';
	readonly points: readonly LinearBandPoint[];
}

export interface CategoricalNormalization {
	readonly kind: 'categorical';
	readonly table: Readonly<Record<SnowQuality, number>>;
}

export type NormalizationSpec = PiecewiseLinearNormalization | CategoricalNormalization;

/**
 * Plausible physical range for a raw input. Inputs outside it are `out_of_range`:
 * excluded from the score and blocking publication (inconsistent input, ADR-0009).
 */
export interface PlausibleRange {
	readonly min: number;
	readonly max: number;
}

/** Normalized values are clipped to this internal 0–1 band after mapping. */
export interface ClipRange {
	readonly min: number;
	readonly max: number;
}

export interface ConditionsComponentConfig {
	readonly id: ConditionsComponentId;
	readonly weight: number;
	readonly direction: ScoreDirection;
	readonly validRange: PlausibleRange;
	readonly clip: ClipRange;
	readonly normalization: NormalizationSpec;
	/**
	 * Staleness policy: an observedAt older than this many hours vs. the injected asOf
	 * clock marks the input `stale` and excludes it. Missing-input data never becomes 0.
	 * Inputs with no usable observation time are not age-gated; instead the result
	 * reports a freshness warning (`scoring_freshness_unknown`) because the layer has no
	 * retrieval timestamp to compare against.
	 */
	readonly maxAgeHours: number;
	/**
	 * Only supported policy in v1.0: missing/stale/unavailable inputs are excluded from
	 * the weighted sum and reported. Zero-filling is explicitly forbidden (ADR-0009).
	 */
	readonly missingInputPolicy: 'exclude';
}

export interface ScoringGates {
	/**
	 * Publication gate: the score publishes only when the available weight share (after
	 * excluding missing/stale/out-of-range inputs) is >= this threshold.
	 */
	readonly minimumCoverageShare: number;
	/** Cross-component guard: nothing older than this horizon may influence a published score. */
	readonly maximumStalenessHours: number;
}

export interface ScoreComputationScale {
	readonly min: number;
	readonly max: number;
}

export interface ConditionsScoreConfig {
	readonly kind: 'conditions_score';
	readonly versionId: string;
	readonly computationScale: ScoreComputationScale;
	/** Forecast accumulation window (hours after asOf) for the forecast_snow component. */
	readonly forecastWindowHours: number;
	readonly gates: ScoringGates;
	readonly components: readonly ConditionsComponentConfig[];
}

export interface ResortRatingCategoryConfig {
	readonly id: ResortRatingCategoryId;
	readonly weight: number;
}

export interface ResortRatingConfig {
	readonly kind: 'resort_rating';
	readonly versionId: string;
	readonly computationScale: ScoreComputationScale;
	/**
	 * Publication gate for the permanent rating: values are weighted across the provided
	 * categories; below this coverage share the rating stays unpublished (null).
	 */
	readonly gates: { readonly minimumCategoryCoverageShare: number };
	readonly categories: readonly ResortRatingCategoryConfig[];
}

/** Sum tolerance for weight validation (floating point safe, 1e-9). */
const WEIGHT_SUM_EPSILON = 1e-9;

const DIRECT_RATIO_BANDS: PiecewiseLinearNormalization = {
	kind: 'piecewise_linear',
	points: [
		{ x: 0, y: 0 },
		{ x: 1, y: 1 }
	]
};

/**
 * Conditions Score v1.0 bands encode Nordic operating reality:
 * - Snow depth: bare ground scores 0, ~90 cm+ is ideal; deep base matters beyond piste depth.
 * - Recent snow: fresh snow raises quality quickly but saturates (20 cm+ ≈ best).
 * - Forecast snow: same shape, softer ceiling — a promise, not a measurement.
 * - Terrain/lift ratios: linear 0–1; both are normalized shares by definition.
 * - Temperature: peak comfort around -12..0 °C, penalties below -25 °C and above +8 °C,
 *   and no skiing value in warm rain territory (+15 °C+).
 * - Wind: lifts typically stop in the 12–15 m/s range; 15 m/s+ scores 0.
 */
const CONDITIONS_SCORE_V1_0: ConditionsScoreConfig = {
	kind: 'conditions_score',
	versionId: 'v1.0',
	computationScale: { min: 0, max: 100 },
	forecastWindowHours: 48,
	gates: { minimumCoverageShare: 0.6, maximumStalenessHours: 24 },
	components: [
		{
			id: 'snow_depth',
			weight: 0.1,
			direction: 'higher_is_better',
			validRange: { min: 0, max: 600 },
			clip: { min: 0, max: 1 },
			normalization: {
				kind: 'piecewise_linear',
				points: [
					{ x: 0, y: 0 },
					{ x: 30, y: 0.4 },
					{ x: 60, y: 0.7 },
					{ x: 90, y: 1 },
					{ x: 120, y: 1 }
				]
			},
			maxAgeHours: 72,
			missingInputPolicy: 'exclude'
		},
		{
			id: 'recent_snow',
			weight: 0.15,
			direction: 'higher_is_better',
			validRange: { min: 0, max: 200 },
			clip: { min: 0, max: 1 },
			normalization: {
				kind: 'piecewise_linear',
				points: [
					{ x: 0, y: 0.35 },
					{ x: 2, y: 0.65 },
					{ x: 5, y: 0.78 },
					{ x: 10, y: 0.9 },
					{ x: 20, y: 1 }
				]
			},
			maxAgeHours: 36,
			missingInputPolicy: 'exclude'
		},
		{
			id: 'forecast_snow',
			weight: 0.1,
			direction: 'higher_is_better',
			validRange: { min: 0, max: 400 },
			clip: { min: 0, max: 1 },
			normalization: {
				kind: 'piecewise_linear',
				points: [
					{ x: 0, y: 0.35 },
					{ x: 2, y: 0.6 },
					{ x: 5, y: 0.78 },
					{ x: 10, y: 0.92 },
					{ x: 20, y: 1 }
				]
			},
			// Forecast points are model outputs; the collected run refreshes them well within this.
			maxAgeHours: 48,
			missingInputPolicy: 'exclude'
		},
		{
			id: 'terrain_open_ratio',
			weight: 0.2,
			direction: 'higher_is_better',
			validRange: { min: 0, max: 1 },
			clip: { min: 0, max: 1 },
			normalization: DIRECT_RATIO_BANDS,
			maxAgeHours: 168,
			missingInputPolicy: 'exclude'
		},
		{
			id: 'lifts_open_ratio',
			weight: 0.15,
			direction: 'higher_is_better',
			validRange: { min: 0, max: 1 },
			clip: { min: 0, max: 1 },
			normalization: DIRECT_RATIO_BANDS,
			maxAgeHours: 168,
			missingInputPolicy: 'exclude'
		},
		{
			id: 'temperature',
			weight: 0.15,
			direction: 'non_monotonic',
			validRange: { min: -60, max: 60 },
			clip: { min: 0, max: 1 },
			normalization: {
				kind: 'piecewise_linear',
				points: [
					{ x: -30, y: 0 },
					{ x: -25, y: 0.1 },
					{ x: -18, y: 0.55 },
					{ x: -12, y: 1 },
					{ x: -2, y: 1 },
					{ x: 0, y: 0.85 },
					{ x: 5, y: 0.6 },
					{ x: 8, y: 0.45 },
					{ x: 15, y: 0 }
				]
			},
			maxAgeHours: 12,
			missingInputPolicy: 'exclude'
		},
		{
			id: 'wind',
			weight: 0.1,
			direction: 'lower_is_better',
			validRange: { min: 0, max: 40 },
			clip: { min: 0, max: 1 },
			normalization: {
				kind: 'piecewise_linear',
				points: [
					{ x: 0, y: 1 },
					{ x: 8, y: 0.6 },
					{ x: 12, y: 0.35 },
					{ x: 15, y: 0 },
					{ x: 25, y: 0 }
				]
			},
			maxAgeHours: 12,
			missingInputPolicy: 'exclude'
		},
		{
			id: 'snow_quality',
			weight: 0.05,
			direction: 'higher_is_better',
			validRange: { min: 0, max: 1 },
			clip: { min: 0, max: 1 },
			normalization: {
				kind: 'categorical',
				table: {
					powder: 1,
					packed_powder: 0.9,
					piste: 0.65,
					spring: 0.45,
					slush: 0.25,
					icy: 0.1
				}
			},
			maxAgeHours: 72,
			missingInputPolicy: 'exclude'
		}
	]
};

/**
 * Resort Rating v1.0 — the seven permanent Master Product Context categories with the
 * exact initial weights (Atmosphere & Environment 15%, Slopes 25%, Lifts 15%,
 * Off-piste 20%, Accommodation 10%, Food 7.5%, Après-ski 7.5%).
 *
 * Category values are assessed on the internal 0–100 computation scale. The product
 * decision on editorial sourcing (who assesses what, with which evidence) stays open
 * per the domain model; the rating never reads reviews or external ratings.
 */
const RESORT_RATING_V1_0: ResortRatingConfig = {
	kind: 'resort_rating',
	versionId: 'v1.0',
	computationScale: { min: 0, max: 100 },
	gates: { minimumCategoryCoverageShare: 0.8 },
	categories: [
		{ id: 'atmosphere_environment', weight: 0.15 },
		{ id: 'slopes', weight: 0.25 },
		{ id: 'lifts', weight: 0.15 },
		{ id: 'off_piste', weight: 0.2 },
		{ id: 'accommodation', weight: 0.1 },
		{ id: 'food', weight: 0.075 },
		{ id: 'apres_ski', weight: 0.075 }
	]
};

/** Registered versions, newest-active pointer plus all kept interpretable versions. */
export const CONDITIONS_SCORE_VERSIONS: Readonly<
	Record<string, ConditionsScoreConfig | undefined>
> = Object.freeze({
	'v1.0': CONDITIONS_SCORE_V1_0
});

export const RESORT_RATING_VERSIONS: Readonly<Record<string, ResortRatingConfig | undefined>> =
	Object.freeze({
		'v1.0': RESORT_RATING_V1_0
	});

export const CONDITIONS_SCORE_ACTIVE_VERSION_ID = 'v1.0';
export const RESORT_RATING_ACTIVE_VERSION_ID = 'v1.0';

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const key of Object.getOwnPropertyNames(value as object)) {
			// Index signature keeps Readonly<Record<…>> assignments honest.
			deepFreeze((value as Record<string, unknown>)[key]);
		}
	}
	return value;
}

for (const config of [CONDITIONS_SCORE_V1_0, RESORT_RATING_V1_0]) deepFreeze(config);

/** Resolve a Conditions Score config. Unknown versions throw ScoringConfigError — never a fallback. */
export function resolveConditionsScoreConfig(versionId?: string): ConditionsScoreConfig {
	const requested = versionId ?? CONDITIONS_SCORE_ACTIVE_VERSION_ID;
	const config = CONDITIONS_SCORE_VERSIONS[requested];
	if (!config) {
		throw new ScoringConfigError(
			['scoring_conditions_version_unknown'],
			`Unknown conditions score config version: ${requested}`
		);
	}
	validateConfig(config);
	return config;
}

/** Resolve a Resort Rating config. Unknown versions throw ScoringConfigError — never a fallback. */
export function resolveResortRatingConfig(versionId?: string): ResortRatingConfig {
	const requested = versionId ?? RESORT_RATING_ACTIVE_VERSION_ID;
	const config = RESORT_RATING_VERSIONS[requested];
	if (!config) {
		throw new ScoringConfigError(
			['scoring_resort_rating_version_unknown'],
			`Unknown resort rating config version: ${requested}`
		);
	}
	validateConfig(config);
	return config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Registry-wide validation entry point. */
export function validateConfig(config: unknown): void {
	if (!isRecord(config)) throw new ScoringConfigError(['scoring_config_not_an_object']);
	if (config.kind === 'conditions_score') validateConditionsScoreConfig(config as never);
	else if (config.kind === 'resort_rating') validateResortRatingConfig(config as never);
	else throw new ScoringConfigError(['scoring_config_unknown_kind']);
}

/** Validates a Conditions Score config shape. Throws ScoringConfigError on any violation. */
export function validateConditionsScoreConfig(config: ConditionsScoreConfig): void {
	const reasons: string[] = [];
	const scale = config.computationScale;
	if (!isRecord(scale) || scale.min !== 0 || scale.max !== 100) {
		reasons.push('scoring_config_computation_scale_invalid');
	}
	if (
		typeof config.forecastWindowHours !== 'number' ||
		!Number.isFinite(config.forecastWindowHours) ||
		config.forecastWindowHours <= 0
	) {
		reasons.push('scoring_config_forecast_window_invalid');
	}
	const gates = config.gates;
	if (
		!isRecord(gates) ||
		typeof gates.minimumCoverageShare !== 'number' ||
		!Number.isFinite(gates.minimumCoverageShare) ||
		gates.minimumCoverageShare < 0 ||
		gates.minimumCoverageShare > 1
	) {
		reasons.push('scoring_config_gate_invalid');
	}
	if (
		isRecord(gates) &&
		(typeof gates.maximumStalenessHours !== 'number' ||
			!Number.isFinite(gates.maximumStalenessHours) ||
			gates.maximumStalenessHours <= 0)
	) {
		reasons.push('scoring_config_gate_invalid');
	}
	if (!Array.isArray(config.components) || config.components.length === 0) {
		reasons.push('scoring_config_components_empty');
	} else {
		const seen = new Set<string>();
		let weightSum = 0;
		for (const component of config.components as unknown[]) {
			if (!isRecord(component)) {
				reasons.push('scoring_config_component_not_an_object');
				continue;
			}
			const id = component.id;
			if (typeof id !== 'string' || seen.has(id)) {
				reasons.push('scoring_config_component_ids_not_unique');
			}
			seen.add(String(id));
			const weight = component.weight;
			if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
				reasons.push('scoring_config_weight_not_positive');
			} else {
				weightSum += weight;
			}
			validateComponentSpec(component as unknown, reasons);
		}
		if (Math.abs(weightSum - 1) > WEIGHT_SUM_EPSILON) {
			reasons.push('scoring_config_weights_do_not_sum_to_one');
		}
	}
	if (reasons.length > 0) throw new ScoringConfigError(reasons);
}

function validateComponentSpec(component: unknown, reasons: string[]): void {
	const spec = component as {
		validRange?: unknown;
		clip?: unknown;
		normalization?: unknown;
		maxAgeHours?: unknown;
		missingInputPolicy?: unknown;
	};
	const range = spec.validRange as PlausibleRange | undefined;
	if (
		!isRecord(range) ||
		typeof range.min !== 'number' ||
		typeof range.max !== 'number' ||
		!Number.isFinite(range.min) ||
		!Number.isFinite(range.max) ||
		range.min > range.max
	) {
		reasons.push('scoring_config_range_invalid');
	}
	const clip = spec.clip as ClipRange | undefined;
	if (
		!isRecord(clip) ||
		typeof clip.min !== 'number' ||
		typeof clip.max !== 'number' ||
		!Number.isFinite(clip.min) ||
		!Number.isFinite(clip.max) ||
		clip.min < 0 ||
		clip.max > 1 ||
		clip.min > clip.max
	) {
		reasons.push('scoring_config_clip_invalid');
	}
	const normalization = spec.normalization as NormalizationSpec | undefined;
	if (isRecord(normalization) && normalization.kind === 'piecewise_linear') {
		const points = normalization.points;
		if (!Array.isArray(points) || points.length < 2) {
			reasons.push('scoring_config_band_monotonic');
		} else {
			for (let index = 1; index < points.length; index += 1) {
				const previous = points[index - 1] as unknown as LinearBandPoint;
				const current = points[index] as unknown as LinearBandPoint;
				if (
					typeof previous?.x !== 'number' ||
					typeof current?.x !== 'number' ||
					current.x <= previous.x ||
					previous.y < 0 ||
					previous.y > 1
				) {
					reasons.push('scoring_config_band_monotonic');
					break;
				}
			}
			const last = points[points.length - 1] as unknown as LinearBandPoint;
			if (typeof last?.y !== 'number' || last.y < 0 || last.y > 1) {
				reasons.push('scoring_config_band_monotonic');
			}
		}
	} else if (isRecord(normalization) && normalization.kind === 'categorical') {
		const table = normalization.table as Record<string, unknown> | undefined;
		if (!table || Object.keys(table).length === 0) {
			reasons.push('scoring_config_band_monotonic');
		} else {
			for (const quality of Object.values(table)) {
				if (
					typeof quality !== 'number' ||
					!Number.isFinite(quality) ||
					quality < 0 ||
					quality > 1
				) {
					reasons.push('scoring_config_band_monotonic');
					break;
				}
			}
		}
	} else {
		reasons.push('scoring_config_normalization_unknown');
	}
	const maxAge = spec.maxAgeHours;
	if (typeof maxAge !== 'number' || !Number.isFinite(maxAge) || maxAge <= 0) {
		reasons.push('scoring_config_staleness_limit_invalid');
	}
	if (spec.missingInputPolicy !== 'exclude') {
		reasons.push('scoring_config_missing_input_policy_forbidden');
	}
}

/** Validates a Resort Rating config shape. Throws ScoringConfigError on any violation. */
export function validateResortRatingConfig(config: ResortRatingConfig): void {
	const reasons: string[] = [];
	const scale = config.computationScale;
	if (!isRecord(scale) || scale.min !== 0 || scale.max !== 100) {
		reasons.push('scoring_config_computation_scale_invalid');
	}
	const gates = config.gates;
	if (
		!isRecord(gates) ||
		typeof gates.minimumCategoryCoverageShare !== 'number' ||
		!Number.isFinite(gates.minimumCategoryCoverageShare) ||
		gates.minimumCategoryCoverageShare < 0 ||
		gates.minimumCategoryCoverageShare > 1
	) {
		reasons.push('scoring_config_gate_invalid');
	}
	if (!Array.isArray(config.categories) || config.categories.length === 0) {
		reasons.push('scoring_config_categories_empty');
	} else {
		const seen = new Set<string>();
		let weightSum = 0;
		for (const category of config.categories as unknown[]) {
			if (!isRecord(category) || typeof category.id !== 'string') {
				reasons.push('scoring_config_component_not_an_object');
				continue;
			}
			if (seen.has(category.id)) reasons.push('scoring_config_component_ids_not_unique');
			seen.add(category.id);
			const weight = category.weight;
			if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
				reasons.push('scoring_config_weight_not_positive');
			} else {
				weightSum += weight;
			}
		}
		if (Math.abs(weightSum - 1) > WEIGHT_SUM_EPSILON) {
			reasons.push('scoring_config_weights_do_not_sum_to_one');
		}
	}
	if (reasons.length > 0) throw new ScoringConfigError(reasons);
}
