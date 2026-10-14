import { describe, expect, it } from 'vitest';
import { createPreviewRepositories } from '../../src/lib/data/repository.js';
import {
	DEFAULT_FILTERS,
	MAX_COMPARISON_RESORTS,
	bestByConditions,
	buildComparisonSections,
	comparisonHref,
	filterResorts,
	filtersToSearchParams,
	freshestSnow,
	matchesQuery,
	parseComparisonSelection,
	parseFilters,
	ratio,
	sortResorts
} from '../../src/lib/domain/selectors.js';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const repositories = createPreviewRepositories();
const items = repositories.listItems('en', NOW);

const countryLabel = (country: string) =>
	({ FI: 'Finland', SE: 'Sweden', NO: 'Norway' })[country] ?? country;

describe('resort list composition', () => {
	it('produces one localized list item per resort, each with a score and a rating', () => {
		expect(items).toHaveLength(10);
		for (const item of items) {
			expect(item.translation.name).not.toBe('');
			for (const locale of ['fi', 'en', 'sv', 'no'] as const) {
				expect(item.resort.translations[locale].name).not.toBe('');
				expect(item.resort.translations[locale].summary.length).toBeGreaterThan(10);
			}
			expect(item.score.resortId).toBe(item.resort.id);
			expect(item.rating.resortId).toBe(item.resort.id);
		}
	});

	it('derives open ratios from the open/total pairs and never divides by zero', () => {
		const withTerrain = items.find((item) => item.resort.terrain.pistes !== null);
		expect(withTerrain?.openPisteRatio).not.toBeNull();
		expect(withTerrain?.openPisteRatio).toBeCloseTo(
			(withTerrain?.metrics.openPistes ?? 0) / (withTerrain?.metrics.totalPistes ?? 1),
			10
		);
		expect(ratio(3, 0)).toBeNull();
		expect(ratio(null, 10)).toBeNull();
		expect(ratio(4, 2)).toBe(1);
	});

	it('leaves resorts without sourced terrain figures short of coverage rather than inventing values', () => {
		const hafjell = items.find((item) => item.resort.id === 'hafjell');
		expect(hafjell?.metrics.openPistes).toBeNull();
		expect(hafjell?.openPisteRatio).toBeNull();
		expect(hafjell?.score.coverage).toBeLessThan(1);
	});
});

describe('filterResorts', () => {
	it('filters by country', () => {
		expect(filterResorts(items, { ...DEFAULT_FILTERS, country: 'FI' })).toHaveLength(4);
		expect(filterResorts(items, { ...DEFAULT_FILTERS, country: 'NO' })).toHaveLength(3);
	});

	it('filters by minimum score, fresh snow and open-piste ratio', () => {
		const scored = filterResorts(items, { ...DEFAULT_FILTERS, minScore: 60 });
		expect(scored.length).toBeGreaterThan(0);
		expect(scored.every((item) => (item.score.score ?? -1) >= 60)).toBe(true);

		const snowy = filterResorts(items, { ...DEFAULT_FILTERS, minNewSnow: 20 });
		expect(snowy.length).toBeGreaterThan(0);
		expect(snowy.every((item) => (item.metrics.newSnow24hCm ?? -1) >= 20)).toBe(true);

		const open = filterResorts(items, { ...DEFAULT_FILTERS, minOpenPisteRatio: 0.85 });
		expect(open.every((item) => (item.openPisteRatio ?? -1) >= 0.85)).toBe(true);
	});

	it('matches search terms case- and diacritic-insensitively, across name and region', () => {
		const levi = items.find((item) => item.resort.id === 'levi');
		const are = items.find((item) => item.resort.id === 'are');
		expect(levi && matchesQuery(levi, 'LEVI')).toBe(true);
		expect(are && matchesQuery(are, 'are')).toBe(true);
		expect(are && matchesQuery(are, 'Åre')).toBe(true);
		expect(levi && matchesQuery(levi, 'kuusamo')).toBe(false);
		expect(filterResorts(items, { ...DEFAULT_FILTERS, query: 'lappi' })).toHaveLength(0);
		expect(filterResorts(items, { ...DEFAULT_FILTERS, query: 'lapland' })).toHaveLength(2);
	});

	it('combines filters without reordering the input', () => {
		const combined = filterResorts(items, {
			...DEFAULT_FILTERS,
			country: 'FI',
			minNewSnow: 10,
			query: 'l'
		});
		const ids = combined.map((item) => item.resort.id);
		expect(ids).toEqual(items.map((item) => item.resort.id).filter((id) => ids.includes(id)));
	});
});

