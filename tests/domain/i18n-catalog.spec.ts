import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../src/lib/i18n/locales.js';

function readMessages(locale: string): Record<string, string> {
	const url = new URL(`../../messages/${locale}.json`, import.meta.url);
	return JSON.parse(readFileSync(url, 'utf8')) as Record<string, string>;
}

function placeholders(value: string): string[] {
	return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

const catalogs = Object.fromEntries(
	LOCALES.map((locale) => [locale, readMessages(locale)])
) as Record<(typeof LOCALES)[number], Record<string, string>>;

describe('message catalogs', () => {
	it('ships a catalog for every launch locale', () => {
		for (const locale of LOCALES) {
			expect(Object.keys(catalogs[locale]).length).toBeGreaterThan(100);
		}
	});

	it('keeps all locales on exactly the same key set (no untranslated gaps)', () => {
		const reference = Object.keys(catalogs.en)
			.filter((key) => !key.startsWith('$'))
			.sort();
		for (const locale of LOCALES) {
			const keys = Object.keys(catalogs[locale])
				.filter((key) => !key.startsWith('$'))
				.sort();
			expect(keys, `keys missing in ${locale}`).toEqual(reference);
		}
	});

	it('has no empty translation in any locale', () => {
		for (const locale of LOCALES) {
			for (const [key, value] of Object.entries(catalogs[locale])) {
				if (key.startsWith('$')) continue;
				expect(value.trim(), `${locale}:${key}`).not.toBe('');
			}
		}
	});

	it('uses the same placeholder set in every locale, so no value goes missing at render time', () => {
		for (const key of Object.keys(catalogs.en)) {
			if (key.startsWith('$')) continue;
			const expected = placeholders(catalogs.en[key]);
			for (const locale of LOCALES) {
				expect(placeholders(catalogs[locale][key]), `${locale}:${key}`).toEqual(expected);
			}
		}
	});

	it('does not fall back to English copy in translated catalogs', () => {
		// A cheap guard against a locale file that was never actually translated: locale labels are
		// intentionally identical, so only a few keys need to differ from the English wording.
		const keysToDiffer = ['home_title', 'filter_sort_label', 'resort_conditions_title'];
		for (const locale of LOCALES.filter((code) => code !== 'en')) {
			for (const key of keysToDiffer) {
				expect(catalogs[locale][key], `${locale}:${key}`).not.toBe(catalogs.en[key]);
			}
		}
	});

	it('declares the same locales in the inlang project settings as in the locale registry', () => {
		const settingsUrl = new URL('../../project.inlang/settings.json', import.meta.url);
		const settings = JSON.parse(readFileSync(settingsUrl, 'utf8')) as {
			baseLocale: string;
			locales: string[];
		};

		expect([...settings.locales].sort()).toEqual([...LOCALES].sort());
		expect(settings.baseLocale).toBe('en');
		expect(settings.locales).toContain(settings.baseLocale);
	});
});
