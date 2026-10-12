import { describe, expect, it } from 'vitest';
import {
	CONDITIONS_SCORE_V1,
	bandFor,
	conditionsScoreWeightTotal
} from '../../src/lib/domain/scoring/config.js';
import { computeConditionsScore } from '../../src/lib/domain/scoring/score.js';
import type { MetricKey, Observation, SnowQuality } from '../../src/lib/domain/types.js';

const NOW = new Date('2026-10-12T12:00:00.000Z');

interface ObservationOverrides {
	value: number | SnowQuality;
	metric: MetricKey;
	validUntil?: string | null;
	validationState?: Observation['validationState'];
	confidence?: Observation['confidence'];
}

function observation({
	metric,
	value,
	validUntil = '2026-10-12T18:00:00.000Z',
	validationState = 'validated',
	confidence = 'medium'
}: ObservationOverrides): Observation {
	return {
		resortId: 'test',
		metric,
		value,
		unit: typeof value === 'number' ? 'cm' : null,
		observedAt: '2026-10-12T10:30:00.000Z',
		fetchedAt: '2026-10-12T11:00:00.000Z',
		validUntil,
		validationState,
		confidence,
		dataState: 'illustrative',
		sourceId: 'test-source'
	};
}

/** A complete, high-quality input set covering every configured metric. */
function fullObservations(): Observation[] {
	return [
		observation({ metric: 'snow_depth_cm', value: 120 }),
		observation({ metric: 'new_snow_24h_cm', value: 25 }),
		observation({ metric: 'new_snow_72h_cm', value: 60 }),
		observation({ metric: 'forecast_snow_72h_cm', value: 40 }),
		observation({ metric: 'open_pistes', value: 40 }),
		observation({ metric: 'total_pistes', value: 40 }),
		observation({ metric: 'open_lifts', value: 20 }),
		observation({ metric: 'total_lifts', value: 20 }),
		observation({ metric: 'temperature_c', value: -5 }),
		observation({ metric: 'wind_ms', value: 3 }),
		observation({ metric: 'snow_quality', value: 'powder' })
	];
}

describe('Conditions Score configuration', () => {
	it('weights sum to exactly 1 so the score stays on a 0–100 scale', () => {
		expect(conditionsScoreWeightTotal(CONDITIONS_SCORE_V1)).toBeCloseTo(1, 10);
	});

	it('maps scores onto bands at the configured boundaries', () => {
		const config = CONDITIONS_SCORE_V1;
		expect(bandFor(100, config)).toBe('excellent');
		expect(bandFor(80, config)).toBe('excellent');
		expect(bandFor(79, config)).toBe('good');
		expect(bandFor(65, config)).toBe('good');
		expect(bandFor(64, config)).toBe('fair');
		expect(bandFor(45, config)).toBe('fair');
		expect(bandFor(44, config)).toBe('poor');
		expect(bandFor(0, config)).toBe('poor');
	});
});

describe('computeConditionsScore', () => {
	it('returns a 0–100 score for a complete input set, with full coverage', () => {
		const result = computeConditionsScore({
			resortId: 'test',
			observations: fullObservations(),
			now: NOW
		});

		expect(result.score).toBe(100);
		expect(result.band).toBe('excellent');
		expect(result.coverage).toBe(1);
		expect(result.partial).toBe(false);
		expect(result.freshness).toBe('fresh');
		expect(result.missingMetrics).toEqual([]);
		expect(result.inputs).toHaveLength(CONDITIONS_SCORE_V1.inputs.length);
	});

	it('is deterministic for the same inputs', () => {
		const first = computeConditionsScore({
			resortId: 'test',
			observations: fullObservations(),
			now: NOW
		});
		const second = computeConditionsScore({
			resortId: 'test',
			observations: fullObservations(),
			now: NOW
		});

		expect(second).toEqual(first);
	});

	it('derives the piste and lift ratios from open/total pairs instead of scoring a raw count', () => {
		const observations = fullObservations().map((entry) =>
			entry.metric === 'open_pistes' ? { ...entry, value: 20 } : entry
		);
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });
		const pisteInput = result.inputs.find((input) => input.id === 'open_piste_ratio');

		expect(pisteInput?.raw).toBeCloseTo(0.5, 10);
		expect(pisteInput?.normalized).toBeCloseTo(0.5, 10);
		// 0.18 of the score came from a full piste complement, so half of it is lost.
		expect(result.score).toBe(91);
	});

	it('excludes missing inputs from the average and reports reduced coverage', () => {
		const observations = fullObservations().filter(
			(entry) => entry.metric !== 'snow_depth_cm' && entry.metric !== 'new_snow_72h_cm'
		);
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });

		// Missing inputs must not be treated as zeros: the remaining inputs still score 100.
		expect(result.score).toBe(100);
		expect(result.coverage).toBeCloseTo(0.72, 10);
		expect(result.partial).toBe(true);
		expect(result.missingMetrics).toEqual(['snow_depth_cm', 'new_snow_72h_cm']);
	});

	it('withholds the score when coverage falls below the configured threshold', () => {
		const observations = [
			observation({ metric: 'snow_depth_cm', value: 80 }),
			observation({ metric: 'new_snow_24h_cm', value: 10 })
		];
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });

		expect(result.coverage).toBeLessThan(CONDITIONS_SCORE_V1.hideBelowCoverage);
		expect(result.score).toBeNull();
		expect(result.band).toBeNull();
		expect(result.partial).toBe(false);
	});

	it('marks the score invalid when every observation was rejected by validation', () => {
		const observations = fullObservations().map((entry) => ({
			...entry,
			validationState: 'rejected' as const
		}));
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });

		expect(result.score).toBeNull();
		expect(result.coverage).toBe(0);
		expect(result.freshness).toBe('invalid');
	});

	it('carries staleness through to the score instead of hiding it', () => {
		const observations = fullObservations().map((entry) => ({
			...entry,
			validUntil: '2026-10-12T11:30:00.000Z'
		}));
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });

		expect(result.freshness).toBe('stale');
		expect(result.score).toBe(100);
	});

	it('reports the lowest input confidence and ignores observations that are not usable', () => {
		const observations = fullObservations().map((entry) =>
			entry.metric === 'wind_ms' ? { ...entry, confidence: 'low' as const } : entry
		);
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });

		expect(result.confidence).toBe('low');
	});

	it('scores snow quality through the configured quality map', () => {
		const observations = fullObservations().map((entry) =>
			entry.metric === 'snow_quality' ? { ...entry, value: 'icy' as SnowQuality } : entry
		);
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });
		const qualityInput = result.inputs.find((input) => input.id === 'snow_quality');

		expect(qualityInput?.normalized).toBeCloseTo(0.1, 10);
		expect(result.score).toBe(95);
	});

	it('keeps the score explanation self-consistent: score equals the weighted average of used inputs', () => {
		const observations = fullObservations().filter(
			(entry) => entry.metric !== 'temperature_c' && entry.metric !== 'new_snow_24h_cm'
		);
		const result = computeConditionsScore({ resortId: 'test', observations, now: NOW });

		const used = result.inputs.filter((input) => !input.missing);
		const weight = used.reduce((total, input) => total + input.weight, 0);
		const expected = Math.round(
			(used.reduce((total, input) => total + (input.contribution ?? 0), 0) / weight) * 100
		);

		expect(result.score).toBe(expected);
		expect(result.inputs.filter((input) => input.missing).map((input) => input.metric)).toEqual([
			'new_snow_24h_cm',
			'temperature_c'
		]);
	});
});
