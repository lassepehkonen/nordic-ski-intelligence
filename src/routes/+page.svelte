<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
	import MapView from '#lib/components/MapView.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import type { ResortView } from '#lib/server/resorts/product-view.js';
	import type { ResortQuery } from '#lib/server/resorts/product-query.js';
	import type { Seo } from '#lib/seo.js';
	import {
		countryName,
		formatCm,
		formatCount,
		formatDateTime,
		formatPercent,
		freshnessLabel,
		freshnessTone,
		scoreTone,
		sizeLabel,
		toneClass
	} from '#lib/i18n/format.js';

	interface HomeData {
		locale: string;
		unavailable: boolean;
		lastUpdated: string | null;
		resorts: ResortView[];
		topResorts: ResortView[];
		query: ResortQuery & { active: boolean };
		bestSlug: string | null;
		freshestSlug: string | null;
		seo: Seo;
	}

	let { data }: { data: HomeData } = $props();

	const homePath = $derived(localizeHref('/', { locale: data.locale as Locale }));
	const best = $derived(data.resorts.find((resort) => resort.slug === data.bestSlug) ?? null);

	function resortHref(slug: string): string {
		return localizeHref(`/resort/${slug}`, { locale: data.locale as Locale });
	}

	function resortsHref(): string {
		// The full card list lives on /resorts; carry the filters over so the two views agree.
		return localizeHref('/resorts', { locale: data.locale as Locale });
	}

	function scorePercent(resort: ResortView): number {
		return resort.score.published && resort.score.score !== null
			? Math.round(resort.score.score)
			: 0;
	}
</script>

<SeoHead seo={data.seo} locale={data.locale} />

<section class="stack" style="--gap: 0.6rem; margin-bottom: 1.5rem">
	<p class="eyebrow">{m.siteName()}</p>
	<h1>{m.heading()}</h1>
	<p class="lede">{m.intro()}</p>
	<p class="muted">
		{m.homeLatestUpdate({ timestamp: formatDateTime(data.lastUpdated, data.locale, 'FI') })}
	</p>
</section>

