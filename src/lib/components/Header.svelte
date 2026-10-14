<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { canonicalPath, currentLocale, href } from '#lib/i18n/ui.js';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	const locale = $derived(currentLocale());
	const path = $derived(canonicalPath(page.url.pathname));

	const navItems = $derived([
		{ href: href('/'), label: m.nav_home(), current: path === '/' },
		{ href: href('/resorts'), label: m.list_title(), current: path === '/resorts' },
		{ href: href('/compare'), label: m.nav_compare(), current: path === '/compare' }
	]);
</script>

<header class="site-header">
	<div class="container bar">
		<a class="brand" href={href('/')}>
			<strong>{m.site_name()}</strong>
			<span class="brand-tagline">{m.site_tagline()}</span>
		</a>

		<nav class="nav" aria-label={m.footer_navigation()}>
			{#each navItems as item (item.href)}
				<a href={item.href} aria-current={item.current ? 'page' : undefined}>{item.label}</a>
			{/each}
		</nav>

		<LanguageSwitcher current={locale} />
	</div>
</header>

<style>
	@media (max-width: 52rem) {
		.brand span {
			display: none;
		}
	}
</style>
