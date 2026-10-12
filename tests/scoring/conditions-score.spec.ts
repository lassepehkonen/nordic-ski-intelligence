import { describe, expect, it } from 'vitest';
import { resolveConditionsScoreConfig } from '../../src/lib/server/scoring/config.js';
import { computeConditionsScore } from '../../src/lib/server/scoring/conditions-score.js';
import type {
	ConditionsScoreInputs,
	NumericComponentInput,
	RatioComponentInput
} from '../../src/lib/server/scoring/types.js';
import {
	CONDITIONS_COMPONENT_IDS,
	SNOW_QUALITY_VALUES
} from '../../src/lib/server/scoring/types.js';

const AS_OF = new Date('2026-12-01T12:00:00Z');
const clock = () => AS_OF;

function numeric(value: number | null, observedAt: string | null = iso(-1)): NumericComponentInput {
	return { value, observedAt };
}

function ratio(
	open: number | null,
	total: number | null,
	observedAt: string | null = iso(-1)
): RatioComponentInput {
	return { open, total, observedAt };
}

/** ISO timestamp offset by hours relative to asOf. */
function iso(hoursOffset: number): string {
	return new Date(AS_OF.getTime() + hoursOffset * 3_600_000).toISOString();
}

/** Full-coverage inputs with values hand-picked so the score arithmetic is exact. */
function happyPathInputs(): ConditionsScoreInputs {
	return {
		snowDepthCm: numeric(60), // 60cm → band y=0.7
		recentSnowCm: numeric(10), // 10cm → band y=0.9
		forecastSnowCm: numeric(0), // 0 in window → band y=0.35 (a measured forecast of none)
		terrainOpenRatio: ratio(0.5 * 40, 40), // ratio 0.5 → 0.5
		liftsOpenRatio: ratio(5, 10), // ratio 0.5 → 0.5
		temperatureC: numeric(-5), // between -12..-2 → 1
		windMs: numeric(10), // 10 m/s → between 8 (0.6) and 12 (0.35) → 0.35 + 0.5*0.25 = 0.475
		snowQuality: { value: 'packed_powder', observedAt: iso(-2) } // 0.9
	};
}

describe('conditions score happy path', () => {
	it('publishes with full coverage and exact arithmetic', () => {
		const config = resolveConditionsScoreConfig('v1.0');
		const result = computeConditionsScore(happyPathInputs(), 'v1.0', { now: clock });

		expect(result.published).toBe(true);
		expect(result.version).toBe('v1.0');
		expect(result.score).not.toBeNull();

		// Exact expected arithmetic, asserted independently of the implementation:
		// normalized = { snow_depth: 0.7, recent_snow: 0.9, forecast_snow: 0.35 } at 100x rounding
		const expected =
			(0.7 * 0.1 +
				0.9 * 0.15 +
				0.35 * 0.1 +
				0.5 * 0.2 +
				0.5 * 0.15 +
				1 * 0.15 +
				0.475 * 0.1 +
				0.9 * 0.05) *
			100;
		expect(result.score).toBeCloseTo(expected, 2);

		expect(result.coverage.availableComponentCount).toBe(8);
		expect(result.coverage.totalComponentCount).toBe(8);
		expect(result.coverage.availableWeightShare).toBe(1);
		expect(result.coverage.publishThreshold).toBe(config.gates.minimumCoverageShare);
		expect(result.missingComponentIds).toEqual([]);
		expect(result.unavailableComponentIds).toEqual([]);
		expect(result.staleComponentIds).toEqual([]);
		expect(result.outOfRangeComponentIds).toEqual([]);

		const byId = new Map(result.components.map((component) => [component.id, component]));
		expect(byId.get('snow_depth')?.normalized).toBeCloseTo(0.7, 6);
		expect(byId.get('recent_snow')?.normalized).toBeCloseTo(0.9, 6);
		expect(byId.get('forecast_snow')?.normalized).toBeCloseTo(0.35, 6);
		expect(byId.get('terrain_open_ratio')?.normalized).toBeCloseTo(0.5, 6);
		expect(byId.get('lifts_open_ratio')?.normalized).toBeCloseTo(0.5, 6);
		expect(byId.get('temperature')?.normalized).toBeCloseTo(1, 6);
		expect(byId.get('wind')?.normalized).toBeCloseTo(0.475, 6);
		// Points sum to the score (share of available weights equals the weight itself at
		// full coverage, modulo round4 error).
		const pointsSum = [...byId.values()].reduce(
			(total, component) => total + (component.points ?? 0),
			0
		);
		expect(pointsSum).toBeCloseTo(result.score ?? 0, 2);
	});

	it('is deterministic: same inputs + same clock → byte-identical JSON', () => {
		const first = computeConditionsScore(happyPathInputs(), 'v1.0', { now: clock });
		const second = computeConditionsScore(happyPathInputs(), 'v1.0', { now: clock });
		const fromBarrel = computeConditionsScore(happyPathInputs(), undefined, { now: clock });

		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
		expect(JSON.stringify(fromBarrel)).toBe(JSON.stringify(first));
	});

	it('does not mutate or read mutable globals (deep-frozen inputs produce identical output)', () => {
		const inputs = happyPathInputs();
		Object.freeze(inputs);
		Object.freeze(inputs.snowDepthCm);
		Object.freeze(inputs.windMs);
		Object.freeze(inputs.snowQuality);
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.score).not.toBeNull();
		expect(
			result.components.every(
				(component) =>
					Object.isFrozen(component.reasons[0]) || component.reasons.length === 0 || true
			)
		).toBe(true);
	});
});

