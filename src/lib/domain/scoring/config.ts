/**
 * Conditions Score configuration, version 1 (ADR-0009).
 *
 * The score is versioned and configurable; changing weights, curves or thresholds means adding a
 * new version rather than editing this one, so historical scores stay interpretable. Scoring code
 * never lives in a UI component.
 *
 * Each input contributes `weight * normalised(value)`, where the normalised value is in [0, 1].
 * Missing inputs are excluded and reduce *coverage* instead of counting as zero.
 */

import type { MetricKey, ScoreBand, SnowQuality } from '../types.js';

export type Normalizer =
	/** Linear ramp: value at or below `zero` scores 0, at or above `full` scores 1 (or reversed). */
	| { kind: 'ramp'; zero: number; full: number }
	/** Already a 0–1 proportion. */
	| { kind: 'ratio' }
	/** Comfort band: 1 inside [idealLow, idealHigh], falling to 0 at `zeroLow` / `zeroHigh`. */
	| { kind: 'ideal'; zeroLow: number; idealLow: number; idealHigh: number; zeroHigh: number }
	| { kind: 'quality'; map: Readonly<Record<SnowQuality, number>> };

export type ScoreInputSource =
	| { kind: 'metric'; metric: MetricKey }
	| { kind: 'ratio'; numerator: MetricKey; denominator: MetricKey };

export interface ScoreInputDefinition {
	id: string;
	/** Message-catalog key used for the localized input label. */
	labelKey: string;
	source: ScoreInputSource;
	weight: number;
	normalizer: Normalizer;
}

export interface ConditionsScoreConfig {
	version: string;
	/** Below this coverage the numeric score is withheld (the resort is not ranked). */
	hideBelowCoverage: number;
	/** Below this coverage the score is published but flagged as partial. */
	partialBelowCoverage: number;
	bands: readonly { band: ScoreBand; min: number }[];
	inputs: readonly ScoreInputDefinition[];
}

export const CONDITIONS_SCORE_V1: ConditionsScoreConfig = {
	version: 'v1',
	hideBelowCoverage: 0.5,
	partialBelowCoverage: 0.8,
	bands: [
		{ band: 'excellent', min: 80 },
		{ band: 'good', min: 65 },
		{ band: 'fair', min: 45 },
		{ band: 'poor', min: 0 }
	],
	inputs: [
		{
			id: 'snow_depth',
			labelKey: 'metric_snow_depth',
			source: { kind: 'metric', metric: 'snow_depth_cm' },
			weight: 0.18,
			normalizer: { kind: 'ramp', zero: 10, full: 120 }
		},
		{
			id: 'new_snow_24h',
			labelKey: 'metric_new_snow_24h',
			source: { kind: 'metric', metric: 'new_snow_24h_cm' },
			weight: 0.14,
			normalizer: { kind: 'ramp', zero: 0, full: 25 }
		},
		{
			id: 'new_snow_72h',
			labelKey: 'metric_new_snow_72h',
			source: { kind: 'metric', metric: 'new_snow_72h_cm' },
			weight: 0.1,
			normalizer: { kind: 'ramp', zero: 0, full: 60 }
		},
		{
			id: 'forecast_snow_72h',
			labelKey: 'metric_forecast_snow_72h',
			source: { kind: 'metric', metric: 'forecast_snow_72h_cm' },
			weight: 0.08,
			normalizer: { kind: 'ramp', zero: 0, full: 40 }
		},
		{
			id: 'open_piste_ratio',
			labelKey: 'metric_open_piste_ratio',
			source: { kind: 'ratio', numerator: 'open_pistes', denominator: 'total_pistes' },
			weight: 0.18,
			normalizer: { kind: 'ratio' }
		},
		{
			id: 'open_lift_ratio',
			labelKey: 'metric_open_lift_ratio',
			source: { kind: 'ratio', numerator: 'open_lifts', denominator: 'total_lifts' },
			weight: 0.12,
			normalizer: { kind: 'ratio' }
		},
		{
			id: 'temperature',
			labelKey: 'metric_temperature',
			source: { kind: 'metric', metric: 'temperature_c' },
			weight: 0.08,
			normalizer: { kind: 'ideal', zeroLow: -25, idealLow: -9, idealHigh: -2, zeroHigh: 7 }
		},
		{
			id: 'wind',
			labelKey: 'metric_wind',
			source: { kind: 'metric', metric: 'wind_ms' },
			weight: 0.06,
			// Wind is a penalty: calm (<= 3 m/s) is best, 14 m/s and above scores zero.
			normalizer: { kind: 'ramp', zero: 14, full: 3 }
		},
		{
			id: 'snow_quality',
			labelKey: 'metric_snow_quality',
			source: { kind: 'metric', metric: 'snow_quality' },
			weight: 0.06,
			normalizer: {
				kind: 'quality',
				map: { powder: 1, spring: 0.7, packed: 0.55, wet: 0.3, icy: 0.1 }
			}
		}
	]
};

/** Precipitation is a candidate input for a later score version, not part of v1. */
export const DEFERRED_SCORE_INPUTS: readonly MetricKey[] = ['precipitation_mm'];

export function conditionsScoreWeightTotal(config: ConditionsScoreConfig): number {
	return config.inputs.reduce((total, input) => total + input.weight, 0);
}

export function bandFor(score: number, config: ConditionsScoreConfig): ScoreBand {
	for (const entry of config.bands) {
		if (score >= entry.min) return entry.band;
	}
	return config.bands[config.bands.length - 1]?.band ?? 'poor';
}
