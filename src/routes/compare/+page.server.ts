import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { getLocale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';
import { buildProductView, type ProductView } from '#lib/server/resorts/product-view.js';
import {
	parseResortQuery,
	pickBestConditions,
	selectComparison
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

	const product =
		result.status === 200 ? buildProductView(result.body, { now: new Date() }) : EMPTY_PRODUCT;
	const query = parseResortQuery(url.searchParams, {
		availableSlugs: product.resorts.map((resort) => resort.slug)
	});
	const selected = selectComparison(product.resorts, query.compare);
	const best = pickBestConditions(selected);

	return {
		locale,
		unavailable: result.status !== 200,
		lastUpdated: product.lastUpdated,
		selection: query.compare,
		selected,
		// The picker lists the whole catalogue so any resort can be added to the comparison.
		candidates: product.resorts.map((resort) => ({
			slug: resort.slug,
			name: resort.name,
			countryCode: resort.countryCode,
			region: resort.region,
			scorePublished: resort.score.published,
			score: resort.score.published ? resort.score.score : null
		})),
		bestSlug: best?.slug ?? null,
		seo: buildSeo({
			path: '/compare',
			locale,
			origin: url.origin,
			title: m.metaCompareTitle(),
			description: m.metaCompareDescription(),
			robots: query.compare.length >= 2 ? 'index,follow' : 'noindex,follow'
		})
	};
};
