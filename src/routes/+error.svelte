<script lang="ts">
	import { page } from '$app/state';
	import { href } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.error_title()}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="container section stack" style="--gap: 0.75rem">
	<p class="numeric muted">{page.status}</p>
	<h1>{m.error_title()}</h1>
	<p class="muted">{m.error_hint()}</p>
	<p class="cluster" style="--gap: 0.5rem">
		<a class="btn" data-variant="primary" href={href('/')}>{m.nav_home()}</a>
		<a class="btn" href={href('/compare')}>{m.nav_compare()}</a>
	</p>
</div>
