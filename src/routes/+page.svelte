<script lang="ts">
	import type { PilotProductSnapshot } from '#lib/server/resorts/product-repository.js';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, locales } from '#lib/paraglide/runtime.js';

	type PageData = {
		locale: (typeof locales)[number];
		canonical: string;
		alternates: { locale: string; href: string }[];
		product: PilotProductSnapshot;
		unavailable: boolean;
	};
	let { data }: { data: PageData } = $props();

	const localeTags: Record<(typeof locales)[number], string> = {
		en: 'en-GB',
		fi: 'fi-FI',
		sv: 'sv-SE',
		no: 'nb-NO'
	};
	const timeZones: Record<string, string> = {
		FI: 'Europe/Helsinki',
		SE: 'Europe/Stockholm',
		NO: 'Europe/Oslo'
	};
	function intlLocale(): string {
		return localeTags[data.locale] ?? 'en-GB';
	}

	function count(value: number | null): string {
		return value === null ? '—' : new Intl.NumberFormat(intlLocale()).format(value);
	}

	function formatTime(value: string | null, countryCode: string): string {
		if (!value) return m.notAvailable();
		const date = new Date(value);
		if (!Number.isFinite(date.getTime())) return m.notAvailable();
		return new Intl.DateTimeFormat(intlLocale(), {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: timeZones[countryCode] ?? 'UTC'
		}).format(date);
	}

	function countryName(countryCode: string): string {
		return new Intl.DisplayNames([intlLocale()], { type: 'region' }).of(countryCode) ?? countryCode;
	}

	function sizeLabel(value: string): string {
		if (value === 'small') return m.sizeSmall();
		if (value === 'medium') return m.sizeMedium();
		if (value === 'large') return m.sizeLarge();
		return value;
	}

	function freshnessLabel(value: string): string {
		if (value === 'fresh') return m.freshnessFresh();
		if (value === 'partial') return m.freshnessPartial();
		if (value === 'stale') return m.freshnessStale();
		if (value === 'scheduled') return m.freshnessScheduled();
		return m.freshnessUnavailable();
	}
</script>

