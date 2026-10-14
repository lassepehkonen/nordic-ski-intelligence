<script lang="ts">
	import type { ScoreBand } from '#lib/domain/types.js';
	import { bandColor, bandLabels } from '#lib/i18n/ui.js';

	interface Props {
		score: number | null;
		band: ScoreBand | null;
		size?: 'sm' | 'md' | 'lg';
		showBand?: boolean;
	}

	let { score, band, size = 'md', showBand = false }: Props = $props();

	const emptyLabel = $derived('–');
</script>

<span class="score-wrap">
	<span
		class="score-badge"
		data-size={size}
		data-empty={score === null ? 'true' : undefined}
		style="--band-color: {bandColor(band)}"
		aria-hidden="true"
	>
		{score ?? emptyLabel}
	</span>
	{#if showBand && band}
		<span class="score-band-label" style="--band-color: {bandColor(band)}"
			>{bandLabels[band]()}</span
		>
	{/if}
</span>

<style>
	.score-wrap {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}

	.score-band-label {
		font-size: var(--step--1);
		font-weight: 600;
		color: var(--band-color);
	}
</style>
