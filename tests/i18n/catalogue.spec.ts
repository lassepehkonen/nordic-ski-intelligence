import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Catalogue guards for the multilingual product (Phase 7).
 *
 * The four locales are one product, so they must stay interchangeable: identical key sets,
 * identical placeholder sets, no empty strings, and no message the code calls that the catalogue
 * does not define. Unit symbols are not translated - they are the same string in every locale.
 */
const MESSAGES_DIR = join(process.cwd(), 'messages');
const SRC_DIR = join(process.cwd(), 'src');
const LOCALES = ['en', 'fi', 'sv', 'no'] as const;
const BASE_LOCALE = 'en';
const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

type Catalogue = Record<string, string>;

function loadCatalogue(locale: string): Catalogue {
	const raw = readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8');
	const parsed = JSON.parse(raw) as Record<string, unknown>;
	const catalogue: Catalogue = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (key === '$schema') continue;
		if (typeof value !== 'string') {
			throw new Error(`${locale}.json: ${key} is not a string`);
		}
		catalogue[key] = value;
	}
	return catalogue;
}

function placeholders(value: string): string[] {
	return [...value.matchAll(PLACEHOLDER)].map((match) => match[1]!).sort();
}

function sourceFiles(dir: string): string[] {
	const entries: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (entry === 'paraglide') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			entries.push(...sourceFiles(full));
		} else if (/\.(svelte|ts)$/.test(entry) && !entry.endsWith('.spec.ts')) {
			entries.push(full);
		}
	}
	return entries;
}

const catalogues = Object.fromEntries(
	LOCALES.map((locale) => [locale, loadCatalogue(locale)])
) as Record<(typeof LOCALES)[number], Catalogue>;
const baseKeys = Object.keys(catalogues[BASE_LOCALE]).sort();

describe('message catalogue parity', () => {
	it('defines a plausible catalogue', () => {
		expect(baseKeys.length).toBeGreaterThan(150);
	});

	it('has the same keys in every locale', () => {
		for (const locale of LOCALES) {
			expect(Object.keys(catalogues[locale]).sort(), `${locale} key set`).toEqual(baseKeys);
		}
	});

	it('uses the same placeholders for every key in every locale', () => {
		for (const key of baseKeys) {
			const expected = placeholders(catalogues[BASE_LOCALE][key]!);
			for (const locale of LOCALES) {
				expect(placeholders(catalogues[locale][key]!), `${locale}.${key}`).toEqual(expected);
			}
		}
	});

	it('has no empty or whitespace-only values', () => {
		for (const locale of LOCALES) {
			for (const key of baseKeys) {
				expect(catalogues[locale][key]!.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
			}
		}
	});

	it('keeps unit symbols untranslated', () => {
		const unitKeys = baseKeys.filter((key) => key.startsWith('unit'));
		expect(unitKeys.length).toBeGreaterThan(5);
		for (const key of unitKeys) {
			for (const locale of LOCALES) {
				expect(catalogues[locale][key], `${locale}.${key}`).toBe(catalogues[BASE_LOCALE][key]);
			}
		}
	});
});

describe('message catalogue usage', () => {
	it('defines every message the source calls', () => {
		const used = new Set<string>();
		for (const file of sourceFiles(SRC_DIR)) {
			const source = readFileSync(file, 'utf8');
			for (const match of source.matchAll(/\bm\.([a-zA-Z][a-zA-Z0-9_]*)\(/g)) {
				used.add(match[1]!);
			}
		}

		expect(used.size).toBeGreaterThan(50);
		const missing = [...used].filter((key) => !baseKeys.includes(key)).sort();
		expect(missing, 'message keys used in src but absent from the catalogue').toEqual([]);
	});
});
