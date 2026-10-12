<script lang="ts">
	import DataNotice from '#lib/components/DataNotice.svelte';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import ResortCard from '#lib/components/ResortCard.svelte';
	import ResortMap from '#lib/components/ResortMap.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { comparisonHref } from '#lib/domain/selectors.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const compareHrefFor = (slug: string) => comparisonHref(data.comparisonSelection, slug);
</script>

<SeoHead meta={data.meta} />

<div class="container stack" style="--gap: 1.5rem">
	<section class="section stack" style="--gap: 0.75rem">
		<h1>{m.home_title()}</h1>
		<p class="lede">{m.home_intro()}</p>
		<DataNotice dataState="illustrative" compact={true} />
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

	<section aria-label={m.filter_sort_label()} class="section">
		<FilterBar filters={data.filters} resultCount={data.filtered.length} />
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

	{#if data.fresh.length > 0}
		<section aria-labelledby="fresh-heading" class="section stack" style="--gap: 0.6rem">
			<div class="section-head">
				<h2 id="fresh-heading">{m.section_fresh_title()}</h2>
				<p>{m.section_fresh_hint()}</p>
			</div>
			<div class="grid-cards">
				{#each data.fresh as item (item.resort.id)}
					<ResortCard {item} compareHref={compareHrefFor(item.resort.id)} />
				{/each}
			</div>
		</section>
	{/if}

	<section aria-labelledby="list-heading" class="section stack" style="--gap: 0.75rem">
		<div class="section-head">
			<h2 id="list-heading">{m.list_title()}</h2>
			<p>{m.results_count({ count: String(data.filtered.length) })}</p>
		</div>

		{#if data.filtered.length === 0}
			<div class="card stack" style="--gap: 0.4rem">
				<h3>{m.results_empty_title()}</h3>
				<p class="muted">{m.results_empty_hint()}</p>
			</div>
		{:else}
			<div class="grid-cards">
				{#each data.filtered as item (item.resort.id)}
					<ResortCard {item} compareHref={compareHrefFor(item.resort.id)} />
				{/each}
			</div>
		{/if}
	</section>
</div>
