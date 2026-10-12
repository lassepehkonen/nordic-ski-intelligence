import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	ScoringConfigError,
	resolveResortRatingConfig
} from '../../src/lib/server/scoring/config.js';
import {
	computeResortRating,
	listResortRatingCategories
} from '../../src/lib/server/scoring/resort-rating.js';
import * as resortRatingModule from '../../src/lib/server/scoring/resort-rating.js';
import { RESORT_RATING_CATEGORY_IDS } from '../../src/lib/server/scoring/types.js';
import type { ResortRatingCategoryId } from '../../src/lib/server/scoring/types.js';

const AS_OF = new Date('2026-12-01T12:00:00Z');
const clock = () => AS_OF;

function completeValues(): Record<ResortRatingCategoryId, number> {
	return {
		atmosphere_environment: 80,
		slopes: 90,
		lifts: 70,
		off_piste: 60,
		accommodation: 75,
		food: 50,
		apres_ski: 40
	};
}

describe('resort rating config', () => {
	it('loads the Master Product Context weights verbatim (15/25/15/20/10/7.5/7.5)', () => {
		const config = resolveResortRatingConfig('v1.0');
		const byId = new Map(config.categories.map((category) => [category.id, category.weight]));

		expect(byId.get('atmosphere_environment')).toBe(0.15);
		expect(byId.get('slopes')).toBe(0.25);
		expect(byId.get('lifts')).toBe(0.15);
		expect(byId.get('off_piste')).toBe(0.2);
		expect(byId.get('accommodation')).toBe(0.1);
		expect(byId.get('food')).toBe(0.075);
		expect(byId.get('apres_ski')).toBe(0.075);
		expect(new Set(config.categories.map((category) => category.id))).toEqual(
			new Set(RESORT_RATING_CATEGORY_IDS)
		);
	});

	it('lists categories through the public API', () => {
		const categories = listResortRatingCategories('v1.0');

		expect(categories).toHaveLength(7);
		expect(categories.map((category) => category.id)).toEqual([...RESORT_RATING_CATEGORY_IDS]);
		const sum = categories.reduce((total, category) => total + category.weight, 0);
		expect(sum).toBeCloseTo(1, 12);
	});
});

describe('computeResortRating arithmetic', () => {
	it('computes the exact weighted mean on the 0–100 scale (happy path)', () => {
		const result = computeResortRating('v1.0', completeValues(), { now: clock });

		expect(result.published).toBe(true);
		expect(result.version).toBe('v1.0');
		expect(result.rating).not.toBeNull();
		const expected =
			(80 * 0.15 + 90 * 0.25 + 70 * 0.15 + 60 * 0.2 + 75 * 0.1 + 50 * 0.075 + 40 * 0.075) * 1;
		expect(result.rating).toBeCloseTo(expected, 6);
		expect(result.coverage.availableCategoryCount).toBe(7);
		expect(result.coverage.coverageShare).toBe(1);
		expect(result.coverage.coverageThreshold).toBe(0.8);
		expect(result.missingCategoryIds).toEqual([]);
		expect(result.computedAt).toBe(AS_OF.toISOString());

		// Per-category contributions sum back to the rating.
		const contributionSum = result.categories.reduce(
			(total, category) => total + (category.contribution ?? 0),
			0
		);
		expect(contributionSum).toBeCloseTo(result.rating ?? 0, 2);
	});

	it('is deterministic for identical inputs and clock', () => {
		const first = computeResortRating('v1.0', completeValues(), { now: clock });
		const second = computeResortRating('v1.0', completeValues(), { now: clock });

		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});

	it('perfect-100 resort rates exactly 100', () => {
		const perfect = Object.fromEntries(RESORT_RATING_CATEGORY_IDS.map((id) => [id, 100])) as Record<
			ResortRatingCategoryId,
			number
		>;
		const result = computeResortRating('v1.0', perfect, { now: clock });

		expect(result.rating).toBe(100);
		expect(result.published).toBe(true);
	});

	it('zero-rated resort rates exactly 0', () => {
		const zero = Object.fromEntries(RESORT_RATING_CATEGORY_IDS.map((id) => [id, 0])) as Record<
			ResortRatingCategoryId,
			number
		>;
		const result = computeResortRating('v1.0', zero, { now: clock });

		expect(result.rating).toBe(0);
		expect(result.published).toBe(true);
	});
});

