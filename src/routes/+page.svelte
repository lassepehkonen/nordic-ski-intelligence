<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
	import MapView from '#lib/components/MapView.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import type { ResortView } from '#lib/server/resorts/product-view.js';
	import type { ResortQuery, ResortSort } from '#lib/server/resorts/product-query.js';
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
		query: ResortQuery & { active: boolean };
		bestSlug: string | null;
		freshestSlug: string | null;
		seo: Seo;
	}

	let { data }: { data: HomeData } = $props();

	const MIN_SCORE_OPTIONS = [40, 60, 75] as const;
	const FRESH_SNOW_OPTIONS = [5, 10, 20] as const;
	const OPEN_PISTE_OPTIONS = [25, 50, 75] as const;
	const SORT_OPTIONS: { value: ResortSort; label: () => string }[] = [
		{ value: 'score', label: () => m.homeSortScore() },
		{ value: 'freshSnow', label: () => m.homeSortFreshSnow() },
		{ value: 'snowDepth', label: () => m.homeSortSnowDepth() },
		{ value: 'name', label: () => m.homeSortName() }
	];

	const homePath = $derived(localizeHref('/', { locale: data.locale as Locale }));
	const best = $derived(data.resorts.find((resort) => resort.slug === data.bestSlug) ?? null);
	const freshest = $derived(
		data.resorts.find((resort) => resort.slug === data.freshestSlug) ?? null
	);

	function resortHref(slug: string): string {
		return localizeHref(`/resort/${slug}`, { locale: data.locale as Locale });
	}

	/** Rebuilds the current filter state with a different comparison selection. */
	function hrefWithCompare(compare: readonly string[]): string {
		const parts: string[] = [];
		const add = (key: string, value: string) => parts.push(`${key}=${encodeURIComponent(value)}`);

		if (data.query.q) add('q', data.query.q);
		if (data.query.country) add('country', data.query.country);
		if (data.query.minScore !== null) add('minScore', String(data.query.minScore));
		if (data.query.freshSnow !== null) add('freshSnow', String(data.query.freshSnow));
		if (data.query.openPistes !== null) add('openPistes', String(data.query.openPistes));
		if (data.query.sort !== 'score') add('sort', data.query.sort);
		if (compare.length > 0) add('compare', compare.join(','));

		return parts.length > 0 ? `${homePath}?${parts.join('&')}` : homePath;
	}

	function toggleCompare(slug: string): string {
		const current = [...data.query.compare];
		const next = current.includes(slug)
			? current.filter((entry) => entry !== slug)
			: current.length >= 4
				? current
				: [...current, slug];
		return hrefWithCompare(next);
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
			{#each MIN_SCORE_OPTIONS as option (option)}
				<option value={String(option)} selected={data.query.minScore === option}>{option}</option>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>{m.homeFreshSnowLabel()}</span>
		<select name="freshSnow">
			<option value="" selected={data.query.freshSnow === null}>{m.homeAnyOption()}</option>
			{#each FRESH_SNOW_OPTIONS as option (option)}
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
			{#each OPEN_PISTE_OPTIONS as option (option)}
				<option value={String(option)} selected={data.query.openPistes === option}
					>{option} {m.unitPercent()}</option
				>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>{m.homeSortLabel()}</span>
		<select name="sort">
			{#each SORT_OPTIONS as option (option.value)}
				<option value={option.value} selected={data.query.sort === option.value}
					>{option.label()}</option
				>
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

<section class="split split-wide" style="margin-top: 1.25rem">
	<div class="stack">
		<div class="panel-head">
			<h2>{m.homeMapTitle()}</h2>
			<p class="muted">{m.homeMapHint()}</p>
		</div>
		<MapView resorts={data.resorts} locale={data.locale} bestSlug={data.bestSlug} />
	</div>

	<div class="stack">
		{#if best}
			<article class="card">
				<p class="eyebrow">{m.homeBestTitle()}</p>
				<h3 style="margin-top:.2rem">
					<a href={resortHref(best.slug)}>{best.name}</a>
				</h3>
				<p class="muted">
					{countryName(best.countryCode, data.locale)} · {best.region}
				</p>
				<div class="score-row" style="margin-top:.75rem">
					<div
						class="score-dial"
						style="--score-pct:{scorePercent(best)}"
						role="img"
						aria-label={`${m.cardScoreLabel()}: ${scorePercent(best)}`}
					>
						<span class="score-dial-inner">
							<span class="score-dial-value tabular">{scorePercent(best)}</span>
						</span>
					</div>
					<div class="score-meta">
						<p class="muted">
							{m.resortScoreCoverage({
								percent: formatCount(
									Math.round(best.score.coverage.availableWeightShare * 100),
									data.locale
								)
							})}
						</p>
						<p class="muted">{m.homeBestHint()}</p>
					</div>
				</div>
			</article>
		{/if}

		{#if freshest}
			<article class="card">
				<p class="eyebrow">{m.homeFreshTitle()}</p>
				<h3 style="margin-top:.2rem">
					<a href={resortHref(freshest.slug)}>{freshest.name}</a>
				</h3>
				<p class="metric-value" style="margin-top:.4rem">
					{formatCm(freshest.weather.snow.recentSnowfall24hCm, data.locale)}
				</p>
				<p class="muted">{m.labelNewSnow24h()} · {m.homeFreshHint()}</p>
			</article>
		{/if}
	</div>
</section>

<section class="stack" style="margin-top: 2rem">
	<div class="between">
		<h2>{m.homeListTitle()}</h2>
		<div class="row">
			<p class="muted">
				{m.homeResultsCount({ count: formatCount(data.resorts.length, data.locale) })}
			</p>
			{#if data.query.active}
				<a class="chip" href={homePath}>{m.homeResetFilters()}</a>
			{/if}
			{#if data.query.compare.length >= 2}
				<a class="btn" href={localizeHref('/compare', { locale: data.locale as Locale })}>
					{m.navCompare()} ({data.query.compare.length})
				</a>
			{/if}
		</div>
	</div>

	{#if data.unavailable}
		<section class="notice notice-warn" role="status">
			<h3>{m.unavailableTitle()}</h3>
			<p class="small">{m.unavailableBody()}</p>
		</section>
	{:else if data.resorts.length === 0}
		<section class="notice" role="status">
			<h3>{m.homeNoResultsTitle()}</h3>
			<p class="small">{m.homeNoResultsBody()}</p>
			<p><a href={homePath}>{m.homeResetFilters()}</a></p>
		</section>
	{:else}
		<div class="grid-cards">
			{#each data.resorts as resort (resort.slug)}
				{@const inCompare = data.query.compare.includes(resort.slug)}
				<article class="card" class:is-selected={inCompare}>
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
								<p class="muted">
									{m.resortScoreCoverage({
										percent: formatCount(
											Math.round(resort.score.coverage.availableWeightShare * 100),
											data.locale
										)
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
								<p class="chip">{m.cardScoreLabel()}</p>
								<p class="muted">{m.resortScoreNotPublishedBody()}</p>
							</div>
						{/if}
					</div>

					<div class="metrics" style="margin-top:.9rem">
						<div class="metric">
							<span class="metric-label">{m.labelOpenPistes()}</span>
							<span class="metric-value tabular"
								>{formatCount(resort.status.pistes.open, data.locale)}<small
									>/ {formatCount(resort.status.pistes.total, data.locale)}</small
								></span
							>
						</div>
						<div class="metric">
							<span class="metric-label">{m.labelOpenLifts()}</span>
							<span class="metric-value tabular"
								>{formatCount(resort.status.lifts.open, data.locale)}<small
									>/ {formatCount(resort.status.lifts.total, data.locale)}</small
								></span
							>
						</div>
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
						<div class="row">
							<a class="btn btn-quiet" href={toggleCompare(resort.slug)}>
								{inCompare ? m.cardCompareRemove() : m.cardCompareAdd()}
							</a>
							<a class="btn" href={resortHref(resort.slug)}>{m.cardViewResort()}</a>
						</div>
					</div>

					<p class="muted" style="margin-top:.6rem">
						{m.resortLastUpdated({
							timestamp: formatDateTime(resort.lastUpdated, data.locale, resort.countryCode)
						})}
					</p>
				</article>
			{/each}
		</div>
	{/if}
</section>
