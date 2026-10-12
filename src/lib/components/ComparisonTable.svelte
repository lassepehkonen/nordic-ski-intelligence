<script lang="ts">
	import type { ComparisonRow, ComparisonSection } from '#lib/domain/selectors.js';
	import {
		formatCount,
		formatElevation,
		formatRatio,
		formatSnowCm,
		formatTemperature,
		formatWind
	} from '#lib/i18n/metrics.js';
	import { comparisonRowLabel, currentLocale } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';

	export interface ComparisonColumn {
		id: string;
		name: string;
		href: string;
	}

	interface Props {
		columns: ComparisonColumn[];
		sections: ComparisonSection[];
	}

	let { columns, sections }: Props = $props();

	const locale = $derived(currentLocale());

	const sectionLabels: Readonly<Record<string, () => string>> = {
		compare_section_conditions: m.compare_section_conditions,
		compare_section_rating: m.compare_section_rating,
		compare_section_weather: m.compare_section_weather,
		compare_section_terrain: m.compare_section_terrain
	};

	function formatValue(
		row: Extract<ComparisonRow, { kind: 'number' }>,
		value: number | null
	): string {
		if (value === null) return '–';
		switch (row.unit) {
			case 'cm':
				return formatSnowCm(value, locale);
			case 'm':
				return formatElevation(value, locale);
			case 'km':
				return `${formatCount(value, locale)} km`;
			case 'c':
				return formatTemperature(value, locale);
			case 'ms':
				return formatWind(value, locale);
			case 'ratio':
				return formatRatio(value, locale);
			default:
				return formatCount(value, locale);
		}
	}
</script>

<div class="table-wrap">
	<table class="compare">
		<caption class="visually-hidden">{m.compare_title()}</caption>
		<thead>
			<tr>
				<th scope="col">{m.compare_title()}</th>
				{#each columns as column (column.id)}
					<th scope="col"><a href={column.href}>{column.name}</a></th>
				{/each}
			</tr>
		</thead>

		{#each sections as section (section.id)}
			<tbody>
				<tr class="section-row">
					<th scope="colgroup" colspan={columns.length + 1}
						>{sectionLabels[section.titleKey]?.() ?? section.titleKey}</th
					>
				</tr>
				{#each section.rows as row (row.id)}
					<tr>
						<th scope="row">{comparisonRowLabel(row.labelKey)}</th>
						{#each row.values as value, index (index)}
							{#if row.kind === 'number'}
								<td data-best={row.bestIndex === index ? 'true' : undefined} class="numeric">
									{formatValue(row, value as number | null)}
									{#if row.bestIndex === index}
										<span class="visually-hidden">{m.compare_best_chip()}</span>
									{/if}
								</td>
							{:else}
								<td>{(value as string) || m.not_reported()}</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>
</div>

<style>
	.section-row th {
		background: var(--bg-elevated);
		font-size: var(--step--1);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-3);
	}
</style>
