import { error } from '@sveltejs/kit';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { getLocale, localizeHref, type Locale } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';
import { buildProductView } from '#lib/server/resorts/product-view.js';
import { findResort } from '#lib/server/resorts/product-query.js';
import { buildSeo } from '#lib/seo.js';
import { lookupAvalancheForecast } from '#lib/server/weather/avalanche.js';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
	const locale = getLocale();
	const path = `/resort/${params.slug}`;

	const result = await loadPilotProduct({
		supabaseUrl: SUPABASE_URL ?? '',
		publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
	});

	setHeaders(result.headers);

	// The data source being unavailable is not a 404: the page renders its shell and says so.
	if (result.status !== 200) {
		return {
			locale,
			unavailable: true,
			resort: null,
			lastUpdated: null,
			seo: buildSeo({
				path,
				locale,
				origin: url.origin,
				title: m.unavailableTitle(),
				description: m.unavailableBody(),
				robots: 'noindex,follow'
			})
		};
	}

	const product = buildProductView(result.body, { now: new Date() });
	const resort = findResort(product.resorts, params.slug);
	if (!resort) error(404, m.resortNotFoundTitle());

	const title = m.metaResortTitle({ resort: resort.name });
	const description = m.metaResortDescription({ resort: resort.name, region: resort.region });

	const avalanche = await lookupAvalancheForecast(params.slug);

	return {
		locale,
		unavailable: false,
		resort,
		avalanche,
		lastUpdated: product.lastUpdated,
		seo: buildSeo({
			path,
			locale,
			origin: url.origin,
			title,
			description,
			type: 'article',
			jsonLd: [
				{
					'@context': 'https://schema.org',
					'@type': 'TouristAttraction',
					name: resort.name,
					description,
					address: {
						'@type': 'PostalAddress',
						addressRegion: resort.region,
						addressCountry: resort.countryCode
					},
					geo: {
						'@type': 'GeoCoordinates',
						latitude: resort.location.latitude,
						longitude: resort.location.longitude
					},
					url: new URL(localizeHref(path, { locale: locale as Locale }), url.origin).toString(),
					sameAs: resort.sources.map((source) => source.url)
				},
				{
					'@context': 'https://schema.org',
					'@type': 'Dataset',
					name: `${resort.name} — ${m.metaHomeTitle()}`,
					description,
					temporalCoverage: resort.lastUpdated ?? undefined,
					creator: {
						'@type': 'Organization',
						name: m.siteName()
					},
					isAccessibleForFree: true,
					license: resort.sources.map((source) => source.attribution)
				}
			]
		})
	};
};
