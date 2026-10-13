/**
 * Locale-aware formatting and label helpers (Phase 7).
 *
 * Every user-facing string originates here: pages pass numbers, ISO timestamps and stable
 * enum/domain keys in, and get localized text out. Nothing in the UI layer hard-codes a
 * language-specific string or a date format.
 */
import { m } from '#lib/paraglide/messages.js';
import { locales } from '#lib/paraglide/runtime.js';

export type LocaleCode = (typeof locales)[number];

/** Intl tags: the product's English is British, Norwegian is Bokmål. */
const LOCALE_TAGS: Record<string, string> = {
	en: 'en-GB',
	fi: 'fi-FI',
	sv: 'sv-SE',
	no: 'nb-NO'
};

/** Weather and status timestamps are shown in the resort's own time zone, not the visitor's. */
const TIME_ZONES: Record<string, string> = {
	FI: 'Europe/Helsinki',
	SE: 'Europe/Stockholm',
	NO: 'Europe/Oslo'
};

export const MISSING_VALUE = '—';

export function isLocale(value: string): value is LocaleCode {
	return (locales as readonly string[]).includes(value);
}

export function intlLocale(locale: string): string {
	return LOCALE_TAGS[locale] ?? 'en-GB';
}

export function timeZoneFor(countryCode: string): string {
	return TIME_ZONES[countryCode] ?? 'UTC';
}

/** Site-level timestamps (footer, notices) follow the visitor's language region. */
const LOCALE_TIME_ZONES: Record<string, string> = {
	en: 'Europe/Stockholm',
	fi: 'Europe/Helsinki',
	sv: 'Europe/Stockholm',
	no: 'Europe/Oslo'
};

export function localeTimeZone(locale: string): string {
	return LOCALE_TIME_ZONES[locale] ?? 'UTC';
}

export function formatLocaleDateTime(value: string | null, locale: string): string {
	if (!value) return m.notAvailable();
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return m.notAvailable();
	return new Intl.DateTimeFormat(intlLocale(locale), {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: localeTimeZone(locale)
	}).format(date);
}