<form class="card filter-bar" method="get" action={homePath} role="search">
	<label class="field">
		<span>{m.homeSearchLabel()}</span>
		<input
			type="search"
			name="q"
			value={data.query.q}
			placeholder={m.homeSearchPlaceholder()}
			autocomplete="off"
		/>
	</label>

	<label class="field">
		<span>{m.homeCountryLabel()}</span>
		<select name="country">
			<option value="" selected={data.query.country === null}>{m.homeCountryAll()}</option>
			{#each ['FI', 'SE', 'NO'] as code (code)}
				<option value={code} selected={data.query.country === code}
					>{countryName(code, data.locale)}</option
				>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>{m.homeMinScoreLabel()}</span>
		<select name="minScore">
			<option value="" selected={data.query.minScore === null}>{m.homeAnyOption()}</option>
			{#each [40, 60, 75] as option (option)}
				<option value={String(option)} selected={data.query.minScore === option}>{option}</option>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>{m.homeFreshSnowLabel()}</span>
		<select name="freshSnow">
			<option value="" selected={data.query.freshSnow === null}>{m.homeAnyOption()}</option>
			{#each [5, 10, 20] as option (option)}
				<option value={String(option)} selected={data.query.freshSnow === option}
					>{option} {m.unitCm()}</option
				>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>{m.homeOpenTerrainLabel()}</span>
		<select name="openPistes">
			<option value="" selected={data.query.openPistes === null}>{m.homeAnyOption()}</option>
			{#each [25, 50, 75] as option (option)}
				<option value={String(option)} selected={data.query.openPistes === option}
					>{option} {m.unitPercent()}</option
				>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>{m.homeSortLabel()}</span>
		<select name="sort">
			{#each ['score', 'freshSnow', 'snowDepth', 'name'] as option (option)}
				<option value={option} selected={data.query.sort === option}>
					{option === 'score'
						? m.homeSortScore()
						: option === 'freshSnow'
							? m.homeSortFreshSnow()
							: option === 'snowDepth'
								? m.homeSortSnowDepth()
								: m.homeSortName()}
				</option>
			{/each}
		</select>
	</label>

	{#if data.query.compare.length > 0}
		<input type="hidden" name="compare" value={data.query.compare.join(',')} />
	{/if}

	<div class="filter-actions">
		<button class="btn btn-primary" type="submit">{m.homeApplyFilters()}</button>
		<a class="btn btn-quiet" href={homePath}>{m.homeResetFilters()}</a>
	</div>
</form>

<section class="stack" style="margin-top: 1.25rem">
	<div class="panel-head">
		<h2>{m.homeMapTitle()}</h2>
		<p class="muted">{m.homeMapHint()}</p>
	</div>
	<MapView resorts={data.resorts} locale={data.locale} bestSlug={data.bestSlug} />
</section>

{#if data.topResorts.length > 0}
	<section class="stack" style="margin-top: 2rem">
		<div class="between">
			<h2>{m.homeBestTitle()}</h2>
			<a class="btn btn-quiet" href={resortsHref()}>{m.navResorts()}</a>
		</div>
		<p class="muted">{m.homeBestHint()}</p>
		<div class="grid-cards" style="margin-top:.75rem">
			{#each data.topResorts as resort (resort.slug)}
				<article class="card">
					<div class="between">
						<div>
							<p class="eyebrow">
								{countryName(resort.countryCode, data.locale)} · {resort.region}
							</p>
							<h3 style="margin-top:.15rem">
								<a href={resortHref(resort.slug)}>{resort.name}</a>
							</h3>
						</div>
						<span class="chip">{sizeLabel(resort.size)}</span>
					</div>

					<div class="score-row" style="margin-top:.8rem">
						{#if resort.score.published && resort.score.score !== null}
							<div
								class="score-dial"
								style="--score-pct:{scorePercent(resort)}"
								role="img"
								aria-label={`${m.cardScoreLabel()}: ${scorePercent(resort)}`}
							>
								<span class="score-dial-inner">
									<span class="score-dial-value tabular">{scorePercent(resort)}</span>
								</span>
							</div>
							<div class="score-meta">
								<p class="chip">{m.cardScoreLabel()}</p>
								<p class="muted">{m.resortScoreVersion({ version: resort.score.version })}</p>
							</div>
						{:else}
							<div class="score-dial">
								<span class="score-dial-inner">
									<span class="score-dial-out">{m.cardScoreNotPublished()}</span>
								</span>
							</div>
							<div class="score-meta">
								<p class="chip">{m.cardScoreLabel()}</p>
								<p class="muted">{m.resortScoreNotPublishedBody()}</p>
							</div>
						{/if}
					</div>

					<div class="metrics" style="margin-top:.9rem">
						<div class="metric">
							<span class="metric-label">{m.labelSnowDepth()}</span>
							<span class="metric-value tabular"
								>{formatCm(resort.weather.snow.depthCm, data.locale)}</span
							>
						</div>
						<div class="metric">
							<span class="metric-label">{m.labelNewSnow24h()}</span>
							<span class="metric-value tabular"
								>{formatCm(resort.weather.snow.recentSnowfall24hCm, data.locale)}</span
							>
						</div>
						<div class="metric">
							<span class="metric-label">{m.labelOpenPistes()}</span>
							<span class="metric-value tabular"
								>{formatCount(resort.status.pistes.open, data.locale)}<small
									>/ {formatCount(resort.status.pistes.total, data.locale)}</small
								></span
							>
						</div>
					</div>

					<div class="between" style="margin-top:.9rem">
						<div class="row">
							<span class={toneClass(freshnessTone(resort.status.freshness))}>
								{freshnessLabel(resort.status.freshness)}
							</span>
							<span class={toneClass(scoreTone(resort.score.score, resort.score.published))}>
								{formatPercent(resort.terrain.pistesOpenRatio, data.locale)}
							</span>
						</div>
						<a class="btn" href={resortHref(resort.slug)}>{m.cardViewResort()}</a>
					</div>
				</article>
			{/each}
		</div>
	</section>
{/if}
