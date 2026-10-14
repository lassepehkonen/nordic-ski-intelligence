<script lang="ts">
	import DataNotice from '#lib/components/DataNotice.svelte';
	import ForecastStrip from '#lib/components/ForecastStrip.svelte';
	import FreshnessChip from '#lib/components/FreshnessChip.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import RatingPanel from '#lib/components/RatingPanel.svelte';
	import ScoreBadge from '#lib/components/ScoreBadge.svelte';
	import ScoreBreakdown from '#lib/components/ScoreBreakdown.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import StatGrid from '#lib/components/StatGrid.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { ratio } from '#lib/domain/selectors.js';
	import { formatDateTime, formatDecimal, formatWholeNumber } from '#lib/i18n/format.js';
	import { formatCount, formatSnowCm, qualityLabel } from '#lib/i18n/metrics.js';
	import { bandLabels, countryLabels, currentLocale, href } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const locale = $derived(currentLocale());
	const resort = $derived(data.resort);
	const metrics = $derived(data.metrics);
	const notReported = m.not_reported();

	const pisteRatio = $derived(ratio(metrics.openPistes, metrics.totalPistes));
	const liftRatio = $derived(ratio(metrics.openLifts, metrics.totalLifts));

	const coordinates = $derived(
		`${formatDecimal(resort.coordinates.lat, locale, 3)}, ${formatDecimal(resort.coordinates.lon, locale, 3)}`
	);

	const snowStats = $derived([
		{
			id: 'snow_depth',
			label: m.metric_snow_depth(),
			value: metrics.snowDepthCm === null ? notReported : formatSnowCm(metrics.snowDepthCm, locale),
			missing: metrics.snowDepthCm === null
		},
		{
			id: 'new_snow_24h',
			label: m.card_new_snow(),
			value:
				metrics.newSnow24hCm === null ? notReported : formatSnowCm(metrics.newSnow24hCm, locale),
			missing: metrics.newSnow24hCm === null
		},
		{
			id: 'new_snow_72h',
			label: m.metric_new_snow_72h(),
			value:
				metrics.newSnow72hCm === null ? notReported : formatSnowCm(metrics.newSnow72hCm, locale),
			missing: metrics.newSnow72hCm === null
		},
		{
			id: 'forecast_snow_72h',
			label: m.metric_forecast_snow_72h(),
			value:
				metrics.forecastSnow72hCm === null
					? notReported
					: formatSnowCm(metrics.forecastSnow72hCm, locale),
			missing: metrics.forecastSnow72hCm === null
		},
		{
			id: 'snow_quality',
			label: m.metric_snow_quality(),
			value: metrics.snowQuality === null ? notReported : qualityLabel(metrics.snowQuality),
			missing: metrics.snowQuality === null
		}
	]);

	const weatherStats = $derived([
		{
			id: 'temperature',
			label: m.metric_temperature(),
			value:
				metrics.temperatureC === null
					? notReported
					: `${formatDecimal(metrics.temperatureC, locale, 1)} °C`,
			missing: metrics.temperatureC === null
		},
		{
			id: 'wind',
			label: m.metric_wind(),
			value:
				metrics.windMs === null ? notReported : `${formatDecimal(metrics.windMs, locale, 1)} m/s`,
			missing: metrics.windMs === null
		},
		{
			id: 'precipitation',
			label: m.metric_precipitation(),
			value:
				metrics.precipitationMm === null
					? notReported
					: `${formatDecimal(metrics.precipitationMm, locale, 1)} mm`,
			missing: metrics.precipitationMm === null
		}
	]);

	const terrainStats = $derived([
		{
			id: 'elevation',
			label: m.resort_fact_elevation(),
			value:
				resort.elevations.baseM !== null && resort.elevations.topM !== null
					? m.resort_fact_elevation_range({
							base: formatCount(resort.elevations.baseM, locale),
							top: formatCount(resort.elevations.topM, locale)
						})
					: notReported,
			missing: resort.elevations.baseM === null || resort.elevations.topM === null
		},
		{
			id: 'vertical',
			label: m.resort_fact_vertical(),
			value:
				resort.elevations.verticalM === null
					? notReported
					: `${formatCount(resort.elevations.verticalM, locale)} m`,
			missing: resort.elevations.verticalM === null
		},
		{
			id: 'pistes',
			label: m.resort_fact_pistes(),
			value:
				resort.terrain.pistes === null ? notReported : formatCount(resort.terrain.pistes, locale),
			missing: resort.terrain.pistes === null
		},
		{
			id: 'piste_km',
			label: m.resort_fact_piste_km(),
			value:
				resort.terrain.pisteKm === null
					? notReported
					: `${formatCount(resort.terrain.pisteKm, locale)} km`,
			missing: resort.terrain.pisteKm === null
		},
		{
			id: 'lifts',
			label: m.resort_fact_lifts(),
			value:
				resort.terrain.lifts === null ? notReported : formatCount(resort.terrain.lifts, locale),
			missing: resort.terrain.lifts === null
		},
		{ id: 'region', label: m.resort_fact_region(), value: data.translation.region, missing: false },
		{
			id: 'country',
			label: m.resort_fact_country(),
			value: countryLabels[resort.country](),
			missing: false
		},
		{ id: 'coordinates', label: m.resort_fact_coordinates(), value: coordinates, missing: false }
	]);
