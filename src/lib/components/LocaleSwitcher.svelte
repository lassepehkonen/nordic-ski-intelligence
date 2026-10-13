<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	interface AlternateLink {
		locale: string;
		href: string;
		hrefLang: string;
	}

	let { alternates, current }: { alternates: AlternateLink[]; current: string } = $props();

	/** Link labels are the locales' own names, so a visitor can always find their language. */
	function languageName(locale: string): string {
		switch (locale) {
			case 'fi':
				return m.languageNameFi();
			case 'sv':
				return m.languageNameSv();
			case 'no':
				return m.languageNameNo();
			default:
				return m.languageNameEn();
		}
	}

	const items = $derived(alternates.filter((alternate) => alternate.hrefLang !== 'x-default'));
</script>

<nav class="locale-switcher" aria-label={m.languageSelect()}>
	{#each items as alternate (alternate.locale)}
		<a
			href={alternate.href}
			hreflang={alternate.hrefLang}
			lang={alternate.locale}
			title={languageName(alternate.locale)}
			aria-current={alternate.locale === current ? 'true' : undefined}
			data-sveltekit-reload>{alternate.locale.toUpperCase()}</a
		>
	{/each}
</nav>