describe('sortResorts', () => {
	it('orders by the requested key', () => {
		const byScore = sortResorts(items, 'best_conditions');
		const bySnow = sortResorts(items, 'fresh_snow');
		const byDepth = sortResorts(items, 'snow_depth');
		const byRating = sortResorts(items, 'rating');

		expect(byScore[0].score.score ?? 0).toBeGreaterThanOrEqual(byScore[1].score.score ?? 0);
		expect(bySnow[0].metrics.newSnow24hCm ?? 0).toBeGreaterThanOrEqual(
			bySnow[1].metrics.newSnow24hCm ?? 0
		);
		expect(byDepth[0].metrics.snowDepthCm ?? 0).toBeGreaterThanOrEqual(
			byDepth[1].metrics.snowDepthCm ?? 0
		);
		expect(byRating[0].rating.overall ?? 0).toBeGreaterThanOrEqual(byRating[1].rating.overall ?? 0);
	});

	it('sorts by localized name without mutating the input array', () => {
		const copy = [...items];
		const byName = sortResorts(items, 'name');
		expect(items).toEqual(copy);
		expect(byName.map((item) => item.translation.name)).toEqual(
			[...items].map((item) => item.translation.name).sort(new Intl.Collator('en').compare)
		);
	});

	it('sorts localized names according to the active locale collation', () => {
		const swedish = repositories.listItems('sv', NOW);
		const byName = sortResorts(swedish, 'name', 'sv');
		expect(byName[0].translation.name).toBe('Hafjell');
		expect(byName.at(-1)?.translation.name).toBe('Åre');
	});
});

describe('highlight selections', () => {
	it('returns at most the requested number of best-condition resorts, all with a score', () => {
		const best = bestByConditions(items, 3);
		expect(best).toHaveLength(3);
		expect(best.every((item) => item.score.score !== null)).toBe(true);
		expect(best[0].score.score ?? 0).toBeGreaterThanOrEqual(best[2].score.score ?? 0);
	});

	it('returns the snowiest resorts and excludes resorts with no reported snowfall', () => {
		const fresh = freshestSnow(items, 3);
		expect(fresh).toHaveLength(3);
		expect(fresh.every((item) => (item.metrics.newSnow24hCm ?? 0) > 0)).toBe(true);
		const withoutSnow = items.map((item) => ({
			...item,
			metrics: { ...item.metrics, newSnow24hCm: null }
		}));
		expect(freshestSnow(withoutSnow, 3)).toHaveLength(0);
	});
});

describe('filter URL round-trip', () => {
	it('parses and serializes filters without losing meaning', () => {
		const params = new URLSearchParams('country=NO&score=75&snow=15&open=0.5&q=trysil&sort=name');
		const filters = parseFilters(params);
		expect(filters).toEqual({
			country: 'NO',
			minScore: 75,
			minNewSnow: 15,
			minOpenPisteRatio: 0.5,
			query: 'trysil',
			sort: 'name'
		});
		expect(filtersToSearchParams(filters).toString()).toBe(
			'country=NO&score=75&snow=15&open=0.5&q=trysil&sort=name'
		);
	});

	it('ignores hostile or meaningless filter values', () => {
		const filters = parseFilters(
			new URLSearchParams('country=XX&score=-5&snow=abc&open=9&sort=drop+database')
		);
		expect(filters).toEqual(DEFAULT_FILTERS);
		expect(filtersToSearchParams({ ...DEFAULT_FILTERS, sort: 'name' }).toString()).toBe(
			'sort=name'
		);
	});

	it('caps the search term length', () => {
		const long = 'x'.repeat(200);
		expect(parseFilters(new URLSearchParams({ q: long })).query).toHaveLength(80);
	});
});

