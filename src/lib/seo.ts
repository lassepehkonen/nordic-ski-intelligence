/**
 * SEO surface (Phase 7): one place that builds localized metadata, canonical URLs, hreflang
 * alternates and JSON-LD for every page, so no route hand-rolls its own head tags.
 *
 * Locale routing follows ADR-0007: canonical URLs always carry the locale prefix, every locale
 * links to every other locale (including itself, which is what Google expects) plus x-default
 * pointing at the base locale.
 */
import { localizeHref, locales, baseLocale, type Locale } from '#lib/paraglide/runtime.js';

export interface SeoInput {
	/** Page path without a locale prefix, e.g. '/' or '/resort/levi'. */
	path: string;
	title: string;
	description: string;
	locale: string;
	origin: string;
	/** Optional extra query string (already validated) to preserve on canonical links. */
	search?: string;
	type?: 'website' | 'article';
	jsonLd?: Record<string, unknown> | Record<string, unknown>[];
	robots?: string;
}

export interface AlternateLink {
	locale: string;
	href: string;
	hrefLang: string;
}

export interface Seo {
	canonical: string;
	alternates: AlternateLink[];
	defaultHref: string;
	title: string;
	description: string;
	type: string;
	robots: string;
	jsonLd: string | null;
	/** Ready-to-inject `<script type="application/ld+json">` block, or null. */
	jsonLdTag: string | null;
}

function absolute(origin: string, href: string): string {
	return new URL(href, origin).toString();
}

export function buildSeo(input: SeoInput): Seo {
	const search = input.search ?? '';
	const canonical = absolute(
		input.origin,
		`${localizeHref(input.path, { locale: input.locale as Locale })}${search}`
	);

	const alternates: AlternateLink[] = locales.map((locale) => ({
		locale,
		hrefLang: locale,
		href: absolute(input.origin, `${localizeHref(input.path, { locale })}${search}`)
	}));

	alternates.push({
		locale: 'x-default',
		hrefLang: 'x-default',
		href: absolute(input.origin, `${localizeHref(input.path, { locale: baseLocale })}${search}`)
	});

	return {
		canonical,
		alternates,
		defaultHref: absolute(input.origin, localizeHref(input.path, { locale: baseLocale })),
		title: input.title,
		description: input.description,
		type: input.type ?? 'website',
		robots: input.robots ?? 'index,follow',
		jsonLd: input.jsonLd ? serialiseJsonLd(input.jsonLd) : null,
		jsonLdTag: input.jsonLd
			? `<script type="application/ld+json">${serialiseJsonLd(input.jsonLd)}</script>`
			: null
	};
}

/**
 * JSON-LD is injected into a <script> element, so `<` must never be emitted raw: a resort
 * name is data from the database and must not be able to close the tag.
 */
function serialiseJsonLd(value: Record<string, unknown> | Record<string, unknown>[]): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Open Graph locale tags used on the product's four languages. */
export const OG_LOCALES: Record<string, string> = {
	en: 'en_GB',
	fi: 'fi_FI',
	sv: 'sv_SE',
	no: 'nb_NO'
};
