/**
 * Product query layer (Phase 7) — pure parsing, filtering, sorting and comparison selection for
 * the map/list UI. Everything here is deterministic and free of framework or network coupling so
 * the same rules can be unit-tested and reused by the JSON API.
 *
 * URL contract (all optional, invalid values are ignored rather than rejected):
 *   ?q=<text>&country=FI|SE|NO&minScore=<0-100>&freshSnow=<cm>&openPistes=<percent>
 *   &sort=score|freshSnow|snowDepth|name&compare=slug,slug,...
 */
import type { ResortView } from './product-view.js';

export const COMPARE_LIMIT = 4;
export const DEFAULT_SORT = 'score';

export const RESORT_SORTS = ['score', 'freshSnow', 'snowDepth', 'name'] as const;
export type ResortSort = (typeof RESORT_SORTS)[number];

export const COUNTRY_CODES = ['FI', 'SE', 'NO'] as const;
export type QueryCountry = (typeof COUNTRY_CODES)[number];

export interface ResortQuery {
	readonly q: string;
	readonly country: QueryCountry | null;
	readonly minScore: number | null;
	readonly freshSnow: number | null;
	readonly openPistes: number | null;
	readonly sort: ResortSort;
	readonly compare: readonly string[];
}

const MAX_SEARCH_LENGTH = 60;

function clampInt(value: string | null, min: number, max: number): number | null {
	if (value === null || value.trim() === '') return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return null;
	return Math.min(Math.max(parsed, min), max);
}

export function parseSort(value: string | null): ResortSort {
	return RESORT_SORTS.includes(value as ResortSort) ? (value as ResortSort) : DEFAULT_SORT;
}

export function parseCompareSelection(
	value: string | null,
	availableSlugs: readonly string[]
): string[] {
	if (!value) return [];
	const known = new Set(availableSlugs);
	const seen = new Set<string>();
	const selection: string[] = [];

	for (const raw of value.split(',')) {
		const slug = raw.trim();
		if (slug === '' || seen.has(slug) || !known.has(slug)) continue;
		seen.add(slug);
		selection.push(slug);
		if (selection.length === COMPARE_LIMIT) break;
	}

	return selection;
}

export function parseResortQuery(
	searchParams: URLSearchParams,
	options: { availableSlugs: readonly string[] }
): ResortQuery {
	const rawCountry = (searchParams.get('country') ?? '').toUpperCase();
	const q = (searchParams.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH);

	return {
		q,
		country: COUNTRY_CODES.includes(rawCountry as QueryCountry)
			? (rawCountry as QueryCountry)
			: null,
		minScore: clampInt(searchParams.get('minScore'), 0, 100),
		freshSnow: clampInt(searchParams.get('freshSnow'), 0, 200),
		openPistes: clampInt(searchParams.get('openPistes'), 0, 100),
		sort: parseSort(searchParams.get('sort')),
		compare: parseCompareSelection(searchParams.get('compare'), options.availableSlugs)
	};
}

export function isQueryActive(query: ResortQuery): boolean {
	return (
		query.q !== '' ||
		query.country !== null ||
		query.minScore !== null ||
		query.freshSnow !== null ||
		query.openPistes !== null ||
		query.sort !== DEFAULT_SORT
	);
}

function matchesSearch(resort: ResortView, needle: string): boolean {
	if (needle === '') return true;
	const haystack =
		`${resort.name} ${resort.region} ${resort.slug} ${resort.countryCode}`.toLowerCase();
	return haystack.includes(needle.toLowerCase());
}

