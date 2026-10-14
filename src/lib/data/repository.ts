/**
 * Preview data repository: the single place the UI reads data from.
 *
 * Contracts mirror `docs/architecture/api.md` (resort, condition, weather, score and rating reads)
 * so the page loads do not change when the sample adapter is replaced by a real database-backed
 * repository: pages call this module, never `RESORTS` or `buildSampleConditions` directly.
 */

import type {
	ConditionsScoreView,
	Country,
	Resort,
	ResortConditions,
	ResortRatingView,
	SourceRef
} from '../domain/types.js';
import type { ResortListItem } from '../domain/selectors.js';
import { buildResortListItem, resortMetrics } from '../domain/selectors.js';
import { computeConditionsScore } from '../domain/scoring/score.js';
import { computeResortRating } from '../domain/rating/rating.js';
import type { Locale } from '../i18n/locales.js';
import { RESORTS, findResort } from './resorts.js';
import { buildSampleConditions } from './conditions.js';
import { ratingValuesFor } from './ratings.js';
import { SAMPLE_CONDITIONS_SOURCE } from './sources.js';

export type RepositoryResult<T> =
	{ ok: true; value: T } | { ok: false; reason: 'not_found' | 'unavailable' };

function notFound<T>(): RepositoryResult<T> {
	return { ok: false, reason: 'not_found' };
}

function unavailable<T>(): RepositoryResult<T> {
	return { ok: false, reason: 'unavailable' };
}

export interface PreviewRepositories {
	resorts: {
		list: () => readonly Resort[];
		listByCountry: (country: Country) => readonly Resort[];
		getBySlug: (slug: string) => RepositoryResult<Resort>;
	};
	conditions: {
		getLatestForResort: (resortId: string, now: Date) => RepositoryResult<ResortConditions>;
	};
	scores: {
		getCurrent: (resortId: string, now: Date) => RepositoryResult<ConditionsScoreView>;
	};
	ratings: {
		getPublished: (resortId: string) => RepositoryResult<ResortRatingView>;
	};
	listItems: (locale: Locale, now: Date) => ResortListItem[];
	listItem: (slug: string, locale: Locale, now: Date) => RepositoryResult<ResortListItem>;
	sourcesFor: (resort: Resort, conditions: ResortConditions | null) => SourceRef[];
}

export function createPreviewRepositories(
	resorts: readonly Resort[] = RESORTS
): PreviewRepositories {
	function getConditions(resortId: string, now: Date): RepositoryResult<ResortConditions> {
		if (!findResort(resortId)) return notFound();
		const conditions = buildSampleConditions(resortId, now);
		return conditions ? { ok: true, value: conditions } : unavailable();
	}

	function listItems(locale: Locale, now: Date): ResortListItem[] {
		return resorts.flatMap((resort) => {
			const conditions = buildSampleConditions(resort.id, now);
			if (!conditions) return [];
			return [buildResortListItem(resort, locale, conditions, ratingValuesFor(resort.id), now)];
		});
	}

	return {
		resorts: {
			list: () => resorts,
			listByCountry: (country: Country) => resorts.filter((resort) => resort.country === country),
			getBySlug: (slug: string) => {
				const resort = resorts.find((candidate) => candidate.id === slug);
				return resort ? { ok: true, value: resort } : notFound();
			}
		},
		conditions: { getLatestForResort: getConditions },
		scores: {
			getCurrent: (resortId: string, now: Date) => {
				const conditions = getConditions(resortId, now);
				if (!conditions.ok) return conditions;
				return {
					ok: true,
					value: computeConditionsScore({
						resortId,
						observations: [...conditions.value.observations, ...conditions.value.weather],
						now
					})
				};
			}
		},
		ratings: {
			getPublished: (resortId: string) => {
				const resort = findResort(resortId);
				if (!resort) return notFound();
				return {
					ok: true,
					value: computeResortRating({
						resortId,
						values: ratingValuesFor(resortId),
						dataState: 'illustrative'
					})
				};
			}
		},
		listItems,
		listItem: (slug: string, locale: Locale, now: Date) => {
			const resort = resorts.find((candidate) => candidate.id === slug);
			if (!resort) return notFound();
			const conditions = buildSampleConditions(slug, now);
			if (!conditions) return unavailable();
			return {
				ok: true,
				value: buildResortListItem(resort, locale, conditions, ratingValuesFor(slug), now)
			};
		},
		sourcesFor: (resort: Resort, conditions: ResortConditions | null) => {
			const sources: SourceRef[] = [...resort.sources];
			if (conditions?.dataState === 'illustrative') sources.push(SAMPLE_CONDITIONS_SOURCE);
			const seen = new Set<string>();
			return sources.filter((source) => {
				if (seen.has(source.id)) return false;
				seen.add(source.id);
				return true;
			});
		}
	};
}

/** Shared metric extraction for pages that already hold a `ResortListItem`. */
export { resortMetrics };
