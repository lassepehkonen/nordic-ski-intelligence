<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { LOCALES, currentLocale, href, localeLabels } from '#lib/i18n/ui.js';

	const locale = $derived(currentLocale());
</script>

<footer class="site-footer">
	<div class="container stack" style="--gap: 1.5rem">
		<div class="footer-grid">
			<section>
				<h2>{m.footer_navigation()}</h2>
				<ul class="stack" style="--gap: 0.35rem">
					<li><a href={href('/')}>{m.nav_home()}</a></li>
					<li><a href={href('/resorts')}>{m.list_title()}</a></li>
					<li><a href={href('/compare')}>{m.nav_compare()}</a></li>
					<li><a href="/api/health">{m.footer_health_link()}</a></li>
				</ul>
			</section>

			<section>
				<h2>{m.footer_languages()}</h2>
				<ul class="stack" style="--gap: 0.35rem">
					{#each LOCALES as code (code)}
						<li>
							<a href={href('/', code)} hreflang={code} lang={code}>{localeLabels[code]()}</a>
						</li>
					{/each}
				</ul>
			</section>

			<section>
				<h2>{m.footer_sources()}</h2>
				<p class="small muted">{m.footer_notice()}</p>
			</section>
		</div>

		<p class="small muted">{m.footer_disclaimer()}</p>

		<p class="small muted">
			{m.site_name()} · <span class="numeric">{new Date().getFullYear()}</span> ·
			{localeLabels[locale]()}
		</p>
	</div>
</footer>
