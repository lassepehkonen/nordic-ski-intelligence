/**
 * Locale registry (ADR-0007).
 *
 * The launch locales are fixed here and mirrored in `project.inlang/settings.json`; a fifth
 * language is added by extending both lists and adding `messages/<locale>.json`. Nothing else in
 * the product hard-codes a language.
 */

export const LOCALES = ['fi', 'en', 'sv', 'no'] as const;

export type Locale = (typeof LOCALES)[number];

/** UI fallback language when a message is missing during authoring (never a content exemption). */
export const FALLBACK_LOCALE: Locale = 'en';

/** `og:locale` uses IANA language-territory tags; hreflang keeps the plain language subtag. */
export const OPEN_GRAPH_LOCALES: Readonly<Record<Locale, string>> = {
	fi: 'fi_FI',
	en: 'en_GB',
	sv: 'sv_SE',
	no: 'nb_NO'
};

export function isLocale(value: string | null | undefined): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Product display time zone for "last updated" and forecast times. The first market is Finland and
 * all launch resorts sit in the same Nordic band; a per-resort time zone is a later refinement.
 */
export const PRODUCT_TIME_ZONE = 'Europe/Helsinki';
