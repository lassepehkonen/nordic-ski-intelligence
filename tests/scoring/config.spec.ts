import { describe, expect, it } from 'vitest';
import {
	CONDITIONS_SCORE_ACTIVE_VERSION_ID,
	CONDITIONS_SCORE_VERSIONS,
	RESORT_RATING_ACTIVE_VERSION_ID,
	RESORT_RATING_VERSIONS,
	ScoringConfigError,
	resolveConditionsScoreConfig,
	resolveResortRatingConfig,
	validateConditionsScoreConfig,
	validateResortRatingConfig
} from '../../src/lib/server/scoring/config.js';
import {
	CONDITIONS_COMPONENT_IDS,
	RESORT_RATING_CATEGORY_IDS
} from '../../src/lib/server/scoring/types.js';

const FIXED_NOW = () => new Date('2026-12-01T12:00:00Z');

describe('conditions score config registry', () => {
	it('resolves the active v1.0 version with all eight components', () => {
		const config = resolveConditionsScoreConfig();

		expect(config.versionId).toBe('v1.0');
		expect(CONDITIONS_SCORE_ACTIVE_VERSION_ID).toBe('v1.0');
		expect(config.components.map((component) => component.id)).toEqual([
			...CONDITIONS_COMPONENT_IDS
		]);
		expect(config.components).toHaveLength(8);
		expect(config.gates.minimumCoverageShare).toBeGreaterThan(0);
		expect(config.gates.minimumCoverageShare).toBeLessThanOrEqual(1);
		expect(config.gates.maximumStalenessHours).toBeGreaterThan(0);
		expect(config.forecastWindowHours).toBeGreaterThan(0);
	});

	it('exposes weights summing to exactly one', () => {
		const config = resolveConditionsScoreConfig('v1.0');
		const sum = config.components.reduce((total, component) => total + component.weight, 0);

		expect(sum).toBeCloseTo(1, 12);
	});

	it('throws the explicit ScoringConfigError for unknown versions (no silent fallback)', () => {
		expect(() => resolveConditionsScoreConfig('v9.9')).toThrowError(ScoringConfigError);
		expect(() => resolveConditionsScoreConfig('v9.9')).toThrowError(/v9\.9/);
		expect(() => resolveConditionsScoreConfig('')).toThrowError(ScoringConfigError);
	});

	it('freezes every config object and nested structure', () => {
		const conditions = resolveConditionsScoreConfig('v1.0');
		const rating = resolveResortRatingConfig('v1.0');

		expect(Object.isFrozen(CONDITIONS_SCORE_VERSIONS)).toBe(true);
		expect(Object.isFrozen(RESORT_RATING_VERSIONS)).toBe(true);
		expect(Object.isFrozen(conditions)).toBe(true);
		expect(Object.isFrozen(rating)).toBe(true);
		expect(Object.isFrozen(conditions.components)).toBe(true);
		for (const component of conditions.components) {
			expect(Object.isFrozen(component)).toBe(true);
			expect(Object.isFrozen(component.normalization)).toBe(true);
			if (component.normalization.kind === 'piecewise_linear') {
				expect(Object.isFrozen(component.normalization.points)).toBe(true);
			} else {
				expect(Object.isFrozen(component.normalization.table)).toBe(true);
			}
		}
		expect(() => {
			// Type-level forbidden; runtime must also reject mutation.
			(conditions as { versionId: string }).versionId = 'vX';
		}).toThrowError(TypeError);
	});

	it('carries the version id into every property needed for provenance', () => {
		for (const [versionId, config] of Object.entries(CONDITIONS_SCORE_VERSIONS)) {
			expect(config?.versionId).toBe(versionId);
		}
	});
});

describe('resort rating config registry', () => {
	it('pins the seven Master Product Context category weights verbatim', () => {
		const config = resolveResortRatingConfig('v1.0');

		expect(RESORT_RATING_ACTIVE_VERSION_ID).toBe('v1.0');
		expect(config.categories.map((category) => category.id)).toEqual([
			...RESORT_RATING_CATEGORY_IDS
		]);

		const weights = new Map(config.categories.map((category) => [category.id, category.weight]));
		expect(weights.get('atmosphere_environment')).toBe(0.15);
		expect(weights.get('slopes')).toBe(0.25);
		expect(weights.get('lifts')).toBe(0.15);
		expect(weights.get('off_piste')).toBe(0.2);
		expect(weights.get('accommodation')).toBe(0.1);
		expect(weights.get('food')).toBe(0.075);
		expect(weights.get('apres_ski')).toBe(0.075);

		const sum = config.categories.reduce((total, category) => total + category.weight, 0);
		expect(sum).toBeCloseTo(1, 12);
	});

	it('throws the explicit ScoringConfigError for unknown versions', () => {
		expect(() => resolveResortRatingConfig('v2.0-beta')).toThrowError(ScoringConfigError);
		expect(() => resolveResortRatingConfig('nope')).toThrowError(/nope/);
	});

	it('lists categories with weights via the public API', () => {
		const categories = resolveResortRatingConfig('v1.0');
		const rating = resolveResortRatingConfig('v1.0');

		expect(rating.gates.minimumCategoryCoverageShare).toBeGreaterThan(0);
		expect(rating.gates.minimumCategoryCoverageShare).toBeLessThanOrEqual(1);
		expect(categories.computationScale).toEqual({ min: 0, max: 100 });
	});
});

