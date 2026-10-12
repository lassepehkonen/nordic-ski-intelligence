<script lang="ts">
	import type { DataState } from '#lib/domain/types.js';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		dataState: DataState;
		compact?: boolean;
	}

	let { dataState, compact = false }: Props = $props();
</script>

{#if dataState === 'illustrative'}
	<aside class="notice" role="note">
		<p class="cluster" style="--gap: 0.5rem">
			<span class="chip" data-tone="warn">{m.sample_chip()}</span>
			<strong>{m.data_notice_title()}</strong>
		</p>
		<p class="small muted">{compact ? m.data_notice_short_body() : m.data_notice_body()}</p>
	</aside>
{/if}