export function matchesQuery(resort: ResortView, query: ResortQuery): boolean {
	if (query.country !== null && resort.countryCode !== query.country) return false;
	if (!matchesSearch(resort, query.q)) return false;

	if (query.minScore !== null) {
		// An unpublished score can never satisfy a minimum: it is unknown, not zero.
		if (!resort.score.published || resort.score.score === null) return false;
		if (resort.score.score < query.minScore) return false;
	}

	if (query.freshSnow !== null) {
		const fresh = resort.weather.snow.recentSnowfall24hCm;
		if (fresh === null || fresh < query.freshSnow) return false;
	}

	if (query.openPistes !== null) {
		const ratio = resort.terrain.pistesOpenRatio;
		if (ratio === null || ratio * 100 < query.openPistes) return false;
	}

	return true;
}

function descendingWithNullsLast(a: number | null, b: number | null): number {
	if (a === null && b === null) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	return b - a;
}

function compareByName(a: ResortView, b: ResortView, locale: string): number {
	return a.name.localeCompare(b.name, locale);
}

export function sortResorts(
	resorts: readonly ResortView[],
	sort: ResortSort,
	locale = 'en'
): ResortView[] {
	const sorted = [...resorts];
	sorted.sort((a, b) => {
		switch (sort) {
			case 'freshSnow':
				return descendingWithNullsLast(
					a.weather.snow.recentSnowfall24hCm,
					b.weather.snow.recentSnowfall24hCm
				);
			case 'snowDepth':
				return descendingWithNullsLast(a.weather.snow.depthCm, b.weather.snow.depthCm);
			case 'name':
				return compareByName(a, b, locale);
			case 'score':
			default: {
				const aScore = a.score.published ? a.score.score : null;
				const bScore = b.score.published ? b.score.score : null;
				const byScore = descendingWithNullsLast(aScore, bScore);
				// Unpublished scores tie: fall back to the freshest snow, then the name.
				if (byScore !== 0) return byScore;
				const bySnow = descendingWithNullsLast(
					a.weather.snow.recentSnowfall24hCm,
					b.weather.snow.recentSnowfall24hCm
				);
				return bySnow !== 0 ? bySnow : compareByName(a, b, locale);
			}
		}
	});
	return sorted;
}

export function filterAndSortResorts(
	resorts: readonly ResortView[],
	query: ResortQuery,
	options: { locale?: string } = {}
): ResortView[] {
	const filtered = resorts.filter((resort) => matchesQuery(resort, query));
	return sortResorts(filtered, query.sort, options.locale ?? 'en');
}

/** Highest published Conditions Score, or null when no shown resort has a published score. */
export function pickBestConditions(resorts: readonly ResortView[]): ResortView | null {
	let best: ResortView | null = null;
	for (const resort of resorts) {
		if (!resort.score.published || resort.score.score === null) continue;
		if (best === null || (best.score.score ?? -1) < resort.score.score) best = resort;
	}
	return best;
}

/** Most snow in the last 24 hours, or null when no shown resort reports fresh snow. */
export function pickFreshestSnow(resorts: readonly ResortView[]): ResortView | null {
	let freshest: ResortView | null = null;
	for (const resort of resorts) {
		const fresh = resort.weather.snow.recentSnowfall24hCm;
		if (fresh === null || fresh <= 0) continue;
		const current = freshest?.weather.snow.recentSnowfall24hCm ?? -1;
		if (freshest === null || fresh > current) freshest = resort;
	}
	return freshest;
}

export function findResort(
	resorts: readonly ResortView[],
	slug: string | undefined
): ResortView | null {
	if (!slug) return null;
	return resorts.find((resort) => resort.slug === slug) ?? null;
}

export function selectComparison(
	resorts: readonly ResortView[],
	selection: readonly string[]
): ResortView[] {
	const bySlug = new Map(resorts.map((resort) => [resort.slug, resort]));
	return selection
		.map((slug) => bySlug.get(slug))
		.filter((resort): resort is ResortView => resort !== undefined);
}

export function toggleCompareSelection(
	current: readonly string[],
	slug: string,
	limit = COMPARE_LIMIT
): string[] {
	if (current.includes(slug)) return current.filter((entry) => entry !== slug);
	if (current.length >= limit) return [...current];
	return [...current, slug];
}
