<script lang="ts">
	import { goto } from '$app/navigation';
	import { SORT_KEYS, filtersToSearchParams, type ResortFilters } from '#lib/domain/selectors.js';
	import { COUNTRIES, type Country } from '#lib/domain/types.js';
	import {
		OPEN_FILTER_OPTIONS,
		SCORE_FILTER_OPTIONS,
		SNOW_FILTER_OPTIONS
	} from '#lib/domain/selectors.js';
	import { formatWholeNumber } from '#lib/i18n/format.js';
	import { countryLabels, currentLocale, href, sortLabels } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		filters: ResortFilters;
		resultCount: number;
	}

	let { filters, resultCount }: Props = $props();

	const locale = $derived(currentLocale());

	/** Server-side path of the current page, so filters survive a locale-agnostic navigation. */
	const basePath = $derived(href('/'));

	function navigate(next: Partial<ResortFilters>) {
		const merged: ResortFilters = { ...filters, ...next };
		const params = filtersToSearchParams(merged);
		const query = params.toString();
		void goto(`${basePath}${query ? `?${query}` : ''}`, { reset: false });
	}

	/**
	 * Free-text search runs as you type, but navigations are debounced: each keystroke would
	 * otherwise trigger a server load and a history entry per character.
	 */
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput(value: string) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => navigate({ query: value }), 280);
	}

	$effect(() => () => clearTimeout(searchTimer));

	const countryLabel = (country: Country) => countryLabels[country]();
	const scoreOptionLabel = (value: number) => {
		if (value === 60) return m.filter_score_60();
		if (value === 75) return m.filter_score_75();
		return m.filter_score_85();
	};
	const snowOptionLabel = (value: number) => {
		if (value === 5) return m.filter_snow_5();
		if (value === 15) return m.filter_snow_15();
		return m.filter_snow_30();
	};
	const openOptionLabel = (ratio: number) => {
		if (ratio === 0.5) return m.filter_open_50();
		return m.filter_open_75();
	};
</script>

<form class="card filters" method="get" action={basePath}>
	<div class="field search-field">
		<label for="filter-q">{m.home_search_label()}</label>
		<input
			id="filter-q"
			name="q"
			type="search"
			value={filters.query}
			placeholder={m.home_search_placeholder()}
			oninput={(event) => onSearchInput(event.currentTarget.value)}
		/>
	</div>

	<div class="field">
		<label for="filter-country">{m.filter_country_label()}</label>
		<select
			id="filter-country"
			name="country"
			value={filters.country}
			onchange={(event) => navigate({ country: event.currentTarget.value as Country | 'all' })}
		>
			<option value="all">{m.country_all()}</option>
			{#each COUNTRIES as country (country)}
				<option value={country}>{countryLabel(country)}</option>
			{/each}
		</select>
	</div>

	<div class="field">
		<label for="filter-score">{m.filter_score_label()}</label>
		<select
			id="filter-score"
			name="score"
			value={filters.minScore === null ? '' : String(filters.minScore)}
			onchange={(event) =>
				navigate({
					minScore: event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
				})}
		>
			<option value="">{m.filter_any()}</option>
			{#each SCORE_FILTER_OPTIONS as option (option)}
				<option value={String(option)}>{scoreOptionLabel(option)}</option>
			{/each}
		</select>
	</div>

	<div class="field">
		<label for="filter-snow">{m.filter_snow_label()}</label>
		<select
			id="filter-snow"
			name="snow"
			value={filters.minNewSnow === null ? '' : String(filters.minNewSnow)}
			onchange={(event) =>
				navigate({
					minNewSnow: event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
				})}
		>
			<option value="">{m.filter_any()}</option>
			{#each SNOW_FILTER_OPTIONS as option (option)}
				<option value={String(option)}>{snowOptionLabel(option)}</option>
			{/each}
		</select>
	</div>

	<div class="field">
		<label for="filter-open">{m.filter_open_label()}</label>
		<select
			id="filter-open"
			name="open"
			value={filters.minOpenPisteRatio === null ? '' : String(filters.minOpenPisteRatio)}
			onchange={(event) =>
				navigate({
					minOpenPisteRatio:
						event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
				})}
		>
			<option value="">{m.filter_any()}</option>
			{#each OPEN_FILTER_OPTIONS as option (option)}
				<option value={String(option)}>{openOptionLabel(option)}</option>
			{/each}
		</select>
	</div>

	<div class="field">
		<label for="filter-sort">{m.filter_sort_label()}</label>
		<select
			id="filter-sort"
			name="sort"
			value={filters.sort}
			onchange={(event) => navigate({ sort: event.currentTarget.value as ResortFilters['sort'] })}
		>
			{#each SORT_KEYS as key (key)}
				<option value={key}>{sortLabels[key]()}</option>
			{/each}
		</select>
	</div>

	<div class="filter-actions">
		<p class="small muted numeric">
			{m.results_count({ count: formatWholeNumber(resultCount, locale) })}
		</p>
		<div class="cluster" style="--gap: 0.5rem">
			<button class="btn" type="submit">{m.filter_apply()}</button>
			<a class="btn" href={basePath}>{m.filter_reset()}</a>
		</div>
	</div>
</form>

<style>
	.filters {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
		align-items: end;
	}

	.search-field {
		grid-column: 1 / -1;
	}

	.filter-actions {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	@media (min-width: 60rem) {
		.search-field {
			grid-column: span 2;
		}

		.filter-actions {
			grid-column: 1 / -1;
		}
	}
</style>