<svelte:head>
	<title>{m.pageTitle()}</title>
	<meta name="description" content={m.pageDescription()} />
	<meta name="robots" content="noindex,follow" />
	<link rel="canonical" href={data.canonical} />
	{#each data.alternates as alternate (alternate.locale)}
		<link rel="alternate" hreflang={alternate.locale} href={alternate.href} />
	{/each}
</svelte:head>

<main>
	<header class="page-header">
		<p class="eyebrow">NORDIC SKI INTELLIGENCE</p>
		<h1>{m.heading()}</h1>
		<p class="intro">{m.intro()}</p>
		<nav class="locale-switcher" aria-label={m.languageSelect()}>
			{#each locales as locale (locale)}
				<a
					href={localizeHref('/', { locale })}
					aria-current={data.locale === locale ? 'page' : undefined}
					data-sveltekit-reload>{locale.toUpperCase()}</a
				>
			{/each}
		</nav>
		<a class="api-link" href="/api/pilot">{m.apiLabel()}</a>
	</header>

	{#if data.unavailable}
		<section class="notice" role="status">
			<h2>{m.unavailableTitle()}</h2>
			<p>{m.unavailableBody()}</p>
		</section>
	{:else if data.product.resorts.length === 0}
		<section class="notice" role="status">
			<h2>{m.noResortsTitle()}</h2>
			<p>{m.noResortsBody()}</p>
		</section>
	{:else}
		<p class="resort-count">
			{m.resortCount({ count: count(data.product.resorts.length) })}
		</p>
		<section class="resort-grid" aria-label={m.resortsList()}>
			{#each data.product.resorts as resort (resort.slug)}
				<article class="resort-card">
					<header class="card-header">
						<div>
							<p class="region">{countryName(resort.countryCode)} · {resort.region}</p>
							<h2>{resort.name}</h2>
						</div>
						<span class="size-tag">{sizeLabel(resort.size)}</span>
					</header>

					<section class="counts" aria-label={m.statusSection()}>
						<h3>
							{m.statusSection()}
							<span class="freshness">{freshnessLabel(resort.status.freshness)}</span>
						</h3>
						<div class="count-row">
							<span>{m.lifts()}</span>
							<strong
								>{count(resort.status.lifts.open)}
								<small>/ {count(resort.status.lifts.total)}</small></strong
							>
						</div>
						<div class="count-row">
							<span>{m.pistes()}</span>
							<strong
								>{count(resort.status.pistes.open)}
								<small>/ {count(resort.status.pistes.total)}</small></strong
							>
						</div>
						<p class="muted">
							{m.inventoryTotal({
								lifts: count(resort.inventory.lifts),
								pistes: count(resort.inventory.pistes)
							})}
						</p>
						<p class="muted">
							{m.checkedAt({ timestamp: formatTime(resort.status.checkedAt, resort.countryCode) })}
						</p>
						<p class="muted attribution">{resort.status.attribution}</p>
						<a href={resort.status.sourceUrl} target="_blank" rel="noreferrer">{m.statusSource()}</a
						>
						<p class="muted">
							{m.inventorySource()}: {resort.inventory.attribution} ·
							<a href={resort.inventory.sourceUrl} target="_blank" rel="noreferrer"
								>{m.openSource()}</a
							>
						</p>
						<p class="muted">
							{m.locationSource()}: {resort.location.attribution} ·
							<a href={resort.location.sourceUrl} target="_blank" rel="noreferrer"
								>{m.openSource()}</a
							>
						</p>
					</section>

					<section class="weather" aria-label={m.weatherTitle()}>
						<h3>
							{m.weatherTitle()}
							<span class="freshness">{freshnessLabel(resort.weather.freshness)}</span>
						</h3>
						{#if resort.weather.current}
							<div class="temperature">
								{resort.weather.current.airTemperatureC === null
									? '—'
									: `${count(resort.weather.current.airTemperatureC)} °C`}
								<span>{m.forecastLabel()}</span>
							</div>
							<p class="muted">
								{m.forecastValidAt({
									timestamp: formatTime(resort.weather.current.validAt, resort.countryCode)
								})}
							</p>
							<div class="snow-row">
								<span>{m.wind()}</span>
								<strong
									>{resort.weather.current.windSpeedMs === null
										? '—'
										: `${count(resort.weather.current.windSpeedMs)} m/s`}</strong
								>
							</div>
						{:else}
							<p class="muted">{m.forecastMissing()}</p>
						{/if}
						<div class="snow-row">
							<span>{m.snowDepth()}</span>
							<strong
								>{resort.weather.snow.depthCm === null
									? '—'
									: `${count(resort.weather.snow.depthCm)} cm`}</strong
							>
						</div>
						<div class="snow-row">
							<span>{m.snowfall24h()}</span>
							<strong
								>{resort.weather.snow.recentSnowfall24hCm === null
									? '—'
									: `${count(resort.weather.snow.recentSnowfall24hCm)} cm`}</strong
							>
						</div>
						{#if resort.weather.forecast.length > 0}
							<ul class="forecast" aria-label={m.forecastList()}>
								{#each resort.weather.forecast.slice(0, 4) as point (point.validAt)}
									<li>
										<time
											datetime={point.validAt}
											aria-label={m.forecastTime({
												timestamp: formatTime(point.validAt, resort.countryCode)
											})}>{formatTime(point.validAt, resort.countryCode)}</time
										>
										<span
											>{point.airTemperatureC === null
												? '—'
												: `${count(point.airTemperatureC)} °C`}</span
										>
										<span aria-label={m.precipitation()}
											>{point.precipitationMm === null
												? '—'
												: `${count(point.precipitationMm)} mm`}</span
										>
									</li>
								{/each}
							</ul>
						{/if}
						<p class="muted">
							{m.updatedAt({ timestamp: formatTime(resort.weather.fetchedAt, resort.countryCode) })}
						</p>
						<p class="muted attribution">
							{m.weatherAttribution({ attribution: resort.weather.attribution })}
						</p>
						<a href={resort.weather.sourceUrl} target="_blank" rel="noreferrer"
							>{m.weatherSource()}</a
						>
					</section>
				</article>
			{/each}
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #10171d;
		color: #ecf2f5;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}

	main {
		max-width: 1240px;
		margin: 0 auto;
		padding: 3rem 1.4rem 5rem;
	}

	.page-header {
		max-width: 760px;
		margin: 0 0 2.5rem;
	}

	.eyebrow,
	.region {
		color: #83b8c8;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.35rem 0 0.7rem;
		font-size: clamp(2rem, 5vw, 3.5rem);
		letter-spacing: -0.04em;
	}

	.intro,
	.muted {
		color: #a9bac3;
		line-height: 1.55;
	}

	.api-link,
	a {
		color: #8dd1df;
	}

	.locale-switcher {
		display: flex;
		gap: 0.5rem;
		margin: 1rem 0;
	}

	.locale-switcher a {
		border: 1px solid #38505c;
		border-radius: 0.5rem;
		padding: 0.3rem 0.55rem;
		text-decoration: none;
	}

	.locale-switcher a[aria-current='page'] {
		background: #263740;
		color: #ffffff;
	}

	.resort-count {
		margin: 0 0 1rem;
		color: #a9bac3;
	}

	.resort-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
		gap: 1rem;
	}

	.resort-card,
	.notice {
		border: 1px solid #2a3942;
		border-radius: 16px;
		background: #172128;
		padding: 1.25rem;
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.2rem;
	}

	.card-header h2 {
		margin: 0.3rem 0 0;
		font-size: 1.55rem;
	}

	.region {
		margin: 0;
		letter-spacing: 0.04em;
	}

	.size-tag,
	.freshness {
		border-radius: 999px;
		background: #263740;
		color: #c6d8df;
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.counts,
	.weather {
		border-top: 1px solid #2a3942;
		padding-top: 1rem;
		margin-top: 1rem;
	}

	section h3 {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}

	.count-row,
	.snow-row {
		display: flex;
		justify-content: space-between;
		padding: 0.35rem 0;
	}

	.count-row strong {
		font-size: 1.25rem;
	}

	.count-row small {
		color: #9baeb8;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.muted {
		margin: 0.45rem 0;
		font-size: 0.83rem;
	}

	.temperature {
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
		font-size: 2rem;
		font-weight: 700;
	}

	.temperature span {
		color: #a9bac3;
		font-size: 0.9rem;
		font-weight: 400;
	}

	.forecast {
		list-style: none;
		margin: 0.75rem 0;
		padding: 0;
	}

	.forecast li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.8rem;
		border-top: 1px solid #283840;
		padding: 0.45rem 0;
		font-size: 0.8rem;
	}

	.forecast time {
		color: #a9bac3;
	}

	.notice {
		max-width: 620px;
	}

	@media (max-width: 520px) {
		main {
			padding: 2rem 1rem 3rem;
		}

		.resort-card {
			padding: 1rem;
		}
	}
</style>
