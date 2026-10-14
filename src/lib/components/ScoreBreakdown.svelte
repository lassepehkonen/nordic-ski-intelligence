<script lang="ts">
	import type { ConditionsScoreView } from '#lib/domain/types.js';
	import { formatWholeNumber } from '#lib/i18n/format.js';
	import { formatScoreInput } from '#lib/i18n/metrics.js';
	import { bandColor, currentLocale, metricLabel } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';

	let { score }: { score: ConditionsScoreView } = $props();

	const locale = $derived(currentLocale());

	const rows = $derived(
		score.inputs.map((input) => ({
			id: input.id,
			label: metricLabel(input.labelKey),
			value: input.missing ? null : formatScoreInput(input, locale),
			weight: Math.round(input.weight * 100),
			normalizedPercent: input.normalized === null ? 0 : Math.round(input.normalized * 100)
		}))
	);

	const coveragePercent = $derived(Math.round(score.coverage * 100));
</script>

<div class="stack" style="--gap: 0.7rem">
	<p class="small muted">{m.score_explanation_hint()}</p>

	<ul class="score-inputs">
		{#each rows as row (row.id)}
			<li class="score-input">
				<div class="row-line">
					<span class="row-label">{row.label}</span>
					<span class="row-value numeric">
						{#if row.value}
							{row.value}
						{:else}
							<span class="muted">{m.metric_missing()}</span>
						{/if}
					</span>
					<span class="chip"
						>{m.resort_rating_weight({ percent: formatWholeNumber(row.weight, locale) })}</span
					>
				</div>
				<div
					class="bar"
					style="--value: {row.normalizedPercent}%; --band-color: {bandColor(score.band)}"
					role="presentation"
				>
					<span></span>
				</div>
			</li>
		{/each}
	</ul>

	<p class="small muted cluster" style="--gap: 0.5rem">
		<span>{m.score_coverage({ percent: formatWholeNumber(coveragePercent, locale) })}</span>
		{#if score.partial}
			<span class="chip" data-tone="warn">{m.score_partial()}</span>
		{/if}
	</p>
</div>

<style>
	.score-inputs {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.score-input {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.row-line {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: baseline;
		gap: 0.6rem;
		font-size: var(--step--1);
	}

	.row-label {
		font-weight: 560;
	}

	.row-value {
		color: var(--ink-2);
	}
</style>
