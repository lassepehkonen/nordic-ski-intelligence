<script lang="ts">
	import { OG_LOCALES, type Seo } from '#lib/seo.js';

	let { seo, locale }: { seo: Seo; locale: string } = $props();
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	<meta name="robots" content={seo.robots} />
	<link rel="canonical" href={seo.canonical} />
	{#each seo.alternates as alternate (alternate.hrefLang)}
		<link rel="alternate" hreflang={alternate.hrefLang} href={alternate.href} />
	{/each}
	<meta property="og:type" content={seo.type} />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:url" content={seo.canonical} />
	<meta property="og:locale" content={OG_LOCALES[locale] ?? 'en_GB'} />
	<meta property="og:site_name" content="Nordic Ski Intelligence" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	{#if seo.jsonLdTag}
		<!--
			JSON-LD has to reach the document as a script element, and svelte:head cannot emit one
			from data. The value is safe: src/lib/seo.ts escapes every `<` to \u003c, so database
			content can never close the tag.
		-->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html seo.jsonLdTag}
	{/if}
</svelte:head>
