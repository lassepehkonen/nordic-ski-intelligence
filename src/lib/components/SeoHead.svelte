<script lang="ts">
	import type { PageMeta } from '#lib/seo/meta.js';

	interface Props {
		meta: PageMeta;
		jsonLd?: Record<string, unknown> | null;
	}

	let { meta, jsonLd = null }: Props = $props();

	const structuredData = $derived(
		jsonLd
			? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}${'<' + '/script>'}`
			: null
	);
</script>

<svelte:head>
	<title>{meta.title}</title>
	<meta name="description" content={meta.description} />
	<link rel="canonical" href={meta.canonical} />
	{#each meta.alternates as alternate (alternate.hreflang)}
		<link rel="alternate" hreflang={alternate.hreflang} href={alternate.href} />
	{/each}

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={meta.siteName} />
	<meta property="og:title" content={meta.title} />
	<meta property="og:description" content={meta.description} />
	<meta property="og:url" content={meta.canonical} />
	<meta property="og:locale" content={meta.ogLocale} />
	{#each meta.ogLocaleAlternates as ogLocale (ogLocale)}
		<meta property="og:locale:alternate" content={ogLocale} />
	{/each}

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={meta.title} />
	<meta name="twitter:description" content={meta.description} />

	{#if structuredData}
		<!-- Trusted, build-time JSON-LD for this page: every `<` is escaped before it is written. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html structuredData}
	{/if}
</svelte:head>