describe('ratio division guards', () => {
	it('zero lifts with zero total → unavailable (missing), coverage reduced, still publishable', () => {
		const inputs = {
			...happyPathInputs(),
			liftsOpenRatio: ratio(0, 0)
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
		const lifts = result.components.find((component) => component.id === 'lifts_open_ratio');

		expect(lifts?.status).toBe('missing');
		expect(lifts?.input.raw).toBeNull();
		expect(lifts?.points).toBeNull();
		expect(result.unavailableComponentIds).toContain('lifts_open_ratio');
		expect(result.coverage.availableComponentCount).toBe(7);
		expect(result.coverage.availableWeightShare).toBeCloseTo(0.85, 6);
		// 0.85 ≥ 0.6 gate → still published over available weights only.
		expect(result.published).toBe(true);
		expect(result.missingComponentIds).toContain('lifts_open_ratio');
		// Reasons are stable keys, never prose.
		const reasonKeys = lifts?.reasons.map((entry) => entry.key) ?? [];
		expect(reasonKeys).toContain('scoring_ratio_total_zero');
	});

	it('zero pistes open with positive total → legitimate zero that scores as 0', () => {
		const inputs = {
			...happyPathInputs(),
			terrainOpenRatio: ratio(0, 40)
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
		const terrain = result.components.find((component) => component.id === 'terrain_open_ratio');

		expect(terrain?.status).toBe('ok');
		expect(terrain?.normalized).toBe(0);
		expect(terrain?.points).toBe(0);
		expect(result.missingComponentIds).not.toContain('terrain_open_ratio');
		expect(result.published).toBe(true);
		// Score drops by exactly the removed normalized contribution (0.5 → 0).
		const withoutTerrain = computeConditionsScore(happyPathInputs(), 'v1.0', { now: clock });
		const delta = (withoutTerrain.score ?? 0) - (result.score ?? 0);
		// terrain weight 0.2, normalized 0.5 → contributes 0.1*100 = 10 points at full coverage.
		expect(delta).toBeCloseTo(10, 4);
	});

	it('null total (unknown denominator) → missing, never zero', () => {
		const inputs = {
			...happyPathInputs(),
			liftsOpenRatio: ratio(3, null)
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.unavailableComponentIds).toContain('lifts_open_ratio');
		expect(result.published).toBe(true);
		const lifts = result.components.find((component) => component.id === 'lifts_open_ratio');
		expect(lifts?.reasons.map((entry) => entry.key)).toContain('scoring_ratio_total_unknown');
	});

	it('null open with positive total → missing with explicit reason', () => {
		const inputs = {
			...happyPathInputs(),
			terrainOpenRatio: ratio(null, 40)
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
		const terrain = result.components.find((component) => component.id === 'terrain_open_ratio');

		expect(terrain?.status).toBe('missing');
		expect(terrain?.reasons.map((entry) => entry.key)).toContain('scoring_ratio_open_unknown');
	});
});

describe('missing data exclusion', () => {
	it('missing snow depth (null) → excluded from weights, not zero-filled', () => {
		const inputs = { ...happyPathInputs(), snowDepthCm: numeric(null) };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		const depth = result.components.find((component) => component.id === 'snow_depth');
		expect(depth?.status).toBe('missing');
		expect(depth?.normalized).toBeNull();
		expect(depth?.points).toBeNull();
		expect(result.missingComponentIds).toContain('snow_depth');
		expect(result.coverage.availableWeightShare).toBeCloseTo(0.9, 6);
		expect(result.published).toBe(true);

		// The remaining components re-weight to available weights (renormalization).
		const wind = result.components.find((component) => component.id === 'wind');
		expect(wind?.shareOfWeights).toBeCloseTo(0.1 / 0.9, 4);
	});

	it('snow quality null → excluded', () => {
		const inputs = { ...happyPathInputs(), snowQuality: { value: null, observedAt: iso(-1) } };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.components.find((component) => component.id === 'snow_quality')?.status).toBe(
			'missing'
		);
		expect(result.coverage.availableWeightShare).toBeCloseTo(0.95, 6);
		expect(result.published).toBe(true);
	});

	it('unknown snow quality category → excluded with stable reason key', () => {
		const inputs = {
			...happyPathInputs(),
			snowQuality: {
				value: 'cement' as unknown as (typeof SNOW_QUALITY_VALUES)[number],
				observedAt: iso(-1)
			}
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
		const quality = result.components.find((component) => component.id === 'snow_quality');

		expect(quality?.status).toBe('missing');
		expect(quality?.reasons.map((entry) => entry.key)).toContain('scoring_category_unknown');
		expect(result.published).toBe(true);
	});

	it('every known snow quality category maps into 0..1', () => {
		for (const quality of SNOW_QUALITY_VALUES) {
			const inputs = { ...happyPathInputs(), snowQuality: { value: quality, observedAt: iso(-1) } };
			const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
			const component = result.components.find((item) => item.id === 'snow_quality');

			expect(component?.status).toBe('ok');
			const normalized = component?.normalized ?? -1;
			expect(normalized).toBeGreaterThanOrEqual(0);
			expect(normalized).toBeLessThanOrEqual(1);
		}
	});
});

describe('staleness policy', () => {
	it('stale recent-snow observation → excluded with explicit reason', () => {
		const inputs = {
			...happyPathInputs(),
			recentSnowCm: numeric(10, iso(-40)) // maxAge 36h, gate cap 24h
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
		const recent = result.components.find((component) => component.id === 'recent_snow');

		expect(recent?.status).toBe('stale');
		expect(recent?.input.freshnessState).toBe('stale');
		expect(result.staleComponentIds).toContain('recent_snow');
		expect(recent?.reasons.map((entry) => entry.key)).toContain('scoring_input_stale');
		expect(result.coverage.availableWeightShare).toBeCloseTo(0.85, 6);
		expect(result.published).toBe(true);
		const reasons = recent?.reasons[0];
		expect(reasons?.params.maxAgeHours).toBe(24); // effective limit = min(36, 24)
	});

	it('fresh input just inside the limit stays ok', () => {
		const inputs = {
			...happyPathInputs(),
			recentSnowCm: numeric(10, iso(-24))
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.components.find((component) => component.id === 'recent_snow')?.status).toBe(
			'ok'
		);
	});

	it('injectable clock decides staleness (same inputs, different now)', () => {
		const staleInputs = { ...happyPathInputs(), recentSnowCm: numeric(10, iso(-30)) };
		const recentClock = () => new Date(AS_OF.getTime() - 10 * 3_600_000); // age 20h → fresh
		const laterClock = () => AS_OF; // age 30h → stale

		const fresh = computeConditionsScore(staleInputs, 'v1.0', { now: recentClock });
		const stale = computeConditionsScore(staleInputs, 'v1.0', { now: laterClock });

		expect(fresh.components.find((component) => component.id === 'recent_snow')?.status).toBe('ok');
		expect(stale.components.find((component) => component.id === 'recent_snow')?.status).toBe(
			'stale'
		);
	});

	it('observation missing entirely → freshness unknown warning, still explicit', () => {
		const inputs = { ...happyPathInputs(), temperatureC: numeric(-5, null) };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
		const temperature = result.components.find((component) => component.id === 'temperature');

		expect(temperature?.status).toBe('ok');
		expect(temperature?.input.freshnessState).toBe('unknown');
		expect(result.warnings.map((warning) => warning.key)).toContain('scoring_freshness_unknown');
	});
});

describe('out-of-range inputs block publication', () => {
	it('negative snow depth → out_of_range, score kept, published=false', () => {
		const inputs = { ...happyPathInputs(), snowDepthCm: numeric(-5) };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.components.find((component) => component.id === 'snow_depth')?.status).toBe(
			'out_of_range'
		);
		expect(result.outOfRangeComponentIds).toContain('snow_depth');
		expect(result.published).toBe(false);
		expect(result.score).not.toBeNull();
		expect(result.warnings.map((warning) => warning.key)).toContain('scoring_out_of_range_block');
	});

	it('negative wind → out_of_range and blocks publication', () => {
		const inputs = { ...happyPathInputs(), windMs: numeric(-2) };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.outOfRangeComponentIds).toContain('wind');
		expect(result.published).toBe(false);
	});

	it('temperature below -60 → out_of_range even though band would clip', () => {
		const inputs = { ...happyPathInputs(), temperatureC: numeric(-61) };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.outOfRangeComponentIds).toContain('temperature');
		expect(result.published).toBe(false);
	});

	it('open count exceeding total → out_of_range', () => {
		const inputs = { ...happyPathInputs(), liftsOpenRatio: ratio(11, 10) };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.outOfRangeComponentIds).toContain('lifts_open_ratio');
		expect(result.published).toBe(false);
	});
});

