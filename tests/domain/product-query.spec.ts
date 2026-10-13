import { describe, expect, it } from 'vitest';
import {
	COMPARE_LIMIT,
	filterAndSortResorts,
	findResort,
	isQueryActive,
	parseCompareSelection,
	parseResortQuery,
	parseSort,
	pickBestConditions,
	pickFreshestSnow,
	selectComparison,
	toggleCompareSelection,
	type ResortQuery
} from '../../src/lib/server/resorts/product-query.js';
import { buildProductView, type ResortView } from '../../src/lib/server/resorts/product-view.js';
import { TEST_NOW, pilotResort, pilotSnapshot } from './pilot-fixture.js';

function resortViews(): ResortView[] {
	return buildProductView(
		pilotSnapshot([
			pilotResort({
				slug: 'levi',
				name: 'Levi',
				region: 'Kittilä, Lapland',
				openPistes: 3,
				totalPistes: 44
			}),
			pilotResort({
				slug: 'are',
				name: 'Åre',
				countryCode: 'SE',
				region: 'Åre, Jämtland',
				weatherProvider: 'smhi',
				openPistes: 0,
				totalPistes: 39,
				openLifts: 0,
				totalLifts: 16,
				snowDepthCm: 85,
				recentSnowfall24hCm: 7,
				snowSourceUrl: 'https://example.test/are-snow'
			}),
			pilotResort({
				slug: 'yllas',
				name: 'Ylläs',
				region: 'Kolari, Lapland',
				statusFreshness: 'unavailable',
				openPistes: null,
				totalPistes: null,
				openLifts: null,
				totalLifts: null,
				checkedAt: null,
				current: null,
				forecast: []
			})
		]),
		{ now: TEST_NOW }
	).resorts;
}

const SLUGS = ['levi', 'are', 'yllas'];

function query(overrides: Partial<ResortQuery> = {}): ResortQuery {
	return {
		q: '',
		country: null,
		minScore: null,
		freshSnow: null,
		openPistes: null,
		sort: 'score',
		compare: [],
		...overrides
	};
}

describe('parseResortQuery', () => {
	it('returns neutral defaults for an empty query string', () => {
		const parsed = parseResortQuery(new URLSearchParams(), { availableSlugs: SLUGS });

		expect(parsed).toEqual(query());
		expect(isQueryActive(parsed)).toBe(false);
	});

	it('accepts valid filters and clamps numbers to their range', () => {
		const parsed = parseResortQuery(
			new URLSearchParams({
				q: '  lapland  ',
				country: 'fi',
				minScore: '180',
				freshSnow: '-4',
				openPistes: '25',
				sort: 'freshSnow'
			}),
			{ availableSlugs: SLUGS }
		);

		expect(parsed.q).toBe('lapland');
		expect(parsed.country).toBe('FI');
		expect(parsed.minScore).toBe(100);
		expect(parsed.freshSnow).toBe(0);
		expect(parsed.openPistes).toBe(25);
		expect(parsed.sort).toBe('freshSnow');
		expect(isQueryActive(parsed)).toBe(true);
	});

	it('ignores unknown values instead of failing', () => {
		const parsed = parseResortQuery(
			new URLSearchParams({ country: 'DK', sort: 'rating', minScore: 'abc', freshSnow: '' }),
			{ availableSlugs: SLUGS }
		);

		expect(parsed.country).toBeNull();
		expect(parsed.sort).toBe('score');
		expect(parsed.minScore).toBeNull();
		expect(parsed.freshSnow).toBeNull();
		expect(parseSort(null)).toBe('score');
	});

	it('caps the search term length', () => {
		const parsed = parseResortQuery(new URLSearchParams({ q: 'x'.repeat(200) }), {
			availableSlugs: SLUGS
		});

		expect(parsed.q.length).toBe(60);
	});
});

describe('parseCompareSelection', () => {
	it('keeps known slugs, drops duplicates and unknown slugs, and caps the list', () => {
		const selection = parseCompareSelection('are,are,levi,unknown,yllas,levi', SLUGS);

		expect(selection).toEqual(['are', 'levi', 'yllas']);
		expect(parseCompareSelection('a,b,c,d,e', ['a', 'b', 'c', 'd', 'e'])).toHaveLength(
			COMPARE_LIMIT
		);
		expect(parseCompareSelection(null, SLUGS)).toEqual([]);
	});
});

