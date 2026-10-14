import { createPreviewRepositories } from '#lib/data/repository.js';
import {
	filterResorts,
	parseComparisonSelection,
	parseFilters,
	sortResorts
} from '#lib/domain/selectors.js';
import { compareLink, currentLocale } from '#lib/i18n/ui.js';
import { m } from '#lib/paraglide/messages.js';
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
		compareLink: (slug: string) => compareLink(selectedForComparison, slug, locale),
		meta: buildPageMeta({
			path: '/resorts',
			title: m.meta_resorts_title(),
			description: m.meta_resorts_description(),
			origin: siteOrigin(url.origin),
			locale,
			siteName: m.site_name()
		})
	};
};