describe('resort rating missing-value policy', () => {
	it('missing category → skipped with coverage reported, still above gate', () => {
		const values = completeValues();
		const partial = { ...values, apres_ski: null };
		const result = computeResortRating('v1.0', partial, { now: clock });

		expect(result.published).toBe(true);
		expect(result.missingCategoryIds).toEqual(['apres_ski']);
		expect(result.coverage.availableCategoryCount).toBe(6);
		expect(result.coverage.coverageShare).toBeCloseTo(0.925, 6);

		// Weighted mean re-normalizes over available weights only.
		const expected = (80 * 0.15 + 90 * 0.25 + 70 * 0.15 + 60 * 0.2 + 75 * 0.1 + 50 * 0.075) / 0.925;
		expect(result.rating).toBeCloseTo(expected, 4);
		const apres = result.categories.find((category) => category.id === 'apres_ski');
		expect(apres?.status).toBe('missing');
		expect(apres?.value).toBeNull();
		expect(apres?.contribution).toBeNull();
		expect(apres?.reasons.map((entry) => entry.key)).toContain('scoring_category_missing');
	});

	it('below the coverage gate → rating null, published false, explicit reason', () => {
		// slopes (0.25) + atmosphere (0.15) + lifts (0.15) + accommodation (0.1) = 0.65 < 0.8.
		const values = {
			atmosphere_environment: 80,
			slopes: 90,
			lifts: 70,
			accommodation: 75
		};
		const result = computeResortRating('v1.0', values, { now: clock });

		expect(result.rating).toBeNull();
		expect(result.published).toBe(false);
		expect(result.coverage.coverageShare).toBeCloseTo(0.65, 6);
		expect(result.warnings.map((warning) => warning.key)).toContain(
			'scoring_coverage_below_threshold'
		);
		expect(result.explanation().gate.passed).toBe(false);
		// Unpublished results commit to no per-category contributions.
		for (const category of result.categories) {
			if (category.status === 'ok') expect(category.contribution).toBeNull();
		}
	});

	it('all-null categories → empty rating (empty object also throws)', () => {
		const allNull = {
			atmosphere_environment: null,
			slopes: null,
			lifts: null,
			off_piste: null,
			accommodation: null,
			food: null,
			apres_ski: null
		};
		const result = computeResortRating('v1.0', allNull, { now: clock });
		expect(result.rating).toBeNull();
		expect(result.published).toBe(false);
		expect(result.coverage.coverageShare).toBe(0);

		// Empty input object = nothing recognizable → explicit config error, not a silent 0.
		expect(() => computeResortRating('v1.0', {}, { now: clock })).toThrowError(ScoringConfigError);
	});

	it('empty input throws the explicit error (no recognized category)', () => {
		expect(() => computeResortRating('v1.0', {}, { now: clock })).toThrowError(/category/);
	});

	it('non-numeric and out-of-range category values are excluded, not coerced', () => {
		const values = { ...completeValues(), food: Number.NaN, apres_ski: 120 };
		const result = computeResortRating('v1.0', values, { now: clock });

		const food = result.categories.find((category) => category.id === 'food');
		const apres = result.categories.find((category) => category.id === 'apres_ski');
		expect(food?.status).toBe('missing');
		expect(apres?.status).toBe('missing');
		expect(result.coverage.coverageShare).toBeCloseTo(0.85, 6);
		expect(result.published).toBe(true);
	});

	it('unknown category ids with some recognized keys → ignored and reported, rating unaffected', () => {
		const values = { ...completeValues(), trivago_score: 99, guest_reviews_avg: 4.7 };
		const result = computeResortRating('v1.0', values, { now: clock });

		expect(result.ignoredInputKeys).toEqual(['guest_reviews_avg', 'trivago_score']);
		// The rating must be identical to the clean-input computation.
		const clean = computeResortRating('v1.0', completeValues(), { now: clock });
		expect(result.rating).toBe(clean.rating);
		expect(result.warnings.map((warning) => warning.key)).toContain(
			'scoring_unknown_category_ignored'
		);
	});

	it('input with ONLY unknown keys throws instead of returning an empty rating', () => {
		expect(() =>
			computeResortRating('v1.0', { tripadvisor_rating: 4.5 }, { now: clock })
		).toThrowError(ScoringConfigError);
	});
});

describe('structural separation from external ratings/reviews', () => {
	it('public API contains no review/external-rating concept', () => {
		const exportedKeys = Object.keys(resortRatingModule).sort();

		expect(exportedKeys).toEqual(['computeResortRating', 'listResortRatingCategories']);
		for (const key of exportedKeys) {
			expect(key.toLowerCase()).not.toContain('review');
			expect(key.toLowerCase()).not.toContain('external');
		}
	});

	it('module source imports nothing about reviews or external ratings', () => {
		const source = readFileSync(
			new URL('../../src/lib/server/scoring/resort-rating.ts', import.meta.url),
			'utf8'
		);
		for (const line of source.split('\n')) {
			const trimmed = line.trimStart();
			if (trimmed.startsWith('import')) {
				expect(line).not.toMatch(/review|external/i);
			}
		}
	});

	it('unknown extra properties in categoryValues can never influence the rating', () => {
		const polluted = {
			...completeValues(),
			reviews_avg: 1,
			external_score: 0,
			popularity_rank: 42
		};
		const clean = computeResortRating('v1.0', completeValues(), { now: clock });
		const withPollution = computeResortRating('v1.0', polluted, { now: clock });

		expect(withPollution.rating).toBe(clean.rating);
		expect(JSON.stringify(withPollution.categories.map((category) => category.contribution))).toBe(
			JSON.stringify(clean.categories.map((category) => category.contribution))
		);
		expect(withPollution.ignoredInputKeys).toEqual([
			'external_score',
			'popularity_rank',
			'reviews_avg'
		]);
	});
});

describe('clock injection', () => {
	it('requires an injected clock', () => {
		expect(() =>
			computeResortRating('v1.0', completeValues(), null as unknown as { now: () => Date })
		).toThrowError(/scoring_compute_requires_injected_clock/);
	});
});
