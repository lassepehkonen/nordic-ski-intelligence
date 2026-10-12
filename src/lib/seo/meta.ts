/**
 * SEO helpers (ADR-0007): every page renders a self-referencing canonical URL, `hreflang`
 * alternates for all four locales plus `x-default`, and localized Open Graph/Twitter metadata.
 */

import { OPEN_GRAPH_LOCALES, type Locale } from '../i18n/locales.js';
import { alternateHrefs } from '../i18n/ui.js';

export interface AlternateLink {
	locale: Locale;
	hreflang: string;
	href: string;
}

export interface PageMeta {
	title: string;
	description: string;
	canonical: string;
	alternates: AlternateLink[];
	ogLocale: string;
	ogLocaleAlternates: string[];
	siteName: string;
}

/**
 * Absolute base URL for canonical URLs, `hreflang` and the sitemap.
 *
 * The serving origin is used, so a Netlify preview (or any host the build is deployed to) always
 * self-references the domain it is actually served from; a custom domain therefore needs no
 * rebuild-time configuration.
 */
export function siteOrigin(requestOrigin: string): string {
	return requestOrigin;
}

export function absoluteUrl(href: string, origin: string): string {
	return new URL(href, origin).toString();
}

export interface BuildPageMetaInput {
	/** Canonical, unprefixed path of the page, e.g. `/resort/levi`. */
	path: string;
	title: string;
	description: string;
	origin: string;
	locale: Locale;
	siteName: string;
}

export function buildPageMeta({
	path,
	title,
	description,
	origin,
	locale,
	siteName
}: BuildPageMetaInput): PageMeta {
	const alternates = alternateHrefs(path).map((alternate) => ({
		locale: alternate.locale,
		hreflang: alternate.locale,
		href: absoluteUrl(alternate.href, origin)
	}));

	return {
		title,
		description,
		canonical: absoluteUrl(`/${locale}${path === '/' ? '' : path}`, origin),
		alternates: [
			...alternates,
			{
				locale,
				hreflang: 'x-default',
				href: absoluteUrl('/en' + (path === '/' ? '' : path), origin)
			}
		],
		ogLocale: OPEN_GRAPH_LOCALES[locale],
		ogLocaleAlternates: (Object.values(OPEN_GRAPH_LOCALES) as string[]).filter(
			(value) => value !== OPEN_GRAPH_LOCALES[locale]
		),
		siteName
	};
}

/** schema.org `SkiResort` structured data for a resort page. */
export function resortJsonLd(input: {
	name: string;
	summary: string;
	country: string;
	lat: number;
	lon: number;
	url: string;
	officialSite: string | null;
}): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'SkiResort',
		name: input.name,
		description: input.summary,
		url: input.url,
		address: {
			'@type': 'PostalAddress',
			addressCountry: input.country
		},
		geo: {
			'@type': 'GeoCoordinates',
			latitude: input.lat,
			longitude: input.lon
		},
		...(input.officialSite ? { sameAs: [input.officialSite] } : {})
	};
}
