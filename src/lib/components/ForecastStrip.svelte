<script lang="ts">
	import type { ForecastSeries } from '#lib/domain/types.js';
	import { formatDecimal, formatWeekday } from '#lib/i18n/format.js';
	import { currentLocale } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';

	let { forecast }: { forecast: ForecastSeries } = $props();

	const locale = $derived(currentLocale());

	const days = $derived(
		forecast.points.map((point) => ({
			date: point.date,
			weekday: formatWeekday(point.date, locale),
			high: point.tempMaxC === null ? '–' : formatDecimal(point.tempMaxC, locale, 1),
			low: point.tempMinC === null ? '–' : formatDecimal(point.tempMinC, locale, 1),
			snow: point.snowCm === null ? null : formatDecimal(point.snowCm, locale, 1),
			wind: point.windMs === null ? null : formatDecimal(point.windMs, locale, 1)
		}))
	);
</script>

<div class="forecast">
	{#each days as day (day.date)}
		<article class="forecast-day">
			<header>
				<span>{day.weekday}</span>
			</header>
			<p class="temps">{m.resort_forecast_high_low({ high: day.high, low: day.low })}</p>
			{#if day.snow !== null}
				<p class="small muted">{m.resort_forecast_snow({ value: day.snow })}</p>
			{/if}
			{#if day.wind !== null}
				<p class="small muted">{m.resort_forecast_wind({ value: day.wind })}</p>
			{/if}
		</article>
	{/each}
</div>
