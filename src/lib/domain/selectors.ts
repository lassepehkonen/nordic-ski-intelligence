/**
 * Product read-model selectors: composing resort list items, filtering, sorting, search and the
 * comparison model. Pure functions over domain records — no framework and no database knowledge.
 */

import type {
	ConditionsScoreView,
	Country,
	MetricKey,
	Observation,
	Resort,
	ResortConditions,
	ResortRatingView,
	ResortTranslation,
	SnowQuality
} from './types.js';
import { isUsable } from './freshness.js';
import { computeConditionsScore } from './scoring/score.js';
import { computeResortRating } from './rating/rating.js';
import type { RatingInputs } from './rating/rating.js';
import type { Locale } from '../i18n/locales.js';

export interface ResortMetrics {
	snowDepthCm: number | null;
	newSnow24hCm: number | null;
	newSnow72hCm: number | null;
	forecastSnow72hCm: number | null;
	openPistes: number | null;
	totalPistes: number | null;
	openLifts: number | null;
	totalLifts: number | null;
	temperatureC: number | null;
	windMs: number | null;
	precipitationMm: number | null;
	snowQuality: SnowQuality | null;
}

export interface ResortListItem {
	resort: Resort;
	translation: ResortTranslation;
	conditions: ResortConditions;
	score: ConditionsScoreView;
	rating: ResortRatingView;
	metrics: ResortMetrics;
	openPisteRatio: number | null;
	openLiftRatio: number | null;
}

export type SortKey = 'best_conditions' | 'fresh_snow' | 'snow_depth' | 'rating' | 'name';

export const SORT_KEYS: readonly SortKey[] = [
	'best_conditions',
	'fresh_snow',
	'snow_depth',
	'rating',
	'name'
];

export interface ResortFilters {
	country: Country | 'all';
	minScore: number | null;
	minNewSnow: number | null;
	minOpenPisteRatio: number | null;
	query: string;
	sort: SortKey;
}

export const DEFAULT_FILTERS: ResortFilters = {
	country: 'all',
	minScore: null,
	minNewSnow: null,
	minOpenPisteRatio: null,
	query: '',
	sort: 'best_conditions'
};

export const SCORE_FILTER_OPTIONS: readonly number[] = [60, 75, 85];
export const SNOW_FILTER_OPTIONS: readonly number[] = [5, 15, 30];
export const OPEN_FILTER_OPTIONS: readonly number[] = [0.5, 0.75];

function latestObservation(
	observations: readonly Observation[],
	metric: MetricKey
): Observation | undefined {
	let latest: Observation | undefined;
	for (const observation of observations) {
		if (observation.metric !== metric || !isUsable(observation)) continue;
		if (!latest || new Date(observation.observedAt) > new Date(latest.observedAt)) latest = observation;
	}
	return latest;
}

function numberMetric(observations: readonly Observation[], metric: MetricKey): number | null {
	const observation = latestObservation(observations, metric);
	return observation && typeof observation.value === 'number' ? observation.value : null;
}

function qualityMetric(observations: readonly Observation[]): SnowQuality | null {
	const observation = latestObservation(observations, 'snow_quality');
	return observation && typeof observation.value === 'string' ? observation.value : null;
}

export function ratio(numerator: number | null, denominator: number | null): number | null {
	if (numerator === null || denominator === null || denominator <= 0) return null;
	return Math.min(1, Math.max(0, numerator / denominator));
}

export function resortMetrics(conditions: ResortConditions): ResortMetrics {
	const observations = [...conditions.observations, ...conditions.weather];
	const openPistes = numberMetric(observations, 'open_pistes');
	const totalPistes = numberMetric(observations, 'total_pistes');
	const openLifts = numberMetric(observations, 'open_lifts');
	const totalLifts = numberMetric(observations, 'total_lifts');
	return {
		snowDepthCm: numberMetric(observations, 'snow_depth_cm'),
		newSnow24hCm: numberMetric(observations, 'new_snow_24h_cm'),
		newSnow72hCm: numberMetric(observations, 'new_snow_72h_cm'),
		forecastSnow72hCm: numberMetric(observations, 'forecast_snow_72h_cm'),
		openPistes,
		totalPistes,
		openLifts,
		totalLifts,
		temperatureC: numberMetric(observations, 'temperature_c'),
		windMs: numberMetric(observations, 'wind_ms'),
		precipitationMm: numberMetric(observations, 'precipitation_mm'),
		snowQuality: qualityMetric(observations)
	};
}

export function buildResortListItem(
	resort: Resort,
	locale: Locale,
	conditions: ResortConditions,
	ratingValues: RatingInputs,
	now: Date
): ResortListItem {
	const observations = [...conditions.observations, ...conditions.weather];
	const metrics = resortMetrics(conditions);
	return {
		resort,
		translation: resort.translations[locale],
		conditions,
		score: computeConditionsScore({ resortId: resort.id, observations, now }),
		rating: computeResortRating({
			resortId: resort.id,
			values: ratingValues,
			dataState: conditions.dataState
		}),
		metrics,
		openPisteRatio: ratio(metrics.openPistes, metrics.totalPistes),
		openLiftRatio: ratio(metrics.openLifts, metrics.totalLifts)
	};
}