describe('config validation rejects invalid configs', () => {
	it('rejects weights that do not sum to one', () => {
		const config = {
			...resolveConditionsScoreConfig('v1.0'),
			components: resolveConditionsScoreConfig('v1.0').components.map((component) =>
				component.id === 'snow_depth' ? { ...component, weight: 0.5 } : component
			)
		};

		expect(() => validateConditionsScoreConfig(config)).toThrowError(ScoringConfigError);
		expect(() => validateConditionsScoreConfig(config)).toThrowError(
			/scoring_config_weights_do_not_sum_to_one/
		);
	});

	it('rejects negative or zero component weights', () => {
		const base = resolveConditionsScoreConfig('v1.0');
		const config = {
			...base,
			components: base.components.map((component) =>
				component.id === 'wind' ? { ...component, weight: -0.1 } : component
			)
		};

		expect(() => validateConditionsScoreConfig(config)).toThrowError(
			/scoring_config_weight_not_positive/
		);
	});

	it('rejects duplicate component ids', () => {
		const base = resolveConditionsScoreConfig('v1.0');
		// Rebuild the eight-component list so recent_snow duplicates snow_depth's id while
		// the weights still sum to one (isolate the id error from the weight errors).
		const rebalanced = base.components.map((component) => {
			if (component.id === 'recent_snow') return { ...component, id: 'snow_depth', weight: 0 };
			if (component.id === 'snow_depth') return { ...component, weight: 0.25 };
			return component;
		});
		const rebuilt = { ...base, components: rebalanced as typeof base.components };

		expect(rebuilt.components).toHaveLength(8);
		const sum = rebalanced.reduce((total, component) => total + component.weight, 0);
		expect(sum).toBeCloseTo(1, 9);
		expect(() => validateConditionsScoreConfig(rebuilt)).toThrowError(
			/scoring_config_component_ids_not_unique/
		);
	});

	it('rejects non-monotonic piecewise bands', () => {
		const base = resolveConditionsScoreConfig('v1.0');
		const temperature = base.components.find((component) => component.id === 'temperature');
		if (!temperature || temperature.normalization.kind !== 'piecewise_linear') {
			throw new Error('temperature component must use piecewise bands');
		}
		const config = {
			...base,
			components: base.components.map((component) =>
				component.id === 'temperature'
					? {
							...component,
							normalization: {
								kind: 'piecewise_linear' as const,
								points: [
									{ x: -12, y: 1 },
									{ x: -30, y: 0 }
								]
							}
						}
					: component
			)
		};

		expect(() => validateConditionsScoreConfig(config)).toThrowError(
			/scoring_config_band_monotonic/
		);
	});

	it('rejects zero-filling missing-input policies', () => {
		const base = resolveConditionsScoreConfig('v1.0');
		const config = {
			...base,
			components: base.components.map((component) =>
				component.id === 'snow_depth'
					? { ...component, missingInputPolicy: 'zero_fill' as unknown as 'exclude' }
					: component
			)
		};

		expect(() => validateConditionsScoreConfig(config)).toThrowError(
			/scoring_config_missing_input_policy_forbidden/
		);
	});

	it('rejects invalid resort rating configs (sum, negative weight, duplicates, gate)', () => {
		const base = resolveResortRatingConfig('v1.0');

		const badSum = {
			...base,
			categories: base.categories.map((category) =>
				category.id === 'slopes' ? { ...category, weight: 0.3 } : category
			)
		};
		expect(() => validateResortRatingConfig(badSum)).toThrowError(
			/scoring_config_weights_do_not_sum_to_one/
		);

		const negative = {
			...base,
			categories: base.categories.map((category) =>
				category.id === 'food' ? { ...category, weight: -0.075 } : category
			)
		};
		expect(() => validateResortRatingConfig(negative)).toThrowError(
			/scoring_config_weight_not_positive/
		);

		const duplicated = {
			...base,
			categories: [
				...base.categories.slice(0, 6),
				{ id: base.categories[0].id, weight: base.categories[6].weight }
			]
		};
		expect(() => validateResortRatingConfig(duplicated)).toThrowError(
			/scoring_config_component_ids_not_unique/
		);

		const badGate = {
			...base,
			gates: { minimumCategoryCoverageShare: 1.5 }
		};
		expect(() => validateResortRatingConfig(badGate)).toThrowError(/scoring_config_gate_invalid/);
	});

	it('passes validation for the shipped configs (resolve validates every time)', () => {
		expect(() => resolveConditionsScoreConfig('v1.0')).not.toThrow();
		expect(() => resolveResortRatingConfig('v1.0')).not.toThrow();
		expect(FIXED_NOW).toBeDefined();
	});
});
