import { describe, expect, it } from 'vitest';
import {
	buildProductView,
	buildResortRatingView,
	buildResortView
} from '../../src/lib/server/resorts/product-view.js';
import { TEST_NOW, pilotResort, pilotSnapshot, weatherPoint } from './pilot-fixture.js';

describe('product view — Conditions Score wiring', () => {
	it('publishes a score when the available inputs pass the coverage gate', () => {
		const view = buildResortView(pilotResort(), { now: TEST_NOW });

		expect(view.score.published).toBe(true);
		expect(view.score.version).toBe('v1.0');
		expect(view.score.score).not.toBeNull();
		expect(view.score.score ?? -1).toBeGreaterThanOrEqual(0);
		expect(view.score.score ?? 101).toBeLessThanOrEqual(100);
		expect(view.score.gatePassed).toBe(true);
		expect(view.score.coverage.availableWeightShare).toBeGreaterThanOrEqual(
			view.score.coverage.publishThreshold
		);
		expect(view.score.components).toHaveLength(8);
	});

	it('keeps missing inputs explicit instead of counting them as zero', () => {
		const view = buildResortView(pilotResort(), { now: TEST_NOW });
		const byId = new Map(view.score.components.map((component) => [component.id, component]));

		// The Phase 5 pilot reports no snow depth, no 24 h snowfall and no snow quality anywhere.
		for (const id of ['snow_depth', 'recent_snow', 'snow_quality'] as const) {
			const component = byId.get(id);
			expect(component?.status).toBe('missing');
			expect(component?.normalized).toBeNull();
			expect(component?.points).toBeNull();
			expect(component?.shareOfWeights).toBe(0);
			expect(component?.reasonKeys.length ?? 0).toBeGreaterThan(0);
		}
		expect(view.score.missingComponentIds).toContain('snow_depth');
		expect(view.score.missingComponentIds).toContain('recent_snow');
	});

	it('withholds the score when too few comparable inputs exist', () => {
		const view = buildResortView(
			pilotResort({
				openLifts: null,
				totalLifts: null,
				openPistes: null,
				totalPistes: null,
				statusFreshness: 'unavailable',
				checkedAt: null,
				current: null,
				forecast: []
			}),
			{ now: TEST_NOW }
		);

		expect(view.score.published).toBe(false);
		expect(view.score.score).toBeNull();
		expect(view.score.gatePassed).toBe(false);
		expect(view.score.gateReasonKeys).toContain('scoring_coverage_below_threshold');
		expect(view.score.coverage.availableWeightShare).toBe(0);
	});

	it('excludes inputs that are older than the freshness limit', () => {
		const view = buildResortView(
			pilotResort({
				// 30 days old: beyond every component's maxAgeHours and the global staleness horizon.
				checkedAt: '2026-09-12T11:29:27.000Z'
			}),
			{ now: TEST_NOW }
		);

		expect(view.score.staleComponentIds).toContain('terrain_open_ratio');
		expect(view.score.staleComponentIds).toContain('lifts_open_ratio');
		expect(view.score.published).toBe(false);
	});
});