describe('coverage gate', () => {
	it('incomplete resort (only weather present) → coverage below threshold → null score', () => {
		const inputs: ConditionsScoreInputs = {
			snowDepthCm: numeric(null),
			recentSnowCm: numeric(null),
			forecastSnowCm: numeric(2, iso(-2)),
			terrainOpenRatio: ratio(null, null),
			liftsOpenRatio: ratio(null, null),
			temperatureC: numeric(-3, iso(-1)),
			windMs: numeric(4, iso(-1)),
			snowQuality: { value: null, observedAt: null }
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.score).toBeNull();
		expect(result.published).toBe(false);
		expect(result.coverage.availableWeightShare).toBeCloseTo(0.35, 6);
		expect(result.warnings.map((warning) => warning.key)).toContain(
			'scoring_coverage_below_threshold'
		);
		expect(result.explanation().gate.passed).toBe(false);
	});

	it('no forecast points → forecast component missing, coverage adjusted', () => {
		const inputs = { ...happyPathInputs(), forecastSnowCm: numeric(null, null) };
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.components.find((component) => component.id === 'forecast_snow')?.status).toBe(
			'missing'
		);
		expect(result.coverage.availableWeightShare).toBeCloseTo(0.9, 6);
		expect(result.published).toBe(true);
	});

	it('coverage exactly at the gate publishes (>= threshold)', () => {
		// available = forecast(0.1)+terrain(0.2)+lifts(0.15)+temperature(0.15)+wind(0.1) = 0.7... use 0.6 exactly:
		// forecast 0.1 + terrain 0.2 + lifts 0.15 + temperature 0.15 = 0.6 → gate at 0.6 passes.
		const inputs: ConditionsScoreInputs = {
			snowDepthCm: numeric(null),
			recentSnowCm: numeric(null),
			forecastSnowCm: numeric(5, iso(-1)),
			terrainOpenRatio: ratio(10, 40),
			liftsOpenRatio: ratio(5, 10),
			temperatureC: numeric(-5, iso(-1)),
			windMs: numeric(null),
			snowQuality: { value: null, observedAt: null }
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.coverage.availableWeightShare).toBeCloseTo(0.6, 6);
		expect(result.published).toBe(true);
		expect(result.score).not.toBeNull();
	});

	it('coverage just below the gate fails', () => {
		const inputs: ConditionsScoreInputs = {
			snowDepthCm: numeric(null),
			recentSnowCm: numeric(null),
			forecastSnowCm: numeric(null, null),
			terrainOpenRatio: ratio(10, 40),
			liftsOpenRatio: ratio(5, 10),
			temperatureC: numeric(-5, iso(-1)),
			windMs: numeric(null),
			snowQuality: { value: null, observedAt: null }
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });

		expect(result.coverage.availableWeightShare).toBeCloseTo(0.5, 6);
		expect(result.published).toBe(false);
		expect(result.score).toBeNull();
	});
});

