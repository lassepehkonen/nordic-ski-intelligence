import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { getLocale, localizeHref, locales, type Locale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';
import { buildProductView, type ProductView } from '#lib/server/resorts/product-view.js';
import {
	filterAndSortResorts,
	isQueryActive,
	parseResortQuery,
	pickBestConditions,
	pickFreshestSnow,
	pickTopConditions
} from '#lib/server/resorts/product-query.js';
import { buildSeo } from '#lib/seo.js';

const EMPTY_PRODUCT: ProductView = { resorts: [], lastUpdated: null, lastCollectionRun: null };

export const load: PageServerLoad = async ({ setHeaders, url }) => {
	const locale = getLocale();
	const result = await loadPilotProduct({
		supabaseUrl: SUPABASE_URL ?? '',
		publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
	});

	setHeaders(result.headers);

	// A failed read is not an empty catalogue: the page says so explicitly instead of
	// rendering "no resorts".
	const product =
		result.status === 200 ? buildProductView(result.body, { now: new Date() }) : EMPTY_PRODUCT;
	const query = parseResortQuery(url.searchParams, {
		availableSlugs: product.resorts.map((resort) => resort.slug)
	});
	const resorts = filterAndSortResorts(product.resorts, query, { locale });
	const best = pickBestConditions(product.resorts);
	const freshest = pickFreshestSnow(product.resorts);

	const items = product.resorts.map((resort, index) => ({
		'@type': 'ListItem',
		position: index + 1,
		name: resort.name,
		url: new URL(
			localizeHref(`/resort/${resort.slug}`, { locale: locale as Locale }),
			url.origin
		).toString()
	}));

	return {
		locale,
		availableLocales: locales,
		unavailable: result.status !== 200,
		lastUpdated: product.lastUpdated,
		total: product.resorts.length,
		resorts,
		query: { ...query, active: isQueryActive(query) },
		bestSlug: best?.slug ?? null,
		freshestSlug: freshest?.slug ?? null,
		// A compact highlight row: the top published Conditions Scores for the *filtered* set.
		topResorts: pickTopConditions(resorts, 3),
		seo: buildSeo({
			path: '/',
			locale,
			origin: url.origin,
			title: m.metaHomeTitle(),
			description: m.metaHomeDescription(),
			jsonLd: {
				'@context': 'https://schema.org',
				'@type': 'ItemList',
				name: m.metaHomeTitle(),
				itemListElement: items
			}
		})
	};
};