describe('filterAndSortResorts', () => {
	it('filters by country and free-text search across name and region', () => {
		const resorts = resortViews();

		expect(filterAndSortResorts(resorts, query({ country: 'SE' })).map((r) => r.slug)).toEqual([
			'are'
		]);
		expect(
			filterAndSortResorts(resorts, query({ q: 'lapland' }))
				.map((r) => r.slug)
				.sort()
		).toEqual(['levi', 'yllas']);
		expect(filterAndSortResorts(resorts, query({ q: 'LEVI' })).map((r) => r.slug)).toEqual([
			'levi'
		]);
	});

	it('never lets an unpublished score satisfy a minimum score filter', () => {
		const resorts = resortViews();
		const filtered = filterAndSortResorts(resorts, query({ minScore: 1 }));

		expect(filtered.map((r) => r.slug)).not.toContain('yllas');
		expect(filtered.every((r) => r.score.published && (r.score.score ?? 0) >= 1)).toBe(true);
	});

	it('treats missing fresh snow and unknown open terrain as non-matching', () => {
		const resorts = resortViews();

		expect(filterAndSortResorts(resorts, query({ freshSnow: 1 })).map((r) => r.slug)).toEqual([
			'are'
		]);
		expect(
			filterAndSortResorts(resorts, query({ openPistes: 1 }))
				.map((r) => r.slug)
				.sort()
		).toEqual(['levi']);
	});

	it('sorts by score with unpublished resorts last, and by name with the active locale', () => {
		const resorts = resortViews();

		const byScore = filterAndSortResorts(resorts, query({ sort: 'score' }));
		expect(byScore[byScore.length - 1]?.slug).toBe('yllas');

		const byName = filterAndSortResorts(resorts, query({ sort: 'name' }), { locale: 'fi' });
		expect(byName.map((r) => r.name)).toEqual(
			[...byName.map((r) => r.name)].sort((a, b) => a.localeCompare(b, 'fi'))
		);

		const bySnow = filterAndSortResorts(resorts, query({ sort: 'freshSnow' }));
		expect(bySnow[0]?.slug).toBe('are');
	});
});

describe('highlights', () => {
	it('picks the best published score and the freshest snow, ignoring unknowns', () => {
		const resorts = resortViews();
		const best = pickBestConditions(resorts);
		const freshest = pickFreshestSnow(resorts);

		expect(best).not.toBeNull();
		expect(best?.score.published).toBe(true);
		expect(best?.slug).not.toBe('yllas');
		expect(freshest?.slug).toBe('are');
	});

	it('returns null when no resort has a usable published value', () => {
		const unpublished = buildProductView(
			pilotSnapshot([
				pilotResort({
					openPistes: null,
					totalPistes: null,
					openLifts: null,
					totalLifts: null,
					current: null,
					forecast: [],
					checkedAt: null
				})
			]),
			{ now: TEST_NOW }
		).resorts;

		expect(pickBestConditions(unpublished)).toBeNull();
		expect(pickFreshestSnow(unpublished)).toBeNull();
	});
});

describe('comparison selection', () => {
	it('selects resorts in the requested order and skips unknown slugs', () => {
		const resorts = resortViews();
		const selected = selectComparison(resorts, ['are', 'ghost', 'levi']);

		expect(selected.map((r) => r.slug)).toEqual(['are', 'levi']);
		expect(findResort(resorts, 'levi')?.name).toBe('Levi');
		expect(findResort(resorts, 'ghost')).toBeNull();
		expect(findResort(resorts, undefined)).toBeNull();
	});

	it('toggles a selection and refuses to exceed the limit', () => {
		expect(toggleCompareSelection([], 'levi')).toEqual(['levi']);
		expect(toggleCompareSelection(['levi'], 'levi')).toEqual([]);
		expect(toggleCompareSelection(['a', 'b', 'c', 'd'], 'e')).toEqual(['a', 'b', 'c', 'd']);
		expect(toggleCompareSelection(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
	});
});
