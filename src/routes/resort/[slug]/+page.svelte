<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import ScoreBadge from '#lib/components/ScoreBadge.svelte';
	import type { ConditionsScoreView, ResortView } from '#lib/server/resorts/product-view.js';
	import type { Seo } from '#lib/seo.js';
	import {
		componentLabel,
		componentStatusLabel,
		componentStatusTone,
		countryName,
		formatCm,
		formatCount,
		formatDate,
		formatDateTime,
		formatDecimal,
		formatHour,
		formatPercent,
		formatPrecipitation,
		formatSnowfall,
		formatTemperature,
		formatWeekday,
		formatWind,
		freshnessLabel,
		freshnessTone,
		reasonLabel,
		ratingCategoryLabel,
		scoreTone,
		sizeLabel,
		toneClass
	} from '#lib/i18n/format.js';

	interface ResortData {
		locale: string;
		resort: ResortView | null;
		seo: Seo;
	}

	let { data }: { data: ResortData } = $props();

	const resort = $derived(data.resort);
	const country = $derived(resort?.countryCode ?? 'FI');
	const locale = $derived(data.locale);

	/** Raw component values keep their own unit; the scoring layer stores SI-ish numbers. */
	function formatRaw(component: ConditionsScoreView['components'][number]): string {
		const raw = component.raw;
		if (raw === null || raw === undefined) return '—';
		if (typeof raw === 'string') return raw;
		switch (component.id) {
			case 'snow_depth':
			case 'recent_snow':
				return formatCm(raw, locale);
			case 'forecast_snow':
				return formatSnowfall(raw, locale);
			case 'terrain_open_ratio':
			case 'lifts_open_ratio':
				return formatPercent(raw, locale);
			case 'temperature':
				return formatTemperature(raw, locale);
			case 'wind':
				return formatWind(raw, locale);
			default:
				return formatDecimal(raw, locale, 1);
		}
	}

	function sourceLabel(kind: string): string {
		switch (kind) {
			case 'location':
				return m.labelLocation();
			case 'inventory':
				return m.labelInventoryPistes();
			case 'status':
				return m.labelStatus();
			case 'weather':
				return m.labelWeatherProvider();
			default:
				return m.labelSnowDepth();
		}
	}

	const forecastRows = $derived(resort?.weather.forecastDaily ?? []);
</script>

<SeoHead seo={data.seo} locale={data.locale} />

