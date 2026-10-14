<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { LOCALES, href, localeLabels, type Locale } from '#lib/i18n/ui.js';

	let { current }: { current: Locale } = $props();

	/** Locale switch keeps the visitor on the same page, including the current filters. */
	const target = $derived(page.url.pathname + page.url.search);
</script>

<nav class="lang-switch" aria-label={m.lang_switch_label()}>
	{#each LOCALES as locale (locale)}
		<a
			href={href(target, locale)}
			lang={locale}
			hreflang={locale}
			aria-current={locale === current ? 'true' : undefined}
		>
			{localeLabels[locale]()}
		</a>
	{/each}
</nav>
