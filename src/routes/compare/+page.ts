import { createPreviewRepositories } from '#lib/data/repository.js';
import { buildComparisonSections, parseComparisonSelection } from '#lib/domain/selectors.js';
import { currentLocale, countryLabels } from '#lib/i18n/ui.js';
import { m } from '#lib/paraglide/messages.js';
import { buildPageMeta, siteOrigin } from '#lib/seo/meta.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const now = new Date();
	const locale = currentLocale();
	const repositories = createPreviewRepositories();

	const allItems = repositories.listItems(locale, now);
	const selected = parseComparisonSelection(url.searchParams);
	const items = selected
		.map((slug) => allItems.find((item) => item.resort.id === slug))
		.filter((item): item is (typeof allItems)[number] => Boolean(item));

	return {
		locale,
		selected,
		items,
		columns: items.map((item) => ({
			id: item.resort.id,
			name: item.translation.name,
			href: `/${locale}/resort/${item.resort.id}`
		})),
		sections:
			items.length >= 2
				? buildComparisonSections(items, (country) => countryLabels[country]())
				: [],
		options: allItems.map((item) => ({
			id: item.resort.id,
			name: item.translation.name,
			region: item.translation.region,
			country: item.resort.country,
			selected: selected.includes(item.resort.id)
		})),
		meta: buildPageMeta({
			path: '/compare',
			title: m.meta_compare_title(),
			description: m.meta_compare_description(),
			origin: siteOrigin(url.origin),
			locale,
			siteName: m.site_name()
		})
	};
};
