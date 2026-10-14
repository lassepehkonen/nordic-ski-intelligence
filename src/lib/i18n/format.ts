/**
 * Locale-aware formatting helpers. Every number, date and unit in the UI goes through these so
 * components never build locale-specific strings by hand.
 */

import { PRODUCT_TIME_ZONE, type Locale } from './locales.js';

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();

function cached(
	cache: Map<string, Intl.DateTimeFormat>,
	key: string,
	build: () => Intl.DateTimeFormat
): Intl.DateTimeFormat {
	const existing = cache.get(key);
	if (existing) return existing;
	const formatter = build();
	cache.set(key, formatter);
	return formatter;
}

export function toDate(value: string | number | Date): Date {
	return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(value: string | number | Date, locale: Locale): string {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return '—';
	return cached(
		dateTimeFormatters,
		locale,
		() =>
			new Intl.DateTimeFormat(locale, {
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: PRODUCT_TIME_ZONE
			})
	).format(date);
}

export function formatDate(value: string | number | Date, locale: Locale): string {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return '—';
	return cached(
		dateFormatters,
		locale,
		() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: PRODUCT_TIME_ZONE })
	).format(date);
}

export function formatWeekday(value: string | number | Date, locale: Locale): string {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return '—';
	return cached(
		weekdayFormatters,
		locale,
		() =>
			new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				day: 'numeric',
				month: 'numeric',
				timeZone: PRODUCT_TIME_ZONE
			})
	).format(date);
}

export function formatNumber(
	value: number,
	locale: Locale,
	options?: Intl.NumberFormatOptions
): string {
	return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDecimal(value: number, locale: Locale, fractionDigits = 1): string {
	return formatNumber(value, locale, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	});
}

export function formatWholeNumber(value: number, locale: Locale): string {
	return formatNumber(value, locale, { maximumFractionDigits: 0 });
}

export function formatPercent(ratio: number, locale: Locale): string {
	return formatNumber(ratio, locale, { style: 'percent', maximumFractionDigits: 0 });
}

export function daysBetween(a: Date, b: Date): number {
	return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
