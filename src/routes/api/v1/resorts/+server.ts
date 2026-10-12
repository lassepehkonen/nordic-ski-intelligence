import { json, type RequestEvent } from '@sveltejs/kit';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';
import { buildProductView, type ResortView } from '#lib/server/resorts/product-view.js';
import {
	filterAndSortResorts,
	parseResortQuery,
	pickBestConditions,
	pickFreshestSnow
} from '#lib/server/resorts/product-query.js';
import { getLocale } from '#lib/paraglide/runtime.js';

/**
 * Public product API (JSON). Same filters as the map UI so both consume one query contract:
 *   /api/v1/resorts?country=FI&minScore=60&sort=freshSnow&q=lapland
 *
 * Numbers are reported as they are stored: a metric the resort does not report is `null`, never
 * 0, and an unpublished Conditions Score is `null` with `score.published = false`.
 */
function toApiResort(resort: ResortView) {
	return {
		slug: resort.slug,
		name: resort.name,
		countryCode: resort.countryCode,
		region: resort.region,
		size: resort.size,
		location: {
			latitude: resort.location.latitude,
			longitude: resort.location.longitude,
			sourceUrl: resort.location.sourceUrl,
			attribution: resort.location.attribution
		},
		status: {
			openLifts: resort.status.lifts.open,
			totalLifts: resort.status.lifts.total,
			openPistes: resort.status.pistes.open,
			totalPistes: resort.status.pistes.total,
			freshness: resort.status.freshness,
			checkedAt: resort.status.checkedAt,
			sourceUrl: resort.status.sourceUrl,
			attribution: resort.status.attribution
		},
		inventory: {
			lifts: resort.inventory.lifts,
			pistes: resort.inventory.pistes,
			sourceUrl: resort.inventory.sourceUrl,
			attribution: resort.inventory.attribution
		},
		snow: {
			depthCm: resort.weather.snow.depthCm,
			recentSnowfall24hCm: resort.weather.snow.recentSnowfall24hCm,
			observedAt: resort.weather.snow.observedAt,
			sourceUrl: resort.weather.snow.sourceUrl
		},
		weather: {
			provider: resort.weather.provider,
			freshness: resort.weather.freshness,
			fetchedAt: resort.weather.fetchedAt,
			sourceUrl: resort.weather.sourceUrl,
			attribution: resort.weather.attribution,
			current: resort.weather.current,
			forecast: resort.weather.forecast
		},
		score: {
			published: resort.score.published,
			score: resort.score.score,
			version: resort.score.version,
			computedAt: resort.score.computedAt,
			coverage: resort.score.coverage,
			gateReasonKeys: resort.score.gateReasonKeys,
			components: resort.score.components.map((component) => ({
				id: component.id,
				weight: component.weight,
				status: component.status,
				raw: component.raw,
				normalized: component.normalized,
				points: component.points,
				observedAt: component.observedAt,
				reasonKeys: component.reasonKeys
			}))
		},
		rating: {
			published: resort.rating.published,
			rating: resort.rating.rating,
			version: resort.rating.version,
			coverageShare: resort.rating.coverageShare,
			coverageThreshold: resort.rating.coverageThreshold,
			categories: resort.rating.categories,
			gateReasonKeys: resort.rating.reasonKeys
		},
		sources: resort.sources,
		lastUpdated: resort.lastUpdated
	};
}

export const GET = async ({ url, setHeaders }: RequestEvent) => {
	const result = await loadPilotProduct({
		supabaseUrl: SUPABASE_URL ?? '',
		publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
	});

	for (const [name, value] of Object.entries(result.headers)) setHeaders({ [name]: value });

	if (result.status !== 200) {
		return json(
			{ error: 'product_unavailable', resorts: [], lastUpdated: null },
			{ status: result.status }
		);
	}

	const product = buildProductView(result.body, { now: new Date() });
	const query = parseResortQuery(url.searchParams, {
		availableSlugs: product.resorts.map((resort) => resort.slug)
	});
	const resorts = filterAndSortResorts(product.resorts, query, { locale: getLocale() });
	const best = pickBestConditions(product.resorts);
	const freshest = pickFreshestSnow(product.resorts);

	return json({
		locale: getLocale(),
		lastUpdated: product.lastUpdated,
		totalResorts: product.resorts.length,
		returnedResorts: resorts.length,
		query: { ...query },
		bestConditions: best ? { slug: best.slug, score: best.score.score } : null,
		freshestSnow: freshest
			? { slug: freshest.slug, recentSnowfall24hCm: freshest.weather.snow.recentSnowfall24hCm }
			: null,
		resorts: resorts.map(toApiResort)
	});
};
