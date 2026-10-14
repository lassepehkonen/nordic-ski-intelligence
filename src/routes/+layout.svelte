<script lang="ts">
	import '#lib/styles/app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
	import LocaleSwitcher from '#lib/components/LocaleSwitcher.svelte';
	import { formatLocaleDateTime } from '#lib/i18n/format.js';
	import type { Seo } from '#lib/seo.js';

	let { children }: { children: Snippet } = $props();

	const data = $derived(
		page.data as {
			locale?: string;
			seo?: Seo;
			lastUpdated?: string | null;
		}
	);
	const locale = $derived(data.locale ?? 'en');
	const seo = $derived(data.seo ?? null);
	const routeId = $derived(page.route.id ?? '/');
	const isMap = $derived(routeId === '/');
	const isResorts = $derived(routeId === '/resorts');
	const isCompare = $derived(routeId === '/compare');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#f3f6f7" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#0f1517" media="(prefers-color-scheme: dark)" />
</svelte:head>

<a class="skip-link" href="#main">{m.skipToContent()}</a>

<div class="shell">
	<header class="site-header">
		<div class="container site-header-inner">
			<a class="brand" href={localizeHref('/', { locale: locale as Locale })}>
				<svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
					<path d="M12 1.5 3 21h4.2l4.8-10.2L16.8 21H21L12 1.5Z" fill="currentColor" />
					<path d="M1.5 22.5h21" stroke="currentColor" stroke-width="1.6" opacity="0.5" />
				</svg>
				<span>{m.siteName()}</span>
			</a>

			<nav class="site-nav" aria-label={m.siteName()}>
				<a
					href={localizeHref('/', { locale: locale as Locale })}
					aria-current={isMap ? 'page' : undefined}>{m.navMap()}</a
				>
				<a
					href={localizeHref('/resorts', { locale: locale as Locale })}
					aria-current={isResorts ? 'page' : undefined}>{m.navResorts()}</a
				>
				<a
					href={localizeHref('/compare', { locale: locale as Locale })}
					aria-current={isCompare ? 'page' : undefined}>{m.navCompare()}</a
				>
				<a href="/api/v1/resorts">{m.navApi()}</a>
			</nav>

			{#if seo}
				<LocaleSwitcher alternates={seo.alternates} current={locale} />
			{/if}
		</div>
	</header>

	<main id="main" class="container">
		{@render children()}
	</main>

	<footer class="site-footer">
		<div class="container stack">
			<section class="notice" aria-labelledby="data-notice-title">
				<h3 id="data-notice-title">{m.dataNoticeTitle()}</h3>
				<p class="small">{m.dataNoticeBody()}</p>
			</section>
			<p class="muted">{m.footerSourcesNote()}</p>
			<p class="muted">{m.footerSafetyNote()}</p>
			<div class="between">
				<p class="muted">
					{m.footerUpdatedLabel({
						timestamp: formatLocaleDateTime(data.lastUpdated ?? null, locale)
					})}
				</p>
				<nav class="footer-links" aria-label={m.siteName()}>
					<a href="/api/v1/resorts">{m.navApi()}</a>
					<a href="/sitemap.xml">sitemap.xml</a>
				</nav>
			</div>
		</div>
	</footer>
</div>
