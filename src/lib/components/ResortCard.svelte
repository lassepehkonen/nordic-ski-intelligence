<script lang="ts">
	import type { ResortListItem } from '#lib/domain/selectors.js';
	import { formatDateTime, formatPercent } from '#lib/i18n/format.js';
	import { formatSnowCm } from '#lib/i18n/metrics.js';
	import { countryLabels, currentLocale, href } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';
	import FreshnessChip from './FreshnessChip.svelte';
	import ScoreBadge from './ScoreBadge.svelte';

	interface Props {
		item: ResortListItem;
		/** Pre-built comparison link that adds this resort to the current selection. */
		compareHref: string;
	}

	let { item, compareHref }: Props = $props();

	const locale = $derived(currentLocale());
	const metrics = $derived(item.metrics);
	const openPistes = $derived(
		metrics.openPistes !== null && metrics.totalPistes !== null
			? m.resort_open_of({ open: String(metrics.openPistes), total: String(metrics.totalPistes) })
			: m.not_reported()
	);
	const openLifts = $derived(
		metrics.openLifts !== null && metrics.totalLifts !== null
			? m.resort_open_of({ open: String(metrics.openLifts), total: String(metrics.totalLifts) })
			: m.not_reported()
	);
</script>

<article class="card resort-card">
	<header class="card-head">
		<div class="stack" style="--gap: 0.3rem">
			<h3>
				<a href={href(`/resort/${item.resort.id}`)}>{item.translation.name}</a>
			</h3>
			<p class="small muted">
				{item.translation.region} · {item.translation.municipality}
			</p>
		</div>
		<ScoreBadge score={item.score.score} band={item.score.band} showBand={true} />
	</header>

	<dl class="stat-line">
		<div>
			<dt>{m.card_new_snow()}</dt>
			<dd class="numeric">
				{metrics.newSnow24hCm === null ? '–' : formatSnowCm(metrics.newSnow24hCm, locale)}
			</dd>
		</div>
		<div>
			<dt>{m.card_snow_depth()}</dt>
			<dd class="numeric">
				{metrics.snowDepthCm === null ? '–' : formatSnowCm(metrics.snowDepthCm, locale)}
			</dd>
		</div>
		<div>
			<dt>{m.card_open_pistes()}</dt>
			<dd class="numeric">
				{item.openPisteRatio === null ? openPistes : formatPercent(item.openPisteRatio, locale)}
			</dd>
		</div>
		<div>
			<dt>{m.card_open_lifts()}</dt>
			<dd class="numeric">
				{item.openLiftRatio === null ? openLifts : formatPercent(item.openLiftRatio, locale)}
			</dd>
		</div>
	</dl>

	<p class="meta-row">
		<FreshnessChip freshness={item.score.freshness} />
		<span class="chip">{countryLabels[item.resort.country]()}</span>
		{#if item.conditions.lastUpdated}
			<span>{m.last_updated_label()}: {formatDateTime(item.conditions.lastUpdated, locale)}</span>
		{/if}
	</p>

	<footer class="card-actions">
		<a class="btn" data-variant="primary" href={href(`/resort/${item.resort.id}`)}
			>{m.view_resort()}</a
		>
		<a class="btn" href={compareHref}>{m.add_to_compare()}</a>
	</footer>
</article>

<style>
	.resort-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.stat-line {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem 0.75rem;
		margin: 0;
	}

	.stat-line dt {
		font-size: var(--step--1);
		color: var(--ink-3);
	}

	.stat-line dd {
		margin: 0;
		font-size: var(--step-1);
		font-weight: 600;
	}

	.card-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: auto;
	}
</style>
