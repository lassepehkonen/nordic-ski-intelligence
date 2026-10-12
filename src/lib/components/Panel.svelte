<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		hint?: string | null;
		id?: string | null;
		as?: 'section' | 'div';
		children: Snippet;
	}

	let { title, hint = null, id = null, as = 'section', children }: Props = $props();
</script>

<svelte:element this={as} class="card stack" {id} style="--gap: 0.85rem">
	<header class="section-head">
		<h2>{title}</h2>
		{#if hint}
			<p>{hint}</p>
		{/if}
	</header>
	{@render children()}
</svelte:element>
