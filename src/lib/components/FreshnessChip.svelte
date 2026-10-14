<script lang="ts">
	import type { FreshnessState } from '#lib/domain/types.js';
	import { freshnessLabels } from '#lib/i18n/ui.js';

	let { freshness }: { freshness: FreshnessState } = $props();

	const tone = $derived(
		freshness === 'fresh'
			? 'fresh'
			: freshness === 'invalid'
				? 'invalid'
				: freshness === 'stale'
					? 'warn'
					: undefined
	);
</script>

<span class="chip" data-tone={tone}>{freshnessLabels[freshness]()}</span>
