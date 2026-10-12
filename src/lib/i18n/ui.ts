/**
 * UI localization glue: typed maps from domain values to catalog labels, plus URL helpers.
 *
 * Components never build locale-specific text themselves — they look a label up here and the
 * catalog supplies the wording for all four locales.
 */

import { m } from '#lib/paraglide/messages.js';
import { deLocalizeHref, getLocale, localizeHref } from '#lib/paraglide/runtime.js';
import type {
	Confidence,
	Country,
	FreshnessState,
	RatingCategory,
	ScoreBand,
	SnowQuality
} from '../domain/types.js';
import type { SortKey } from '../domain/selectors.js';
import { comparisonHref } from '../domain/selectors.js';
import { LOCALES, isLocale, type Locale } from './locales.js';

export { LOCALES, isLocale };
export type { Locale };

const locales = LOCALES;

export const localeLabels: Readonly<Record<Locale, () => string>> = {
	fi: m.lang_fi,
	en: m.lang_en,
	sv: m.lang_sv,
	no: m.lang_no
};

export const countryLabels: Readonly<Record<Country, () => string>> = {
	FI: m.country_fi,
	SE: m.country_se,
	NO: m.country_no
};

export const bandLabels: Readonly<Record<ScoreBand, () => string>> = {
	excellent: m.score_band_excellent,
	good: m.score_band_good,
	fair: m.score_band_fair,
	poor: m.score_band_poor
};

export const freshnessLabels: Readonly<Record<FreshnessState, () => string>> = {
	fresh: m.freshness_fresh,
	stale: m.freshness_stale,
	unknown: m.freshness_unknown,
	invalid: m.freshness_invalid
};

export const confidenceLabels: Readonly<Record<Confidence, () => string>> = {
	unknown: m.confidence_unknown,
	low: m.confidence_low,
	medium: m.confidence_medium,
	high: m.confidence_high
};

export const qualityLabels: Readonly<Record<SnowQuality, () => string>> = {
	powder: m.snow_quality_powder,
	packed: m.snow_quality_packed,
	wet: m.snow_quality_wet,
	icy: m.snow_quality_icy,
	spring: m.snow_quality_spring
};

export const sortLabels: Readonly<Record<SortKey, () => string>> = {
	best_conditions: m.sort_best_conditions,
	fresh_snow: m.sort_fresh_snow,
	snow_depth: m.sort_snow_depth,
	rating: m.sort_rating,
	name: m.sort_name
};

export const ratingCategoryLabels: Readonly<Record<RatingCategory, () => string>> = {
	atmosphere: m.rating_atmosphere,
	slopes: m.rating_slopes,
	lifts: m.rating_lifts,
	offpiste: m.rating_offpiste,
	accommodation: m.rating_accommodation,
	food: m.rating_food,
	apres: m.rating_apres
};

/** Score input labels are keyed by the config's `labelKey`, so the config owns the catalog key. */
export const metricLabels: Readonly<Record<string, () => string>> = {
	metric_snow_depth: m.metric_snow_depth,
	metric_new_snow_24h: m.metric_new_snow_24h,
	metric_new_snow_72h: m.metric_new_snow_72h,
	metric_forecast_snow_72h: m.metric_forecast_snow_72h,
	metric_open_piste_ratio: m.metric_open_piste_ratio,
	metric_open_lift_ratio: m.metric_open_lift_ratio,
	metric_temperature: m.metric_temperature,
	metric_wind: m.metric_wind,
	metric_snow_quality: m.metric_snow_quality,
	metric_precipitation: m.metric_precipitation
};

export function metricLabel(key: string): string {
	return metricLabels[key]?.() ?? key;
}

/** Comparison table row labels, keyed by the `labelKey` the comparison model emits. */
export const comparisonRowLabels: Readonly<Record<string, () => string>> = {
	compare_row_country: m.compare_row_country,
	compare_row_region: m.compare_row_region,
	compare_row_score: m.compare_row_score,
	compare_row_rating: m.compare_row_rating,
	compare_row_snow_depth: m.compare_row_snow_depth,
	compare_row_new_snow: m.compare_row_new_snow,
	compare_row_open_pistes: m.compare_row_open_pistes,
	compare_row_open_lifts: m.compare_row_open_lifts,
	compare_row_temperature: m.compare_row_temperature,
	compare_row_wind: m.compare_row_wind,
	compare_row_forecast_snow: m.compare_row_forecast_snow,
	compare_row_vertical: m.compare_row_vertical,
	compare_row_elevation: m.compare_row_elevation,
	compare_row_pistes: m.compare_row_pistes,
	compare_row_piste_km: m.compare_row_piste_km,
	compare_row_lifts: m.compare_row_lifts
};

export function comparisonRowLabel(key: string): string {
	return comparisonRowLabels[key]?.() ?? key;
}

export const bandColors: Readonly<Record<ScoreBand | 'none', string>> = {
	excellent: 'var(--band-excellent)',
	good: 'var(--band-good)',
	fair: 'var(--band-fair)',
	poor: 'var(--band-poor)',
	none: 'var(--band-none)'
};

export function bandColor(band: ScoreBand | null): string {
	return bandColors[band ?? 'none'];
}

/** The locale the current request resolved to (URL prefix, then header, then base locale). */
export function currentLocale(): Locale {
	const locale = getLocale();
	return isLocale(locale) ? locale : 'en';
}

/**
 * Canonical (unprefixed) path for a link, so components stay locale-agnostic. Safe to call with an
 * already-localized path: it is de-localized first.
 */
export function canonicalPath(href: string): string {
	return deLocalizeHref(href);
}

/** Localized href for the active locale, or for an explicit one (used by the switcher). */
export function href(path: string, locale?: Locale): string {
	const canonical = deLocalizeHref(path);
	return locale ? localizeHref(canonical, { locale }) : localizeHref(canonical);
}

/** Localized href for every locale, in display order — used for hreflang and the switcher. */
export function alternateHrefs(path: string): { locale: Locale; href: string }[] {
	const canonical = deLocalizeHref(path);
	return locales.map((locale) => ({
		locale,
		href: localizeHref(canonical, { locale })
	}));
}

/**
 * Locale-prefixed comparison link that adds or removes one resort from the current selection.
 * Keeping the localization here means no call site can leak an unprefixed `/compare` link.
 */
export function compareLink(selection: readonly string[], slug: string, locale?: Locale): string {
	return href(comparisonHref(selection, slug), locale);
}