describe('comparison selection', () => {
	it('reads a comma-separated selection and a repeated-parameter form alike', () => {
		expect(parseComparisonSelection(new URLSearchParams('resorts=levi,trysil'))).toEqual([
			'levi',
			'trysil'
		]);
		expect(
			parseComparisonSelection(new URLSearchParams('resorts=levi&resorts=trysil&resorts=are'))
		).toEqual(['levi', 'trysil', 'are']);
	});

	it('normalises, de-duplicates and caps the selection at three resorts', () => {
		expect(
			parseComparisonSelection(new URLSearchParams('resorts=Levi,levi,TRYSIL,are,salen'))
		).toEqual(['levi', 'trysil', 'are']);
		expect(parseComparisonSelection(new URLSearchParams(''))).toEqual([]);
	});

	it('builds comparison links that add a resort without exceeding the cap', () => {
		expect(comparisonHref([], 'levi')).toBe('/compare?resorts=levi');
		expect(comparisonHref(['levi', 'trysil'], 'are')).toBe('/compare?resorts=levi%2Ctrysil%2Care');
		expect(comparisonHref(['levi', 'trysil', 'are'], 'salen')).toBe(
			`/compare?resorts=levi%2Ctrysil%2Care`
		);
		expect(comparisonHref(['levi'], 'levi')).toBe('/compare?resorts=levi');
		expect(MAX_COMPARISON_RESORTS).toBe(3);
	});
});

describe('comparison model', () => {
	const selected = ['levi', 'trysil', 'hemsedal']
		.map((slug) => items.find((item) => item.resort.id === slug))
		.filter((item): item is (typeof items)[number] => Boolean(item));

	it('covers conditions, rating, weather and terrain for every selected resort', () => {
		const sections = buildComparisonSections(selected, countryLabel);
		expect(sections.map((section) => section.id)).toEqual([
			'conditions',
			'rating',
			'weather',
			'terrain'
		]);
		for (const section of sections) {
			for (const row of section.rows) {
				expect(row.values).toHaveLength(selected.length);
			}
		}
	});

	it('marks the best resort per row, in the direction that is actually better', () => {
		const sections = buildComparisonSections(selected, countryLabel);
		const scoreRow = sections[0].rows.find((row) => row.id === 'score');
		const windRow = sections[2].rows.find((row) => row.id === 'wind');

		expect(scoreRow?.kind).toBe('number');
		if (scoreRow?.kind === 'number') {
			const best = Math.max(...scoreRow.values.map((value) => value ?? -Infinity));
			expect(scoreRow.values[scoreRow.bestIndex ?? -1]).toBe(best);
		}
		expect(windRow?.kind).toBe('number');
		if (windRow?.kind === 'number') {
			// Lower wind is better, so the row must be flagged as lower-is-better.
			expect(windRow.higherIsBetter).toBe(false);
			const best = Math.min(...windRow.values.map((value) => value ?? Infinity));
			expect(windRow.values[windRow.bestIndex ?? -1]).toBe(best);
		}
	});

	it('renders country and region as text rows and leaves unreported values null', () => {
		const sections = buildComparisonSections(selected, countryLabel);
		const countryRow = sections[0].rows.find((row) => row.id === 'country');
		expect(countryRow?.kind).toBe('text');
		if (countryRow?.kind === 'text') {
			expect(countryRow.values).toEqual(['Finland', 'Norway', 'Norway']);
		}

		const verticalRow = sections[3].rows.find((row) => row.id === 'vertical');
		expect(verticalRow?.kind).toBe('number');
		if (verticalRow?.kind === 'number') {
			// Hafjell-like missing data must stay null rather than becoming 0.
			expect(verticalRow.values.some((value) => value === null)).toBe(true);
		}
	});

	it('flags no winner when every resort ties on a row', () => {
		const [first] = selected;
		const sections = buildComparisonSections([first, first], countryLabel);
		const scoreRow = sections[0].rows.find((row) => row.id === 'score');
		expect(scoreRow?.kind === 'number' && scoreRow.bestIndex).toBeNull();
	});
});
