<script lang="ts">
	import ComparisonTable from '#lib/components/ComparisonTable.svelte';
	import ComparePicker from '#lib/components/ComparePicker.svelte';
	import DataNotice from '#lib/components/DataNotice.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead meta={data.meta} />

<div class="container stack" style="--gap: 1.25rem">
	<section class="section stack" style="--gap: 0.5rem">
		<h1>{m.compare_title()}</h1>
		<p class="muted">{m.compare_intro()}</p>
		<p class="small muted numeric">
			{m.compare_selected_count({ count: String(data.items.length) })} · {m.compare_hint_max()}
		</p>
	</section>

	<ComparePicker options={data.options} />

	{#if data.sections.length > 0}
		<section class="section">
			<ComparisonTable columns={data.columns} sections={data.sections} />
		</section>
	{:else}
		<div class="card stack" style="--gap: 0.4rem">
			<h2>{m.compare_empty_title()}</h2>
			<p class="muted">{m.compare_empty_hint()}</p>
		</div>
	{/if}

	<DataNotice dataState={data.items[0]?.conditions.dataState ?? 'illustrative'} />
</div>
