<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { ConditionsScoreView } from '#lib/server/resorts/product-view.js';
	import {
		formatDateTime,
		formatNumber,
		reasonLabel,
		scoreTone,
		toneClass
	} from '#lib/i18n/format.js';

	let {
		score,
		locale,
		countryCode
	}: { score: ConditionsScoreView; locale: string; countryCode: string } = $props();

	const published = $derived(score.published && score.score !== null);
	const scoreValue = $derived(score.score === null ? null : Math.round(score.score));
	const coveragePercent = $derived(Math.round(score.coverage.availableWeightShare * 100));
	const tone = $derived(scoreTone(score.score, score.published));
</script>

<div class="score-row">
	{#if published}
		<div
			class="score-dial"
			style="--score-pct:{scoreValue}"
			role="img"
			aria-label={`${m.resortScoreTitle()}: ${scoreValue}`}
		>
			<span class="score-dial-inner">
				<span class="score-dial-value tabular">{scoreValue}</span>
			</span>
		</div>
		<div class="score-meta">
			<p class={toneClass(tone)}>
				{m.resortScoreCoverage({ percent: formatNumber(coveragePercent, locale) })}
			</p>
			<p class="muted">{m.resortScoreVersion({ version: score.version })}</p>
			<p class="muted">
				{m.resortScoreComputedAt({
					timestamp: formatDateTime(score.computedAt, locale, countryCode)
				})}
			</p>
		</div>
	{:else}
		<div class="score-dial">
			<span class="score-dial-inner">
				<span class="score-dial-out">{m.cardScoreNotPublished()}</span>
			</span>
		</div>
		<div class="score-meta">
			<p class="small">{m.resortScoreNotPublishedBody()}</p>
			<ul class="reason-list">
				{#each score.gateReasonKeys as key (key)}
					<li>{reasonLabel(key)}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