{#if !resort}
	<section class="stack">
		<p><a href={localizeHref('/', { locale: locale as Locale })}>{m.resortBackToMap()}</a></p>
		<section class="notice notice-warn" role="status">
			<h1>{m.unavailableTitle()}</h1>
			<p>{m.unavailableBody()}</p>
		</section>
	</section>
{:else}
	<section class="stack" style="--gap: 0.6rem">
		<p>
			<a href={localizeHref('/', { locale: locale as Locale })}>{m.resortBackToMap()}</a>
		</p>
		<p class="eyebrow">{countryName(resort.countryCode, data.locale)} · {resort.region}</p>
		<h1>{resort.name}</h1>
		<div class="row">
			<span class="chip">{sizeLabel(resort.size)}</span>
			<span class={toneClass(freshnessTone(resort.status.freshness))}>
				{m.statusSection()}: {freshnessLabel(resort.status.freshness)}
			</span>
			<span class={toneClass(freshnessTone(resort.weather.freshness))}>
				{m.resortWeatherTitle()}: {freshnessLabel(resort.weather.freshness)}
			</span>
			<span class={toneClass(scoreTone(resort.score.score, resort.score.published))}>
				{m.cardScoreLabel()}
			</span>
		</div>
		<p class="muted">
			{m.resortLastUpdated({
				timestamp: formatDateTime(resort.lastUpdated, data.locale, resort.countryCode)
			})}
		</p>
	</section>

	<section class="split" style="margin-top: 1.5rem">
		<article class="card">
			<div class="panel-head">
				<h2>{m.resortScoreTitle()}</h2>
				<span class="chip">{m.resortScoreVersion({ version: resort.score.version })}</span>
			</div>
			<ScoreBadge score={resort.score} locale={data.locale} countryCode={resort.countryCode} />
			{#if resort.score.outOfRangeComponentIds.length > 0}
				<p class="small" style="margin-top:.6rem">{m.resortScoreOutOfRangeBlocked()}</p>
			{/if}
		</article>

		<article class="card">
			<div class="panel-head">
				<h2>{m.resortSnowTitle()}</h2>
				<span class={toneClass(freshnessTone(resort.weather.freshness))}>
					{freshnessLabel(resort.weather.freshness)}
				</span>
			</div>
			<div class="metrics">
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
					<span class="metric-label">{m.labelForecastSnow48h()}</span>
					<span class="metric-value tabular"
						>{formatSnowfall(resort.weather.forecastSnowMm48h, data.locale)}</span
					>
				</div>
				<div class="metric">
						<span class="metric-label">{m.labelSnowQuality()}</span>
						<span class="metric-value">
							{#if resort.weather.snow.quality}
							{@const q = resort.weather.snow.quality}
							{@const qualityLabel = ({
								'fresh-powder': m.snowQualityFreshPowder(),
								'dry-preserved': m.snowQualityDryPreserved(),
								'moist-settled': m.snowQualityMoistSettled(),
								'crusted': m.snowQualityCrusted(),
								'no-snow': m.snowQualityNoSnow()
							} as Record<string, string>)[q.label] ?? q.label}
							<span class="chip" class:chip-fresh={q.label === 'fresh-powder'}
								class:chip-warn={q.label === 'moist-settled' || q.label === 'crusted'}>
								{qualityLabel} {q.score}
							</span>
						{:else}
								<span>—</span>
							{/if}
						</span>
					</div>
			</div>
			<p class="muted" style="margin-top:.6rem">
				{m.labelSource()}:
				{#if resort.weather.snow.sourceUrl}
					<a href={resort.weather.snow.sourceUrl} target="_blank" rel="noreferrer"
						>{m.weatherSource()}</a
					>
				{:else}
					{m.notAvailable()}
				{/if}
			</p>
		</article>
	</section>

	<section class="split" style="margin-top: 1.25rem">
		<article class="card">
			<div class="panel-head">
				<h2>{m.resortLiftsTitle()} · {m.resortPistesTitle()}</h2>
			</div>
			<div class="metrics">
				<div class="metric">
					<span class="metric-label">{m.labelOpenLifts()}</span>
					<span class="metric-value tabular"
						>{formatCount(resort.status.lifts.open, data.locale)}<small
							>/ {formatCount(resort.status.lifts.total, data.locale)}</small
						></span
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
				<div class="metric">
					<span class="metric-label">{m.labelInventoryLifts()}</span>
					<span class="metric-value tabular"
						>{formatCount(resort.inventory.lifts, data.locale)}</span
					>
				</div>
				<div class="metric">
					<span class="metric-label">{m.labelInventoryPistes()}</span>
					<span class="metric-value tabular"
						>{formatCount(resort.inventory.pistes, data.locale)}</span
					>
				</div>
			</div>
			<p class="muted" style="margin-top:.6rem">
				{m.checkedAt({
					timestamp: formatDateTime(resort.status.checkedAt, data.locale, resort.countryCode)
				})}
				· <a href={resort.status.sourceUrl} target="_blank" rel="noreferrer">{m.statusSource()}</a>
			</p>
			<p class="muted">{m.labelAttribution()}: {resort.status.attribution}</p>
		</article>

		<article class="card">
			<div class="panel-head">
				<h2>{m.resortWeatherTitle()}</h2>
				{#if resort.weather.sourceUpdatedAt}
					<span class="muted">
						{m.labelValidAt({
							timestamp: formatDateTime(
								resort.weather.sourceUpdatedAt,
								data.locale,
								resort.countryCode
							)
						})}
					</span>
				{/if}
			</div>
			{#if resort.weather.current}
				<div class="metrics">
					<div class="metric">
						<span class="metric-label">{m.labelTemperature()}</span>
						<span class="metric-value tabular"
							>{formatTemperature(resort.weather.current.airTemperatureC, data.locale)}</span
						>
					</div>
					<div class="metric">
						<span class="metric-label">{m.labelWind()}</span>
						<span class="metric-value tabular"
							>{formatWind(resort.weather.current.windSpeedMs, data.locale)}</span
						>
					</div>
					<div class="metric">
						<span class="metric-label">{m.labelPrecipitation()}</span>
						<span class="metric-value tabular"
							>{formatPrecipitation(resort.weather.current.precipitationMm, data.locale)}</span
						>
					</div>
					<div class="metric">
						<span class="metric-label">{m.labelSnowfall()}</span>
						<span class="metric-value tabular"
							>{formatSnowfall(resort.weather.current.snowfallMm, data.locale)}</span
						>
					</div>
				</div>
				<p class="muted" style="margin-top:.6rem">
					{m.forecastValidAt({
						timestamp: formatDateTime(
							resort.weather.current.validAt,
							data.locale,
							resort.countryCode
						)
					})}
				</p>
			{:else}
				<p class="small">{m.forecastMissing()}</p>
			{/if}
			<p class="muted">
				{m.updatedAt({
					timestamp: formatDateTime(resort.weather.fetchedAt, data.locale, resort.countryCode)
				})}
				· {m.weatherAttribution({ attribution: resort.weather.attribution })}
				·
				<a href={resort.weather.sourceUrl} target="_blank" rel="noreferrer">{m.weatherSource()}</a>
			</p>
		</article>
	</section>

	{#if forecastRows.length > 0}
		<article class="card" style="margin-top: 1.25rem">
			<div class="panel-head">
				<h2>{m.resortForecastTitle()}</h2>
				<span class="muted">{m.forecastList()}</span>
			</div>
			<div class="table-wrap">
				<table>
					<caption class="sr-only">{m.resortForecastTitle()}</caption>
					<thead>
						<tr>
							<th scope="col">{m.forecastLabel()}</th>
							<th scope="col" class="numeric">{m.labelTemperature()}</th>
							<th scope="col" class="numeric">{m.labelPrecipitation()}</th>
							<th scope="col" class="numeric">{m.labelSnowfall()}</th>
							<th scope="col" class="numeric">{m.labelWind()}</th>
							<th scope="col" class="numeric">{m.labelWindDirection()}</th>
						</tr>
					</thead>
					<tbody>
						{#each forecastRows as day, dayIndex (day.date)}
							<tr>
								<th scope="row">
									<time datetime={day.date}>
										{formatWeekday(day.date + 'T12:00:00', data.locale, resort.countryCode)}
										{formatDate(day.date + 'T12:00:00', data.locale, resort.countryCode)}
										{#if dayIndex === 0}<span class="chip chip-today">{m.forecastToday()}</span
											>{/if}
									</time>
								</th>
								<td class="numeric">
									{day.tempMinC === null || day.tempMaxC === null
										? m.notAvailable()
										: `${formatTemperature(day.tempMinC, data.locale)} … ${formatTemperature(day.tempMaxC, data.locale)}`}
								</td>
								<td class="numeric">{formatPrecipitation(day.precipitationMm, data.locale)}</td>
								<td class="numeric">{formatSnowfall(day.snowfallMm, data.locale)}</td>
								<td class="numeric">{formatWind(day.windMaxMs, data.locale)}</td>
								<td class="numeric">{day.windDirectionPoints ?? m.notAvailable()}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</article>
	{/if}

	<section class="split" style="margin-top: 1.25rem">
		<article class="card">
			<div class="panel-head">
				<h2>{m.resortScoreComponentsTitle()}</h2>
				<span class="muted">
					{m.resortScoreCoverage({
						percent: formatCount(
							Math.round(resort.score.coverage.availableWeightShare * 100),
							data.locale
						)
					})}
				</span>
			</div>
			<div class="table-wrap">
				<table>
					<caption class="sr-only">{m.resortScoreComponentsTitle()}</caption>
					<thead>
						<tr>
							<th scope="col">{m.resortScoreTitle()}</th>
							<th scope="col" class="numeric">{m.labelWeight()}</th>
							<th scope="col" class="numeric">{m.labelSource()}</th>
							<th scope="col" class="numeric">{m.labelPoints()}</th>
							<th scope="col">{m.labelStatus()}</th>
						</tr>
					</thead>
					<tbody>
						{#each resort.score.components as component (component.id)}
							<tr>
								<th scope="row">{componentLabel(component.id)}</th>
								<td class="numeric tabular"
									>{formatCount(Math.round(component.weight * 100), data.locale)}
									{m.unitPercent()}</td
								>
								<td class="numeric tabular">{formatRaw(component)}</td>
								<td class="numeric tabular">
									{component.points === null ? '—' : component.points}
								</td>
								<td>
									<span class={toneClass(componentStatusTone(component.status))}>
										{componentStatusLabel(component.status)}
									</span>
									{#if component.reasonKeys.length > 0}
										<ul class="reason-list">
											{#each component.reasonKeys as key (key)}
												<li>{reasonLabel(key)}</li>
											{/each}
										</ul>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="muted" style="margin-top:.6rem">
				{m.resortScoreComputedAt({
					timestamp: formatDateTime(resort.score.computedAt, data.locale, resort.countryCode)
				})}
			</p>
		</article>

		<article class="card">
			<div class="panel-head">
				<h2>{m.resortRatingTitle()}</h2>
				<span class="muted">{m.resortScoreVersion({ version: resort.rating.version })}</span>
			</div>
			<p class="small">{m.resortRatingPendingTitle()}</p>
			<p class="muted">{m.resortRatingPendingBody()}</p>
			<ul class="list" style="margin-top:.8rem">
				{#each resort.rating.categories as category (category.id)}
					<li class="list-row">
						<span>{ratingCategoryLabel(category.id)}</span>
						<span class="muted">
							{m.resortRatingWeight({
								weight: formatCount(Math.round(category.weight * 100), data.locale)
							})}
						</span>
					</li>
				{/each}
			</ul>
		</article>
	</section>

	<section class="split" style="margin-top: 1.25rem">
		<article class="card">
			<div class="panel-head">
				<h2>{m.resortTerrainTitle()}</h2>
			</div>
			<div class="metrics">
				<div class="metric">
					<span class="metric-label">{m.labelOpenPistes()}</span>
					<span class="metric-value tabular"
						>{formatPercent(resort.terrain.pistesOpenRatio, data.locale)}</span
					>
				</div>
				<div class="metric">
					<span class="metric-label">{m.labelOpenLifts()}</span>
					<span class="metric-value tabular"
						>{formatPercent(resort.terrain.liftsOpenRatio, data.locale)}</span
					>
				</div>
				<div class="metric">
					<span class="metric-label">{m.labelRegion()}</span>
					<span class="metric-value" style="font-size:1rem">{resort.region}</span>
				</div>
				<div class="metric">
					<span class="metric-label">{m.labelCountry()}</span>
					<span class="metric-value" style="font-size:1rem"
						>{countryName(resort.countryCode, data.locale)}</span
					>
				</div>
			</div>
		</article>

		<article class="card">
			<div class="panel-head">
				<h2>{m.resortSourcesTitle()}</h2>
			</div>
			<ul class="list">
				{#each resort.sources as source (source.kind + source.url)}
					<li class="list-row">
						<span>{sourceLabel(source.kind)}</span>
						<span class="small">
							<a href={source.url} target="_blank" rel="noreferrer">{m.openSource()}</a>
						</span>
					</li>
					<li class="muted" style="margin-bottom:.35rem">{source.attribution}</li>
				{/each}
			</ul>
			<p class="muted">
				{m.resortCheckAt({
					timestamp: formatDateTime(
						resort.status.checkedAt ?? resort.weather.fetchedAt,
						data.locale,
						country
					)
				})}
			</p>
		</article>
	</section>
{/if}