function normaliseQuery(value: string): string {
	return value
		.trim()
		.toLocaleLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

export function matchesQuery(item: ResortListItem, query: string): boolean {
	const needle = normaliseQuery(query);
	if (needle === '') return true;
	const haystack = [
		item.resort.id,
		item.translation.name,
		item.translation.region,
		item.translation.municipality,
		item.resort.country
	]
		.map(normaliseQuery)
		.join(' ');
	return haystack.includes(needle);
}

export function filterResorts(
	items: readonly ResortListItem[],
	filters: ResortFilters
): ResortListItem[] {
	return items.filter((item) => {
		if (filters.country !== 'all' && item.resort.country !== filters.country) return false;
		if (filters.minScore !== null && (item.score.score ?? -1) < filters.minScore) return false;
		if (filters.minNewSnow !== null && (item.metrics.newSnow24hCm ?? -1) < filters.minNewSnow)
			return false;
		if (
			filters.minOpenPisteRatio !== null &&
			(item.openPisteRatio ?? -1) < filters.minOpenPisteRatio
		)
			return false;
		return matchesQuery(item, filters.query);
	});
}

export function sortResorts(
	items: readonly ResortListItem[],
	sort: SortKey,
	collatorLocale: Locale = 'en'
): ResortListItem[] {
	const collator = new Intl.Collator(collatorLocale);
	const sorted = [...items];
	switch (sort) {
		case 'fresh_snow':
			sorted.sort((a, b) => (b.metrics.newSnow24hCm ?? -1) - (a.metrics.newSnow24hCm ?? -1));
			break;
		case 'snow_depth':
			sorted.sort((a, b) => (b.metrics.snowDepthCm ?? -1) - (a.metrics.snowDepthCm ?? -1));
			break;
		case 'rating':
			sorted.sort((a, b) => (b.rating.overall ?? -1) - (a.rating.overall ?? -1));
			break;
		case 'name':
			sorted.sort((a, b) => collator.compare(a.translation.name, b.translation.name));
			break;
		case 'best_conditions':
		default:
			sorted.sort((a, b) => (b.score.score ?? -1) - (a.score.score ?? -1));
			break;
	}
	return sorted;
}

export function bestByConditions(
	items: readonly ResortListItem[],
	limit = 3
): ResortListItem[] {
	return [...items]
		.filter((item) => item.score.score !== null)
		.sort((a, b) => (b.score.score ?? 0) - (a.score.score ?? 0))
		.slice(0, limit);
}

export function freshestSnow(items: readonly ResortListItem[], limit = 3): ResortListItem[] {
	return [...items]
		.filter((item) => (item.metrics.newSnow24hCm ?? 0) > 0)
		.sort((a, b) => (b.metrics.newSnow24hCm ?? 0) - (a.metrics.newSnow24hCm ?? 0))
		.slice(0, limit);
}

const SORT_SET = new Set<string>(SORT_KEYS);

export function parseFilters(searchParams: URLSearchParams): ResortFilters {
	const country = searchParams.get('country');
	const score = Number(searchParams.get('score'));
	const snow = Number(searchParams.get('snow'));
	const open = Number(searchParams.get('open'));
	const sort = searchParams.get('sort');
	return {
		country: country === 'FI' || country === 'SE' || country === 'NO' ? country : 'all',
		minScore: Number.isFinite(score) && score > 0 ? score : null,
		minNewSnow: Number.isFinite(snow) && snow > 0 ? snow : null,
		minOpenPisteRatio: Number.isFinite(open) && open > 0 && open <= 1 ? open : null,
		query: searchParams.get('q')?.slice(0, 80) ?? '',
		sort: sort && SORT_SET.has(sort) ? (sort as SortKey) : DEFAULT_FILTERS.sort
	};
}

export function filtersToSearchParams(filters: ResortFilters): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.country !== 'all') params.set('country', filters.country);
	if (filters.minScore !== null) params.set('score', String(filters.minScore));
	if (filters.minNewSnow !== null) params.set('snow', String(filters.minNewSnow));
	if (filters.minOpenPisteRatio !== null) params.set('open', String(filters.minOpenPisteRatio));
	if (filters.query.trim() !== '') params.set('q', filters.query.trim());
	if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
	return params;
}

export function isFiltered(filters: ResortFilters): boolean {
	return (
		filters.country !== 'all' ||
		filters.minScore !== null ||
		filters.minNewSnow !== null ||
		filters.minOpenPisteRatio !== null ||
		filters.query.trim() !== ''
	);
}

export const MAX_COMPARISON_RESORTS = 3;

