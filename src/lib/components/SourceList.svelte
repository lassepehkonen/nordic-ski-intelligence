<script lang="ts">
	import type { SourceRef } from '#lib/domain/types.js';
	import { formatDate } from '#lib/i18n/format.js';
	import { currentLocale } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';

	let { sources }: { sources: SourceRef[] } = $props();

	const locale = $derived(currentLocale());

	const kindLabels: Record<SourceRef['kind'], () => string> = {
		'operator-site': m.resort_source_official,
		reference: m.resort_source_reference,
		'sample-conditions': m.resort_source_illustrative
	};

	const statusLabels: Record<SourceRef['status'], () => string> = {
		approved: m.resort_source_status_approved,
		rights_pending: m.resort_source_status_pending,
		illustrative: m.resort_source_status_illustrative
	};

	function hostname(url: string): string {
		try {
			return new URL(url).hostname;
		} catch {
			return url;
		}
	}
</script>

<ul class="source-list">
	{#each sources as source (source.id)}
		<li>
			<p class="cluster" style="--gap: 0.5rem">
				<strong>{kindLabels[source.kind]()}</strong>
				<span
					class="chip"
					data-tone={source.status === 'approved'
						? 'fresh'
						: source.status === 'illustrative'
							? undefined
							: 'warn'}>{statusLabels[source.status]()}</span
				>
			</p>
			<p class="small">
				<a href={source.url} rel="noreferrer noopener" target="_blank">{hostname(source.url)}</a>
			</p>
			{#if source.note}
				<p class="small muted">{source.note}</p>
			{/if}
			<p class="meta-row">
				{#if source.license}
					<span>{source.license}</span>
				{/if}
				{#if source.retrievedAt}
					<span>{m.resort_source_verified()}: {formatDate(source.retrievedAt, locale)}</span>
				{/if}
			</p>
		</li>
	{/each}
</ul>