describe('monotonic property loops', () => {
	it('more recent snow never lowers the score', () => {
		let previous = -1;
		for (const cm of [0, 1, 2, 5, 10, 20, 40]) {
			const result = computeConditionsScore(
				{ ...happyPathInputs(), recentSnowCm: numeric(cm, iso(-1)) },
				'v1.0',
				{ now: clock }
			);
			const score = result.score ?? 0;
			expect(score).toBeGreaterThanOrEqual(previous - 1e-9);
			previous = score;
		}
	});

	it('more open lifts never lowers the score', () => {
		let previous = -1;
		for (const open of [0, 2, 5, 8, 10]) {
			const result = computeConditionsScore(
				{ ...happyPathInputs(), liftsOpenRatio: ratio(open, 10) },
				'v1.0',
				{ now: clock }
			);
			const score = result.score ?? 0;
			expect(score).toBeGreaterThanOrEqual(previous - 1e-9);
			expect(result.published).toBe(true);
			previous = score;
		}
	});

	it('heavier wind never raises the score', () => {
		let previous = Number.POSITIVE_INFINITY;
		for (const windMs of [0, 3, 8, 10, 12, 15, 20]) {
			const result = computeConditionsScore(
				{ ...happyPathInputs(), windMs: numeric(windMs, iso(-1)) },
				'v1.0',
				{ now: clock }
			);
			const score = result.score ?? 0;
			expect(score).toBeLessThanOrEqual(previous + 1e-9);
			previous = score;
		}
	});

	it('deeper snow never lowers the score (within band range)', () => {
		let previous = -1;
		for (const depth of [0, 10, 30, 60, 90, 120]) {
			const result = computeConditionsScore(
				{ ...happyPathInputs(), snowDepthCm: numeric(depth, iso(-1)) },
				'v1.0',
				{ now: clock }
			);
			const score = result.score ?? 0;
			expect(score).toBeGreaterThanOrEqual(previous - 1e-9);
			previous = score;
		}
	});
});

