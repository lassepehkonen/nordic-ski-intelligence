<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import type { ResortView } from '#lib/server/resorts/product-view.js';
	import type { Seo } from '#lib/seo.js';
	import {
		countryName,
		formatCm,
		formatCount,
		formatDateTime,
		formatSnowfall,
		formatTemperature,
		formatWind,
		freshnessLabel,
		freshnessTone,
		sizeLabel,
		toneClass
	} from '#lib/i18n/format.js';

	interface CompareData {
		locale: string;
		unavailable: boolean;
		lastUpdated: string | null;
		selection: string[];
		selected: ResortView[];
		candidates: {
			slug: string;
			name: string;
			countryCode: string;
			region: string;
			scorePublished: boolean;
			score: number | null;
		}[];
		bestSlug: string | null;
		seo: Seo;
	}

	let { data }: { data: CompareData } = $props();

	const comparePath = $derived(localizeHref('/compare', { locale: data.locale as Locale }));
	const ready = $derived(data.selected.length >= 2);
	const bestScore = $derived(
		data.bestSlug === null
			? null
			: (data.selected.find((resort) => resort.slug === data.bestSlug)?.score.score ?? null)
	);

	/** Selection is plain links, so the page works without JavaScript and is shareable. */
	function hrefWithSelection(slugs: readonly string[]): string {
		return slugs.length > 0 ? `${comparePath}?compare=${slugs.join(',')}` : comparePath;
	}

	function toggle(slug: string): string {
		const current = [...data.selection];
		const next = current.includes(slug)
			? current.filter((entry) => entry !== slug)
			: current.length >= 4
				? current
				: [...current, slug];
		return hrefWithSelection(next);
	}

	function scoreOf(resort: ResortView): string {
		if (!resort.score.published || resort.score.score === null) return m.cardScoreNotPublished();
		return String(Math.round(resort.score.score));
	}

	function isBest(resort: ResortView): boolean {
		return (
			bestScore !== null &&
			resort.score.score !== null &&
			Math.round(resort.score.score) === Math.round(bestScore)
		);
	}
</script>

<SeoHead seo={data.seo} locale={data.locale} />

<section class="stack" style="--gap: 0.6rem">
	<p class="eyebrow">{m.siteName()}</p>
	<h1>{m.compareHeading()}</h1>
	<p class="lede">{m.compareIntro()}</p>
</section>

