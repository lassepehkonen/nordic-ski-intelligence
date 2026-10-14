/**
 * Metric presentation: turns a score input, a metric value or a quality code into a localized
 * string. Kept out of components so the resort page, the score breakdown and the comparison table
 * all render a value the same way.
 */

import type { ScoreInputView, SnowQuality } from '../domain/types.js';
import { formatDecimal, formatNumber, formatPercent } from './format.js';
import type { Locale } from './locales.js';
import { qualityLabels } from './ui.js';

/** Metric keys whose value is a 0–1 proportion. */
const RATIO_METRICS = new Set<string>([
	'open_piste_ratio',
	'open_lift_ratio',
	'open_pistes',
	'open_lifts'
]);

export function qualityLabel(quality: SnowQuality): string {
	return qualityLabels[quality]();
}

export function formatSnowCm(value: number, locale: Locale): string {
	return `${formatDecimal(value, locale, 1)} cm`;
}

export function formatTemperature(value: number, locale: Locale): string {
	return `${formatDecimal(value, locale, 1)} °C`;
}

export function formatWind(value: number, locale: Locale): string {
	return `${formatDecimal(value, locale, 1)} m/s`;
}

export function formatRatio(value: number, locale: Locale): string {
	return formatPercent(value, locale);
}

export function formatCount(value: number, locale: Locale): string {
	return formatNumber(value, locale, { maximumFractionDigits: 0 });
}

export function formatElevation(value: number, locale: Locale): string {
	return `${formatCount(value, locale)} m`;
}

/** Localized label for a raw score input value (used by the score breakdown). */
export function formatScoreInput(input: ScoreInputView, locale: Locale): string {
	if (input.raw === null) return '';
	if (typeof input.raw === 'string') return qualityLabel(input.raw);
	if (RATIO_METRICS.has(input.metric) && input.raw <= 1) return formatRatio(input.raw, locale);
	if (input.unit === 'cm') return formatSnowCm(input.raw, locale);
	if (input.unit === '°C') return formatTemperature(input.raw, locale);
	if (input.unit === 'm/s') return formatWind(input.raw, locale);
	return formatCount(input.raw, locale);
}