</script>

<SeoHead meta={data.meta} jsonLd={data.jsonLd} />

<div class="container stack" style="--gap: 1.25rem">
	<section class="section stack" style="--gap: 0.6rem">
		<p class="small">
			<a href={href('/')}>← {m.resort_back_link()}</a>
		</p>
		<h1>{data.translation.name}</h1>
		<p class="muted">
			{data.translation.region} · {data.translation.municipality} · {countryLabels[
				resort.country
			]()}
		</p>
		<p class="lede">{data.translation.summary}</p>
		{#if resort.officialSite}
			<p class="small">
				<a href={resort.officialSite} rel="noreferrer noopener" target="_blank"
					>{m.resort_source_official()}</a
				>
			</p>
		{/if}
		<DataNotice dataState={data.conditions.dataState} />
	</section>

	<section class="card hero" aria-labelledby="conditions-heading">
		<h2 id="conditions-heading" class="hero-title">{m.resort_conditions_title()}</h2>
		<div class="hero-score">
			<ScoreBadge score={data.score.score} band={data.score.band} size="lg" showBand={true} />
		</div>
		<dl class="hero-meta">
			<div>
				<dt>{m.last_updated_label()}</dt>
				<dd class="numeric">
					{data.conditions.lastUpdated
						? formatDateTime(data.conditions.lastUpdated, locale)
						: m.last_updated_never()}
				</dd>
			</div>
			<div>
				<dt>{m.score_label()}</dt>
				<dd>
					<FreshnessChip freshness={data.score.freshness} />
				</dd>
			</div>
			{#if data.conditions.station}
				<div>
					<dt>{m.resort_weather_title()}</dt>
					<dd class="small muted">
						{m.resort_weather_station({
							name: data.conditions.station.name,
							distance: formatCount(data.conditions.station.distanceKm, locale)
						})}
					</dd>
				</div>
			{/if}
			<div>
				<dt>
					{m.score_coverage({
						percent: formatWholeNumber(Math.round(data.score.coverage * 100), locale)
					})}
				</dt>
				<dd class="small muted">
					{data.score.version} · {data.score.confidence}
					{#if data.score.partial}
						<span class="chip" data-tone="warn">{m.score_partial()}</span>
					{/if}
				</dd>
			</div>
		</dl>
		{#if data.score.score === null}
			<p>{m.score_na()}</p>
		{:else}
			<p class="visually-hidden">{bandLabels[data.score.band ?? 'poor']()}</p>
		{/if}
	</section>

	<div class="panel-grid">
		<Panel id="score" title={m.resort_score_title()} hint={m.score_explanation_title()}>
			<ScoreBreakdown score={data.score} />
		</Panel>

		<Panel title={m.resort_snow_title()}>
			<StatGrid stats={snowStats} />
		</Panel>

		<Panel title={m.resort_weather_title()}>
			<StatGrid stats={weatherStats} />
		</Panel>

		<Panel title={m.resort_forecast_title()}>
			<ForecastStrip forecast={data.conditions.forecast} />
		</Panel>

		<Panel title={m.resort_pistes_title()}>
			<StatGrid
				stats={[
					{
						id: 'open_pistes',
						label: m.resort_pistes_title(),
						value:
							metrics.openPistes === null || metrics.totalPistes === null
								? notReported
								: m.resort_open_of({
										open: formatCount(metrics.openPistes, locale),
										total: formatCount(metrics.totalPistes, locale)
									}),
						missing: metrics.openPistes === null || metrics.totalPistes === null
					},
					{
						id: 'open_piste_ratio',
						label: m.metric_open_piste_ratio(),
						value:
							pisteRatio === null
								? notReported
								: m.resort_open_ratio({
										percent: formatWholeNumber(Math.round(pisteRatio * 100), locale)
									}),
						missing: pisteRatio === null
					}
				]}
			/>
		</Panel>

		<Panel title={m.resort_lifts_title()}>
			<StatGrid
				stats={[
					{
						id: 'open_lifts',
						label: m.resort_lifts_title(),
						value:
							metrics.openLifts === null || metrics.totalLifts === null
								? notReported
								: m.resort_open_of({
										open: formatCount(metrics.openLifts, locale),
										total: formatCount(metrics.totalLifts, locale)
									}),
						missing: metrics.openLifts === null || metrics.totalLifts === null
					},
					{
						id: 'open_lift_ratio',
						label: m.metric_open_lift_ratio(),
						value:
							liftRatio === null
								? notReported
								: m.resort_open_ratio({
										percent: formatWholeNumber(Math.round(liftRatio * 100), locale)
									}),
						missing: liftRatio === null
					}
				]}
			/>
		</Panel>

		<Panel title={m.resort_rating_title()}>
			<RatingPanel rating={data.rating} />
		</Panel>

		<Panel title={m.resort_facts_title()}>
			<StatGrid stats={terrainStats} />
		</Panel>

		<Panel title={m.resort_sources_title()}>
			<SourceList sources={data.sources} />
		</Panel>
	</div>

	<section class="section cluster" style="--gap: 0.6rem">
		<a class="btn" data-variant="primary" href={data.compareHref}>{m.add_to_compare()}</a>
		<a class="btn" href={href('/compare')}>{m.nav_compare()}</a>
	</section>
</div>