<section class="card" style="margin-top: 1.25rem">
	<div class="panel-head">
		<h2>{m.compareSelectTitle()}</h2>
		<span class="chip">
			{m.compareSelectedCount({ count: formatCount(data.selected.length, data.locale) })}
		</span>
	</div>
	<p class="muted">{m.compareSelectHint()}</p>
	<div class="row" style="margin-top:.75rem">
		{#each data.candidates as candidate (candidate.slug)}
			{@const active = data.selection.includes(candidate.slug)}
			<a
				class="btn {active ? 'btn-primary' : ''}"
				href={toggle(candidate.slug)}
				aria-current={active ? 'true' : undefined}
				title={active ? m.cardCompareRemove() : m.cardCompareAdd()}
			>
				{candidate.name}
				{#if candidate.scorePublished && candidate.score !== null}
					<span class="tabular">· {Math.round(candidate.score)}</span>
				{/if}
			</a>
		{/each}
		{#if data.selection.length > 0}
			<a class="btn btn-quiet" href={comparePath}>{m.compareClear()}</a>
		{/if}
	</div>
</section>

{#if data.unavailable}
	<section class="notice notice-warn" role="status" style="margin-top: 1.25rem">
		<h3>{m.unavailableTitle()}</h3>
		<p class="small">{m.unavailableBody()}</p>
	</section>
{:else if !ready}
	<section class="notice" role="status" style="margin-top: 1.25rem">
		<h3>{m.compareEmptyTitle()}</h3>
		<p class="small">{m.compareEmptyBody()}</p>
	</section>
{:else}
	<section class="stack" style="margin-top: 1.5rem">
		<div class="table-wrap">
			<table>
				<caption class="sr-only">{m.compareHeading()}</caption>
				<thead>
					<tr>
						<th scope="col">{m.siteName()}</th>
						{#each data.selected as resort (resort.slug)}
							<th scope="col" class="numeric">
								<a href={localizeHref(`/resort/${resort.slug}`, { locale: data.locale as Locale })}
									>{resort.name}</a
								>
								<div>
									<a class="muted" href={toggle(resort.slug)}>{m.cardCompareRemove()}</a>
								</div>
							</th>
						{/each}
					</tr>
				</thead>

				<tbody>
					<tr>
						<th scope="rowgroup" colspan={data.selected.length + 1}>{m.compareConditionsTitle()}</th
						>
					</tr>
					<tr>
						<th scope="row">{m.compareRowScore()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric {isBest(resort) ? 'best' : ''}">
								{scoreOf(resort)}
								{#if isBest(resort)}
									<span class="chip chip-fresh">{m.compareBestBadge()}</span>
								{/if}
							</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowStatus()}</th>
						{#each data.selected as resort (resort.slug)}
							<td>
								<span class={toneClass(freshnessTone(resort.status.freshness))}>
									{freshnessLabel(resort.status.freshness)}
								</span>
								<div class="small tabular">
									{m.labelOpenPistes()}: {formatCount(
										resort.status.pistes.open,
										data.locale
									)}/{formatCount(resort.status.pistes.total, data.locale)}
								</div>
								<div class="small tabular">
									{m.labelOpenLifts()}: {formatCount(
										resort.status.lifts.open,
										data.locale
									)}/{formatCount(resort.status.lifts.total, data.locale)}
								</div>
							</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowSnowDepth()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric">{formatCm(resort.weather.snow.depthCm, data.locale)}</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowNewSnow24h()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric"
								>{formatCm(resort.weather.snow.recentSnowfall24hCm, data.locale)}</td
							>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowForecastSnow48h()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric"
								>{formatSnowfall(resort.weather.forecastSnowMm48h, data.locale)}</td
							>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowSnowQuality()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric">—</td>
						{/each}
					</tr>

					<tr>
						<th scope="rowgroup" colspan={data.selected.length + 1}>{m.compareWeatherTitle()}</th>
					</tr>
					<tr>
						<th scope="row">{m.compareRowTemperature()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric"
								>{formatTemperature(
									resort.weather.current?.airTemperatureC ?? null,
									data.locale
								)}</td
							>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowWind()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric"
								>{formatWind(resort.weather.current?.windSpeedMs ?? null, data.locale)}</td
							>
						{/each}
					</tr>

					<tr>
						<th scope="rowgroup" colspan={data.selected.length + 1}>{m.compareTerrainTitle()}</th>
					</tr>
					<tr>
						<th scope="row">{m.compareRowPistesTotal()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric">{formatCount(resort.inventory.pistes, data.locale)}</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowLiftsTotal()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric">{formatCount(resort.inventory.lifts, data.locale)}</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowSize()}</th>
						{#each data.selected as resort (resort.slug)}
							<td>{sizeLabel(resort.size)}</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowRegion()}</th>
						{#each data.selected as resort (resort.slug)}
							<td>{resort.region}</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.compareRowCountry()}</th>
						{#each data.selected as resort (resort.slug)}
							<td>{countryName(resort.countryCode, data.locale)}</td>
						{/each}
					</tr>

					<tr>
						<th scope="rowgroup" colspan={data.selected.length + 1}>{m.compareRatingTitle()}</th>
					</tr>
					<tr>
						<th scope="row">{m.compareRowRating()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="numeric">—</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">{m.resortRatingPendingTitle()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="small">{m.resortRatingPendingBody()}</td>
						{/each}
					</tr>

					<tr>
						<th scope="col">{m.compareRowUpdated()}</th>
						{#each data.selected as resort (resort.slug)}
							<td class="small">
								{formatDateTime(resort.lastUpdated, data.locale, resort.countryCode)}
							</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>

		<p class="muted">
			{m.footerUpdatedLabel({
				timestamp: formatDateTime(data.lastUpdated, data.locale, 'FI')
			})}
		</p>
	</section>
{/if}
