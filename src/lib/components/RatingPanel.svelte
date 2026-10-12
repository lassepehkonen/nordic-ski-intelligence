<script lang="ts">
	import type { ResortRatingView } from '#lib/domain/types.js';
	import { formatWholeNumber } from '#lib/i18n/format.js';
	import { currentLocale, ratingCategoryLabels } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';

	let { rating }: { rating: ResortRatingView } = $props();

	const locale = $derived(currentLocale());

	const categories = $derived(
		rating.categories.map((category) => ({
			id: category.category,
			label: ratingCategoryLabels[category.category](),
			value: category.value,
			percent: Math.round((category.value / rating.scaleMax) * 100),
			weight: Math.round(category.weight * 100)
		}))
	);
</script>

<div class="stack" style="--gap: 0.85rem">
	<p class="cluster" style="--gap: 0.75rem">
		<span class="overall numeric">
			{rating.overall === null ? '–' : rating.overall.toFixed(1)}
		</span>
		<span class="small muted">
			{m.resort_rating_value({
				value: rating.overall === null ? '–' : rating.overall.toFixed(1),
				max: formatWholeNumber(rating.scaleMax, locale)
			})}
		</span>
	</p>

	<ul class="rating-list">
		{#each categories as category (category.id)}
			<li>
				<div class="row-line">
					<span>{category.label}</span>
					<span class="cluster" style="--gap: 0.4rem">
						<span class="numeric">{category.value.toFixed(1)}</span>
						<span class="chip"
							>{m.resort_rating_weight({
								percent: formatWholeNumber(category.weight, locale)
							})}</span
						>
					</span>
				</div>
				<div class="bar" style="--value: {category.percent}%; --band-color: var(--accent)">
					<span></span>
				</div>
			</li>
		{/each}
	</ul>

	<p class="small muted">{m.resort_rating_methodology()}</p>
	<p class="small muted">{m.data_notice_short_body()}</p>
</div>

<style>
	.overall {
		font-size: var(--step-3);
		font-weight: 640;
		line-height: 1;
	}

	.rating-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.rating-list li {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.row-line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.6rem;
		font-size: var(--step--1);
	}
</style>