export function formatNumber(value: number, locale: string): string {
	return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatDecimal(value: number, locale: string, digits = 1): string {
	return new Intl.NumberFormat(intlLocale(locale), {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(value);
}

export function formatCount(value: number | null, locale: string): string {
	return value === null ? MISSING_VALUE : formatNumber(value, locale);
}

export function formatDateTime(value: string | null, locale: string, countryCode: string): string {
	if (!value) return m.notAvailable();
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return m.notAvailable();
	return new Intl.DateTimeFormat(intlLocale(locale), {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: timeZoneFor(countryCode)
	}).format(date);
}

export function formatDate(value: string | null, locale: string, countryCode: string): string {
	if (!value) return m.notAvailable();
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return m.notAvailable();
	return new Intl.DateTimeFormat(intlLocale(locale), {
		dateStyle: 'medium',
		timeZone: timeZoneFor(countryCode)
	}).format(date);
}

/** Hour of day, used for the hourly forecast rows. */
export function formatHour(value: string | null, locale: string, countryCode: string): string {
	if (!value) return m.notAvailable();
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return m.notAvailable();
	return new Intl.DateTimeFormat(intlLocale(locale), {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: timeZoneFor(countryCode)
	}).format(date);
}

export function formatWeekday(value: string | null, locale: string, countryCode: string): string {
	if (!value) return m.notAvailable();
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return m.notAvailable();
	return new Intl.DateTimeFormat(intlLocale(locale), {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: timeZoneFor(countryCode)
	}).format(date);
}

export function formatCm(value: number | null, locale: string): string {
	return value === null
		? MISSING_VALUE
		: `${formatNumber(Math.round(value), locale)} ${m.unitCm()}`;
}

export function formatSnowfall(value: number | null, locale: string): string {
	return value === null
		? MISSING_VALUE
		: `${formatDecimal(value, locale, 1)} ${m.unitMillimetre()}`;
}

export function formatPrecipitation(value: number | null, locale: string): string {
	return value === null
		? MISSING_VALUE
		: `${formatDecimal(value, locale, 1)} ${m.unitMillimetre()}`;
}

export function formatTemperature(value: number | null, locale: string): string {
	return value === null ? MISSING_VALUE : `${formatDecimal(value, locale, 1)} ${m.unitCelsius()}`;
}

export function formatWind(value: number | null, locale: string): string {
	return value === null
		? MISSING_VALUE
		: `${formatDecimal(value, locale, 0)} ${m.unitMetresPerSecond()}`;
}

export function formatPercent(value: number | null, locale: string, digits = 0): string {
	return value === null
		? MISSING_VALUE
		: `${formatDecimal(value * 100, locale, digits)} ${m.unitPercent()}`;
}

export function formatMetres(value: number | null, locale: string): string {
	return value === null
		? MISSING_VALUE
		: `${formatNumber(Math.round(value), locale)} ${m.unitMetre()}`;
}

export function countryName(countryCode: string, locale: string): string {
	try {
		return (
			new Intl.DisplayNames([intlLocale(locale)], { type: 'region' }).of(countryCode) ?? countryCode
		);
	} catch {
		return countryCode;
	}
}

export type Tone = 'neutral' | 'good' | 'warn' | 'stop' | 'accent';

export function sizeLabel(size: string): string {
	if (size === 'small') return m.sizeSmall();
	if (size === 'medium') return m.sizeMedium();
	if (size === 'large') return m.sizeLarge();
	return size;
}

export function freshnessLabel(freshness: string): string {
	switch (freshness) {
		case 'fresh':
			return m.freshnessFresh();
		case 'partial':
			return m.freshnessPartial();
		case 'stale':
			return m.freshnessStale();
		case 'scheduled':
			return m.freshnessScheduled();
		default:
			return m.freshnessUnavailable();
	}
}

export function freshnessTone(freshness: string): Tone {
	switch (freshness) {
		case 'fresh':
			return 'good';
		case 'partial':
			return 'accent';
		case 'stale':
			return 'warn';
		default:
			return 'neutral';
	}
}

/** Component ids come from the scoring domain (ADR-0009 / docs/scoring.md). */
export function componentLabel(id: string): string {
	switch (id) {
		case 'snow_depth':
			return m.componentSnowDepth();
		case 'recent_snow':
			return m.componentRecentSnow();
		case 'forecast_snow':
			return m.componentForecastSnow();
		case 'terrain_open_ratio':
			return m.componentTerrainOpenRatio();
		case 'lifts_open_ratio':
			return m.componentLiftsOpenRatio();
		case 'temperature':
			return m.componentTemperature();
		case 'wind':
			return m.componentWind();
		case 'snow_quality':
			return m.componentSnowQuality();
		default:
			return id;
	}
}

export function componentStatusLabel(status: string): string {
	switch (status) {
		case 'ok':
			return m.componentStatusOk();
		case 'stale':
			return m.componentStatusStale();
		case 'out_of_range':
			return m.componentStatusOutOfRange();
		default:
			return m.componentStatusMissing();
	}
}

export function componentStatusTone(status: string): Tone {
	switch (status) {
		case 'ok':
			return 'good';
		case 'stale':
			return 'warn';
		case 'out_of_range':
			return 'stop';
		default:
			return 'neutral';
	}
}

/**
 * Scoring reasons are stable `scoring_*` keys produced by the domain, never prose. An unknown
 * key falls back to the shared "not available" string rather than leaking a raw identifier.
 */
export function reasonLabel(key: string): string {
	switch (key) {
		case 'scoring_missing_input':
		case 'scoring_missing_component_excluded':
		case 'scoring_missing_category_excluded':
			return m.reasonMissingInput();
		case 'scoring_input_unusable_value':
			return m.reasonUnusableValue();
		case 'scoring_ratio_total_unknown':
			return m.reasonRatioTotalUnknown();
		case 'scoring_ratio_open_unknown':
			return m.reasonRatioOpenUnknown();
		case 'scoring_ratio_total_zero':
			return m.reasonRatioTotalZero();
		case 'scoring_input_stale':
		case 'scoring_stale_component_excluded':
			return m.reasonStaleExcluded();
		case 'scoring_input_out_of_range':
		case 'scoring_out_of_range_block':
			return m.reasonOutOfRange();
		case 'scoring_coverage_below_threshold':
			return m.reasonCoverageBelowThreshold();
		case 'scoring_freshness_unknown':
			return m.reasonFreshnessUnknown();
		case 'scoring_category_unknown':
		case 'scoring_unknown_category_ignored':
			return m.reasonCategoryUnknown();
		default:
			// Unknown keys never leak as raw identifiers into the UI.
			return m.notAvailable();
	}
}

export function ratingCategoryLabel(id: string): string {
	switch (id) {
		case 'atmosphere_environment':
			return m.ratingAtmosphereEnvironment();
		case 'slopes':
			return m.ratingSlopes();
		case 'lifts':
			return m.ratingLifts();
		case 'off_piste':
			return m.ratingOffPiste();
		case 'accommodation':
			return m.ratingAccommodation();
		case 'food':
			return m.ratingFood();
		case 'apres_ski':
			return m.ratingApresSki();
		default:
			return id;
	}
}

export function snowQualityLabel(quality: string): string {
	switch (quality) {
		case 'powder':
			return m.snowQualityPowder();
		case 'packed_powder':
			return m.snowQualityPackedPowder();
		case 'piste':
			return m.snowQualityPiste();
		case 'icy':
			return m.snowQualityIcy();
		case 'slush':
			return m.snowQualitySlush();
		case 'spring':
			return m.snowQualitySpring();
		default:
			return quality;
	}
}

/** Shared class name for a tone, so every component colours status the same way. */
export function toneClass(tone: Tone): string {
	switch (tone) {
		case 'good':
			return 'chip chip-fresh';
		case 'warn':
			return 'chip chip-warn';
		case 'stop':
			return 'chip chip-stop';
		case 'accent':
			return 'chip chip-accent';
		default:
			return 'chip';
	}
}

/** Conditions Score bands, used for the dial colour and the list accents. */
export function scoreTone(score: number | null, published: boolean): Tone {
	if (!published || score === null) return 'neutral';
	if (score >= 70) return 'good';
	if (score >= 45) return 'accent';
	if (score >= 25) return 'warn';
	return 'stop';
}
