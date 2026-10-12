import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { getLocale, localizeHref, locales } from '#lib/paraglide/runtime.js';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';

export const load: PageServerLoad = async ({ setHeaders, url }) => {
	const locale = getLocale();
	const result = await loadPilotProduct({
		supabaseUrl: SUPABASE_URL ?? '',
		publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
	});

	setHeaders(result.headers);
	return {
		locale,
		canonical: new URL(localizeHref('/', { locale }), url.origin).toString(),
		alternates: locales.map((alternateLocale) => ({
			locale: alternateLocale,
			href: new URL(localizeHref('/', { locale: alternateLocale }), url.origin).toString()
		})),
		product: result.status === 200 ? result.body : { resorts: [], lastCollectionRun: null },
		unavailable: result.status !== 200
	};
};
