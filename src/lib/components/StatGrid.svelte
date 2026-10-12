<script lang="ts">
	interface Stat {
		id: string;
		label: string;
		value: string;
		hint?: string | null;
		missing?: boolean;
	}

	let { stats }: { stats: Stat[] } = $props();
</script>

<dl class="fact-grid">
	{#each stats as stat (stat.id)}
		<div class="fact">
			<dt>{stat.label}</dt>
			<dd data-missing={stat.missing ? 'true' : undefined} class="numeric">{stat.value}</dd>
			{#if stat.hint}
				<p class="small muted">{stat.hint}</p>
			{/if}
		</div>
	{/each}
</dl>
