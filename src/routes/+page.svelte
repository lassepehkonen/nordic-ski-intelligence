<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.site_name()}</title>
	<meta name="description" content={m.home_intro()} />
</svelte:head>

<main>
	<h1>{m.home_title()}</h1>
	<p>{m.home_intro()}</p>
	<p><a href="/api/health">{m.footer_health_link()}</a></p>
</main>
