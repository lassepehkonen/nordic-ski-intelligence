import type { RequestEvent } from '@sveltejs/kit';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';
import { buildProductView } from '#lib/server/resorts/product-view.js';
import { baseLocale, localizeHref, locales, type Locale } from '#lib/paraglide/runtime.js';

/**
 * Sitemap with per-URL hreflang alternates (every locale plus x-default), generated from the
 * live catalogue so a new resort appears in every language without touching a static file.
 * Excluded from locale rewriting in project.inlang/paraglide.config.js.
 */
function absolute(origin: string, path: string, locale: string): string {
	return new URL(localizeHref(path, { locale: locale as Locale }), origin).toString();
}

function urlEntry(origin: string, path: string, lastmod?: string): string {
	const locations = [
		...locales.map((locale) => ({
			locale,
			href: absolute(origin, path, locale)
		})),
		{
			locale: 'x-default',
			href: absolute(origin, path, baseLocale)
		}
	];
	const lastmodLine = lastmod ? `		<lastmod>${lastmod}</lastmod>` : undefined;

	return [
		'	<url>',
		`		<loc>${absolute(origin, path, 'en')}</loc>`,
		...(lastmodLine ? [lastmodLine] : []),
		...locations.map(
			(entry) => `		<xhtml:link rel="alternate" hreflang="${entry.locale}" href="${entry.href}" />`
		),
		'	</url>'
	].join('\n');
}

export const GET = async ({ url, setHeaders }: RequestEvent) => {
	let paths = ['/', '/resorts', '/compare'];
	let lastmod: string | undefined;

	try {
		const result = await loadPilotProduct({
			supabaseUrl: SUPABASE_URL ?? '',
			publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
		});
		if (result.status === 200) {
			const product = buildProductView(result.body, { now: new Date() });
			paths = [...paths, ...product.resorts.map((resort) => `/resort/${resort.slug}`)];
			// W3C datetime (the sitemap format) from the newest snapshot across the product.
			if (product.lastUpdated) {
				const date = new Date(product.lastUpdated);
				if (!Number.isNaN(date.getTime())) lastmod = date.toISOString();
			}
		}
	} catch {
		// A sitemap without resort URLs is still valid, and the pages are linked from the map.
	}

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...paths.map((path) => urlEntry(url.origin, path, lastmod)),
		'</urlset>',
		''
	].join('\n');

	setHeaders({ 'cache-control': 'public, max-age=600' });

	return new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