export function parseComparisonSelection(searchParams: URLSearchParams): string[] {
	const raw = searchParams.get('resorts');
	if (!raw) return [];
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const part of raw.split(',')) {
		const id = part.trim().toLowerCase();
		if (id === '' || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
		if (ids.length >= MAX_COMPARISON_RESORTS) break;
	}
	return ids;
}

export function comparisonHref(selected: readonly string[], slug: string): string {
	const ids = [...selected];
	if (!ids.includes(slug) && ids.length < MAX_COMPARISON_RESORTS) ids.push(slug);
	return `/compare?${new URLSearchParams({ resorts: ids.join(',') }).toString()}`;
}

export type ComparisonRow =
	| {
			id: string;
			labelKey: string;
			kind: 'number';
			unit: 'cm' | 'm' | 'km' | 'c' | 'ms' | 'score' | 'ratio' | 'none';
			values: (number | null)[];
			higherIsBetter: boolean;
			bestIndex: number | null;
	  }
	| {
			id: string;
			labelKey: string;
			kind: 'text';
			values: string[];
	  };

export interface ComparisonSection {
	id: string;
	titleKey: string;
	rows: ComparisonRow[];
}

function numberRow(
	id: string,
	labelKey: string,
	unit: Extract<ComparisonRow, { kind: 'number' }>['unit'],
	values: (number | null)[],
	higherIsBetter = true
): ComparisonRow {
	const present = values
		.map((value, index) => ({ value, index }))
		.filter((entry): entry is { value: number; index: number } => entry.value !== null);
	let bestIndex: number | null = null;
	if (present.length > 1) {
		const best = present.reduce((acc, entry) =>
			higherIsBetter ? (entry.value > acc.value ? entry : acc) : entry.value < acc.value ? entry : acc
		);
		const allEqual = present.every((entry) => entry.value === present[0].value);
		bestIndex = allEqual ? null : best.index;
	}
	return { id, labelKey, kind: 'number', unit, values, higherIsBetter, bestIndex };
}

/** Comparison model for 2–3 resorts: conditions, rating, weather and terrain. */
export function buildComparisonSections(items: readonly ResortListItem[]): ComparisonSection[] {
	const conditionRows: ComparisonRow[] = [
		numberRow('score', 'compare_row_score', 'score', items.map((item) => item.score.score)),
		numberRow(
			'snow_depth',
			'compare_row_snow_depth',
			'cm',
			items.map((item) => item.metrics.snowDepthCm)
		),
		numberRow(
			'new_snow',
			'compare_row_new_snow',
			'cm',
			items.map((item) => item.metrics.newSnow24hCm)
		),
		numberRow(
			'open_pistes',
			'compare_row_open_pistes',
			'ratio',
			items.map((item) => item.openPisteRatio)
		),
		numberRow(
			'open_lifts',
			'compare_row_open_lifts',
			'ratio',
			items.map((item) => item.openLiftRatio)
		)
	];

	const ratingRows: ComparisonRow[] = [
		numberRow('rating', 'compare_row_rating', 'score', items.map((item) => item.rating.overall))
	];

	const weatherRows: ComparisonRow[] = [
		numberRow(
			'temperature',
			'compare_row_temperature',
			'c',
			items.map((item) => item.metrics.temperatureC)
		),
		numberRow(
			'wind',
			'compare_row_wind',
			'ms',
			items.map((item) => item.metrics.windMs),
			false
		),
		numberRow(
			'forecast_snow',
			'compare_row_forecast_snow',
			'cm',
			items.map((item) => item.metrics.forecastSnow72hCm)
		)
	];

	const terrainRows: ComparisonRow[] = [
		{
			id: 'elevation',
			labelKey: 'compare_row_elevation',
			kind: 'text',
			values: items.map((item) =>
				item.resort.elevations.baseM !== null && item.resort.elevations.topM !== null
					? `${item.resort.elevations.baseM}–${item.resort.elevations.topM}`
					: ''
			)
		},
		numberRow(
			'vertical',
			'compare_row_vertical',
			'm',
			items.map((item) => item.resort.elevations.verticalM)
		),
		numberRow(
			'pistes',
			'compare_row_pistes',
			'none',
			items.map((item) => item.resort.terrain.pistes)
		),
		numberRow(
			'piste_km',
			'compare_row_piste_km',
			'km',
			items.map((item) => item.resort.terrain.pisteKm)
		),
		numberRow(
			'lifts',
			'compare_row_lifts',
			'none',
			items.map((item) => item.resort.terrain.lifts)
		)
	];

	return [
		{ id: 'conditions', titleKey: 'compare_section_conditions', rows: conditionRows },
		{ id: 'rating', titleKey: 'compare_section_rating', rows: ratingRows },
		{ id: 'weather', titleKey: 'compare_section_weather', rows: weatherRows },
		{ id: 'terrain', titleKey: 'compare_section_terrain', rows: terrainRows }
	];
}
