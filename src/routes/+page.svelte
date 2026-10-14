<script lang="ts">
	import DataNotice from '#lib/components/DataNotice.svelte';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import ResortCard from '#lib/components/ResortCard.svelte';
	import ResortMap from '#lib/components/ResortMap.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { currentLocale, compareLink } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const compareHrefFor = (slug: string) =>
		compareLink(data.comparisonSelection, slug, currentLocale());
</script>

<SeoHead meta={data.meta} />

<div class="container stack" style="--gap: 1.5rem">
	<section class="section stack" style="--gap: 0.75rem">
		<h1>{m.home_title()}</h1>
		<p class="lede">{m.home_intro()}</p>
		<DataNotice dataState="illustrative" compact={true} />
	</section>

	<section aria-label={m.filter_sort_label()} class="section">
		<FilterBar filters={data.filters} resultCount={data.filtered.length} basePath="/" />
	</section>

	<section aria-labelledby="map-heading" class="section stack" style="--gap: 0.6rem">
		<div class="section-head">
			<h2 id="map-heading">{m.map_title()}</h2>
			<p>{m.map_hint()}</p>
		</div>
		<ResortMap
			points={data.mapPoints}
			openLabel={m.view_resort()}
			compareLabel={m.add_to_compare()}
		/>
	</section>

	{#if data.best.length > 0}
		<section aria-labelledby="best-heading" class="section stack" style="--gap: 0.6rem">
			<div class="section-head">
				<h2 id="best-heading">{m.section_best_title()}</h2>
				<p>{m.section_best_hint()}</p>
			</div>
			<div class="grid-cards">
				{#each data.best as item (item.resort.id)}
					<ResortCard {item} compareHref={compareHrefFor(item.resort.id)} />
				{/each}
			</div>
		</section>
	{/if}
</div>
