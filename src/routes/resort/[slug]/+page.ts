import { error } from '@sveltejs/kit';
import { createPreviewRepositories } from '#lib/data/repository.js';
import { parseComparisonSelection } from '#lib/domain/selectors.js';
import { compareLink, currentLocale } from '#lib/i18n/ui.js';
import { m } from '#lib/paraglide/messages.js';
import { buildPageMeta, resortJsonLd, siteOrigin } from '#lib/seo/meta.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
	const now = new Date();
	const locale = currentLocale();
	const repositories = createPreviewRepositories();

	const result = repositories.listItem(params.slug, locale, now);
	if (!result.ok) {
		error(404, m.error_title());
	}

	const { resort, translation, conditions, score, rating, metrics } = result.value;
	const origin = siteOrigin(url.origin);
	const path = `/resort/${resort.id}`;
	const selected = parseComparisonSelection(url.searchParams);

	return {
		locale,
		resort,
		translation,
		conditions,
		score,
		rating,
		metrics,
		sources: repositories.sourcesFor(resort, conditions),
		compareHref: compareLink(selected, resort.id, locale),
		meta: buildPageMeta({
			path,
			title: m.meta_resort_title({ resort: translation.name }),
			description: m.meta_resort_description({ resort: translation.name }),
			origin,
			locale,
			siteName: m.site_name()
		}),
		jsonLd: resortJsonLd({
			name: translation.name,
			summary: translation.summary,
			country: resort.country,
			lat: resort.coordinates.lat,
			lon: resort.coordinates.lon,
			url: new URL(`${origin}/${locale}${path}`).toString(),
			officialSite: resort.officialSite
		})
	};
};
