<script lang="ts">
	import FilterBar from '#lib/components/FilterBar.svelte';
	import ResortCard from '#lib/components/ResortCard.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { href } from '#lib/i18n/ui.js';
	import { isFiltered } from '#lib/domain/selectors.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** "Reset" inside the empty state keeps the active sort but drops every filter. */
	const clearFilterHref = $derived(
		href(
			data.filters.sort === 'best_conditions' ? '/resorts' : `/resorts?sort=${data.filters.sort}`
		)
	);

	const filteredActive = $derived(isFiltered(data.filters));
</script>

<SeoHead meta={data.meta} />

<div class="container stack" style="--gap: 1.5rem">
	<section class="section stack" style="--gap: 0.5rem">
		<h1>{m.list_title()}</h1>
		<p class="lede">{m.resorts_intro()}</p>
	</section>

	<section aria-label={m.filter_sort_label()} class="section">
		<FilterBar filters={data.filters} resultCount={data.filtered.length} basePath="/resorts" />
	</section>

	<section aria-labelledby="list-heading" class="section stack" style="--gap: 0.75rem">
		<div class="section-head">
			<h2 id="list-heading">{m.resorts_results_title()}</h2>
			<p>{m.results_count({ count: String(data.filtered.length) })}</p>
		</div>

		{#if data.filtered.length === 0}
			<div class="card stack" style="--gap: 0.4rem">
				<h3>{m.results_empty_title()}</h3>
				<p class="muted">{m.results_empty_hint()}</p>
				{#if filteredActive}
					<p>
						<a class="btn" data-variant="primary" href={clearFilterHref}>{m.filter_reset()}</a>
					</p>
				{/if}
			</div>
		{:else}
			<div class="grid-cards">
				{#each data.filtered as item (item.resort.id)}
					<ResortCard {item} compareHref={data.compareLink(item.resort.id)} />
				{/each}
			</div>
		{/if}
	</section>
</div>
