import { createPreviewRepositories } from '#lib/data/repository.js';
import {
	bestByConditions,
	filterResorts,
	parseComparisonSelection,
	parseFilters,
	sortResorts
} from '#lib/domain/selectors.js';
import { compareLink, currentLocale } from '#lib/i18n/ui.js';
import { m } from '#lib/paraglide/messages.js';
import { toMapPoints } from '#lib/presentation/map.js';
import { buildPageMeta, siteOrigin } from '#lib/seo/meta.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const now = new Date();
	const locale = currentLocale();
	const repositories = createPreviewRepositories();
	const allItems = repositories.listItems(locale, now);

	const filters = parseFilters(url.searchParams);
	const selectedForComparison = parseComparisonSelection(url.searchParams);
	const filtered = sortResorts(filterResorts(allItems, filters), filters.sort, locale);

	return {
		locale,
		now: now.toISOString(),
		filters,
		filtered,
		comparisonSelection: selectedForComparison,
		totalCount: allItems.length,
		// The map is the home page; a compact "best conditions" row sits under it, so the
		// highlights follow the active filters and the page never fills with cards.
		best: bestByConditions(filtered, 3),
		// The home page is the map: markers follow exactly the filter result set.
		mapPoints: toMapPoints(filtered, locale, (slug) =>
			compareLink(selectedForComparison, slug, locale)
		),
		meta: buildPageMeta({
			path: '/',
			title: m.meta_home_title(),
			description: m.meta_home_description(),
			origin: siteOrigin(url.origin),
			locale,
			siteName: m.site_name()
		})
	};
};
