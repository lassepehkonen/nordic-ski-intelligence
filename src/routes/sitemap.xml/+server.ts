import { LOCALES } from '#lib/i18n/locales.js';
import { RESORTS } from '#lib/data/resorts.js';
import { siteOrigin } from '#lib/seo/meta.js';
import type { RequestHandler } from './$types';

/**
 * Every localized page is listed with `hreflang` alternates so search engines see one product in
 * four languages rather than four sites (ADR-0007). Paths are built explicitly here rather than
 * through the Paraglide runtime: this route is excluded from the locale middleware.
 */
export const GET: RequestHandler = ({ url }) => {
	const origin = siteOrigin(url.origin);
	const paths = ['/', '/compare', ...RESORTS.map((resort) => `/resort/${resort.id}`)];
	const lastModified = new Date().toISOString().slice(0, 10);

	const entries = paths.flatMap((path) => {
		const suffix = path === '/' ? '' : path;
		return LOCALES.map((locale) => {
			const alternates = LOCALES.map(
				(code) =>
					`\t\t<xhtml:link rel="alternate" hreflang="${code}" href="${origin}/${code}${suffix}" />`
			).join('\n');
			return [
				'\t<url>',
				`\t\t<loc>${origin}/${locale}${suffix}</loc>`,
				`\t\t<lastmod>${lastModified}</lastmod>`,
				alternates,
				`\t\t<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/en${suffix}" />`,
				'\t</url>'
			].join('\n');
		});
	});

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`,
		{
			headers: {
				'content-type': 'application/xml; charset=utf-8',
				'cache-control': 'public, max-age=3600'
			}
		}
	);
};
