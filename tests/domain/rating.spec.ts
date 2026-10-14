import { describe, expect, it } from 'vitest';
import { RESORT_RATING_V1, ratingWeightTotal } from '../../src/lib/domain/rating/config.js';
import { computeResortRating } from '../../src/lib/domain/rating/rating.js';
import { RESORT_RATING_VALUES } from '../../src/lib/data/ratings.js';

const ALL_CATEGORIES = {
	atmosphere: 8,
	slopes: 8,
	lifts: 8,
	offpiste: 8,
	accommodation: 8,
	food: 8,
	apres: 8
} as const;

describe('Resort Rating configuration', () => {
	it('weights sum to exactly 1', () => {
		expect(ratingWeightTotal(RESORT_RATING_V1)).toBeCloseTo(1, 10);
	});

	it('stays visibly separate from the Conditions Score configuration', () => {
		expect(RESORT_RATING_V1.version).toBe('v1');
		expect(RESORT_RATING_V1.scaleMax).toBe(10);
		expect(RESORT_RATING_V1.categories.map((entry) => entry.category)).toContain('apres');
	});
});

describe('computeResortRating', () => {
	it('returns the weighted mean on the configured scale', () => {
		const rating = computeResortRating({
			resortId: 'test',
			values: { ...ALL_CATEGORIES, slopes: 10, apres: 4 },
			dataState: 'illustrative'
		});

		// A baseline of 8 everywhere, +0.5 for slopes at 10, -0.3 for après-ski at 4.
		expect(rating.overall).toBeCloseTo(8.2, 10);
		expect(rating.coverage).toBe(1);
		expect(rating.scaleMax).toBe(10);
		expect(rating.categories).toHaveLength(RESORT_RATING_V1.categories.length);
	});

	it('renormalises over the categories that are present instead of counting missing ones as zero', () => {
		const rating = computeResortRating({
			resortId: 'test',
			values: { slopes: 6, lifts: 9 },
			dataState: 'illustrative'
		});

		// (0.25 * 6 + 0.15 * 9) / 0.4 = 7.125, rounded to two decimals on the 0–10 scale.
		expect(rating.overall).toBeCloseTo(7.12, 10);
		expect(rating.coverage).toBeCloseTo(0.4, 10);
	});

	it('clamps values to the scale and never returns a rating without any input', () => {
		const clamped = computeResortRating({
			resortId: 'test',
			values: { slopes: 99, lifts: -5 },
			dataState: 'illustrative'
		});
		// 99 clamps to the 10-point scale, -5 clamps to 0.
		expect(clamped.overall).toBeCloseTo(6.25, 10);

		const empty = computeResortRating({ resortId: 'test', values: {}, dataState: 'illustrative' });
		expect(empty.overall).toBeNull();
		expect(empty.coverage).toBe(0);
	});

	it('treats an explicit null category as missing', () => {
		const rating = computeResortRating({
			resortId: 'test',
			values: { slopes: 7, lifts: null },
			dataState: 'illustrative'
		});
		expect(rating.overall).toBeCloseTo(7, 10);
		expect(rating.coverage).toBeCloseTo(0.25, 10);
	});

	it('carries the data state through so preview values stay labelled', () => {
		const rating = computeResortRating({
			resortId: 'are',
			values: RESORT_RATING_VALUES.are,
			dataState: 'illustrative'
		});
		expect(rating.dataState).toBe('illustrative');
		expect(rating.overall).toBeGreaterThan(8);
		expect(rating.overall).toBeLessThan(9);
	});
});
