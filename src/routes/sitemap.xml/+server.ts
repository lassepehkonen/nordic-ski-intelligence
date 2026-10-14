import type { RequestEvent } from '@sveltejs/kit';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';
import { buildProductView } from '#lib/server/resorts/product-view.js';
import { localizeHref, locales, type Locale } from '#lib/paraglide/runtime.js';

/**
 * Sitemap with per-URL hreflang alternates, generated from the live catalogue so a new resort
 * appears in every language without touching a static file. Excluded from locale rewriting in
 * project.inlang/paraglide.config.js.
 */
function absolute(origin: string, path: string, locale: string): string {
	return new URL(localizeHref(path, { locale: locale as Locale }), origin).toString();
}

function urlEntry(origin: string, path: string): string {
	const locations = locales.map((locale) => ({
		locale,
		href: absolute(origin, path, locale)
	}));

	return [
		'\t<url>',
		`\t\t<loc>${absolute(origin, path, 'en')}</loc>`,
		...locations.map(
			(entry) =>
				`\t\t<xhtml:link rel="alternate" hreflang="${entry.locale}" href="${entry.href}" />`
		),
		'\t</url>'
	].join('\n');
}

export const GET = async ({ url, setHeaders }: RequestEvent) => {
	let paths = ['/', '/resorts', '/compare'];

	try {
		const result = await loadPilotProduct({
			supabaseUrl: SUPABASE_URL ?? '',
			publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
		});
		if (result.status === 200) {
			const resorts = buildProductView(result.body, { now: new Date() }).resorts;
			paths = [...paths, ...resorts.map((resort) => `/resort/${resort.slug}`)];
		}
	} catch {
		// A sitemap without resort URLs is still valid, and the pages are linked from the map.
	}

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...paths.map((path) => urlEntry(url.origin, path)),
		'</urlset>',
		''
	].join('\n');

	setHeaders({ 'cache-control': 'public, max-age=600' });

	return new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