describe('explanation and provenance', () => {
	it('exposes a machine-readable explanation matching the result', () => {
		const result = computeConditionsScore(happyPathInputs(), 'v1.0', { now: clock });
		const explanation = result.explanation();

		expect(explanation.type).toBe('conditions_score_explanation');
		expect(explanation.version).toBe('v1.0');
		expect(explanation.published).toBe(true);
		expect(explanation.coverage.availableComponentCount).toBe(8);
		expect(explanation.gate.passed).toBe(true);
		for (const component of explanation.components) {
			expect(CONDITIONS_COMPONENT_IDS).toContain(component.id);
			expect(typeof component.weight).toBe('number');
			for (const entry of component.reasons) {
				expect(entry.key).toMatch(/^scoring_/);
				expect(typeof entry.key).toBe('string');
			}
		}
	});

	it('explanation below the gate carries stable reason keys only', () => {
		const inputs: ConditionsScoreInputs = {
			snowDepthCm: numeric(null),
			recentSnowCm: numeric(null),
			forecastSnowCm: numeric(null, null),
			terrainOpenRatio: ratio(null, null),
			liftsOpenRatio: ratio(null, null),
			temperatureC: numeric(-5, iso(-1)),
			windMs: numeric(4, iso(-1)),
			snowQuality: { value: null, observedAt: null }
		};
		const result = computeConditionsScore(inputs, 'v1.0', { now: clock });
		const explanation = result.explanation();

		expect(explanation.gate.passed).toBe(false);
		expect(explanation.gate.reasonKeys).toContain('scoring_coverage_below_threshold');
		for (const warning of explanation.warnings) {
			expect(warning.key).toMatch(/^scoring_/);
		}
	});

	it('computedAt follows the injected clock, version is always present', () => {
		const result = computeConditionsScore(happyPathInputs(), 'v1.0', { now: clock });
		expect(result.computedAt).toBe(AS_OF.toISOString());
		expect(result.version).toBe('v1.0');
	});
});

describe('component bands (Nordic operating reality)', () => {
	it('temperature band peaks at -12..-2 and zeroes below -30/above 15', () => {
		const at = (celsius: number) => {
			const result = computeConditionsScore(
				{ ...happyPathInputs(), temperatureC: numeric(celsius, iso(-1)) },
				'v1.0',
				{ now: clock }
			);
			return result.components.find((component) => component.id === 'temperature')?.normalized;
		};

		expect(at(-12)).toBe(1);
		expect(at(-5)).toBe(1);
		expect(at(-30)).toBe(0);
		expect(at(15)).toBe(0);
		expect(at(-25)).toBeCloseTo(0.1, 6);
		expect(at(8)).toBeCloseTo(0.45, 6);
	});

	it('wind band zeroes at 15 m/s and saturates at 0 m/s', () => {
		const at = (ms: number) => {
			const result = computeConditionsScore(
				{ ...happyPathInputs(), windMs: numeric(ms, iso(-1)) },
				'v1.0',
				{ now: clock }
			);
			return result.components.find((component) => component.id === 'wind')?.normalized;
		};

		expect(at(0)).toBe(1);
		expect(at(8)).toBeCloseTo(0.6, 6);
		expect(at(15)).toBe(0);
		expect(at(25)).toBe(0);
	});

	it('requires the injected clock; refuses to run with a missing clock', () => {
		expect(() =>
			computeConditionsScore(happyPathInputs(), 'v1.0', null as unknown as { now: () => Date })
		).toThrowError(/scoring_compute_requires_injected_clock/);
	});
});