describe('product view — terrain, weather and provenance', () => {
	it('reports open shares as fractions and keeps unknown totals null', () => {
		const partial = buildResortView(
			pilotResort({ openPistes: 3, totalPistes: 44, openLifts: null, totalLifts: 9 }),
			{ now: TEST_NOW }
		);
		expect(partial.terrain.pistesOpenRatio).toBeCloseTo(3 / 44, 6);
		expect(partial.terrain.liftsOpenRatio).toBeNull();

		const zeroOpen = buildResortView(pilotResort({ openPistes: 0, totalPistes: 26 }), {
			now: TEST_NOW
		});
		// A closed resort reports a real 0, and 0 must not be confused with "unknown".
		expect(zeroOpen.terrain.pistesOpenRatio).toBe(0);

		const unknownTotal = buildResortView(pilotResort({ openPistes: null, totalPistes: null }), {
			now: TEST_NOW
		});
		expect(unknownTotal.terrain.pistesOpenRatio).toBeNull();
	});

	it('carries every attributed source and only adds a snow source when one exists', () => {
		const withoutSnow = buildResortView(pilotResort(), { now: TEST_NOW });
		expect(withoutSnow.sources.map((source) => source.kind)).toEqual([
			'location',
			'inventory',
			'status',
			'weather'
		]);

		const withSnow = buildResortView(
			pilotResort({
				snowDepthCm: 65,
				recentSnowfall24hCm: 4,
				snowObservedAt: '2026-10-12T06:00:00.000Z',
				snowSourceUrl: 'https://example.test/snow-report'
			}),
			{ now: TEST_NOW }
		);
		expect(withSnow.sources.map((source) => source.kind)).toContain('snow');
		expect(withSnow.weather.snow.depthCm).toBe(65);
	});

	it('takes lastUpdated from the newest status or weather timestamp', () => {
		const both = buildResortView(pilotResort(), { now: TEST_NOW });
		expect(both.lastUpdated).toBe('2026-10-12T13:03:20.623Z');

		const none = buildResortView(pilotResort({ checkedAt: null, fetchedAt: null }), {
			now: TEST_NOW
		});
		expect(none.lastUpdated).toBeNull();
	});

	it('maps forecast points without inventing values', () => {
		const view = buildResortView(
			pilotResort({
				forecast: [
					weatherPoint({ validAt: '2026-10-12T15:00:00.000Z', snowfallMm: 1.5 }),
					weatherPoint({ validAt: '2026-10-12T18:00:00.000Z', snowfallMm: null })
				]
			}),
			{ now: TEST_NOW }
		);

		expect(view.weather.forecast).toHaveLength(2);
		expect(view.weather.forecast[0]?.snowfallMm).toBe(1.5);
		expect(view.weather.forecast[1]?.snowfallMm).toBeNull();
	});
});

describe('product view — Resort Rating stays unpublished without approved values', () => {
	it('exposes the seven configured weights with no values', () => {
		const rating = buildResortRatingView();

		expect(rating.published).toBe(false);
		expect(rating.rating).toBeNull();
		expect(rating.categories.map((category) => category.id)).toEqual([
			'atmosphere_environment',
			'slopes',
			'lifts',
			'off_piste',
			'accommodation',
			'food',
			'apres_ski'
		]);
		expect(rating.categories.map((category) => category.weight)).toEqual([
			0.15, 0.25, 0.15, 0.2, 0.1, 0.075, 0.075
		]);
		expect(rating.categories.every((category) => category.value === null)).toBe(true);
		expect(rating.reasonKeys).toContain('scoring_coverage_below_threshold');
	});

	it('computes a rating once category values are supplied', () => {
		const rating = buildResortRatingView(
			{
				atmosphere_environment: 80,
				slopes: 90,
				lifts: 70,
				off_piste: 60,
				accommodation: 75,
				food: 70,
				apres_ski: 65
			},
			TEST_NOW
		);

		expect(rating.published).toBe(true);
		expect(rating.rating).toBeCloseTo(
			80 * 0.15 + 90 * 0.25 + 70 * 0.15 + 60 * 0.2 + 75 * 0.1 + 70 * 0.075 + 65 * 0.075,
			4
		);
		expect(rating.missingCategoryIds).toEqual([]);
	});
});

describe('product view — snapshot aggregation', () => {
	it('builds every resort and takes the shared lastUpdated from the newest one', () => {
		const product = buildProductView(
			pilotSnapshot([
				pilotResort({ slug: 'levi', name: 'Levi' }),
				pilotResort({
					slug: 'are',
					name: 'Åre',
					countryCode: 'SE',
					weatherProvider: 'smhi',
					fetchedAt: '2026-10-12T13:03:21.500Z'
				})
			]),
			{ now: TEST_NOW }
		);

		expect(product.resorts.map((resort) => resort.slug)).toEqual(['levi', 'are']);
		expect(product.lastUpdated).toBe('2026-10-12T13:03:21.500Z');
		expect(product.lastCollectionRun?.outcome).toBe('success');
	});
});
