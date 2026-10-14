import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';
import { buildProductView, type ProductView } from '#lib/server/resorts/product-view.js';
import {
	filterAndSortResorts,
	isQueryActive,
	parseResortQuery
} from '#lib/server/resorts/product-query.js';
import { buildSeo } from '#lib/seo.js';

const EMPTY_PRODUCT: ProductView = { resorts: [], lastUpdated: null, lastCollectionRun: null };

/**
 * The full resort card list behind the same filter grammar as the home map, so the two views
 * always agree on which resorts a query selects.
 */
export const load: PageServerLoad = async ({ setHeaders, url }) => {
	const locale = getLocale();
	const result = await loadPilotProduct({
		supabaseUrl: SUPABASE_URL ?? '',
		publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
	});

	setHeaders(result.headers);

	const product =
		result.status === 200 ? buildProductView(result.body, { now: new Date() }) : EMPTY_PRODUCT;
	const query = parseResortQuery(url.searchParams, {
		availableSlugs: product.resorts.map((resort) => resort.slug)
	});
	const resorts = filterAndSortResorts(product.resorts, query, { locale });

	return {
		locale,
		unavailable: result.status !== 200,
		lastUpdated: product.lastUpdated,
		total: product.resorts.length,
		resorts,
		query: { ...query, active: isQueryActive(query) },
		seo: buildSeo({
			path: '/resorts',
			locale,
			origin: url.origin,
			title: m.metaResortsTitle(),
			description: m.metaResortsDescription()
		})
	};
};
