<script lang="ts">
	import { MAX_COMPARISON_RESORTS } from '#lib/domain/selectors.js';
	import { countryLabels, href } from '#lib/i18n/ui.js';
	import { m } from '#lib/paraglide/messages.js';

	export interface PickerOption {
		id: string;
		name: string;
		region: string;
		country: keyof typeof countryLabels;
		selected: boolean;
	}

	interface Props {
		options: PickerOption[];
	}

	let { options }: Props = $props();

	const limit = MAX_COMPARISON_RESORTS;
</script>

<form class="card stack" method="get" action={href('/compare')} style="--gap: 0.85rem">
	<header class="section-head">
		<h2>{m.compare_select_title()}</h2>
		<p>{m.compare_select_hint()}</p>
	</header>

	<fieldset class="picker">
		<legend class="visually-hidden">{m.compare_select_title()}</legend>
		{#each options as option (option.id)}
			<label class="picker-option" data-selected={option.selected ? 'true' : undefined}>
				<input
					type="checkbox"
					name="resorts"
					value={option.id}
					checked={option.selected}
					onchange={(event) => {
						// Enforce the three-resort ceiling in the browser too; the server caps it anyway.
						const checked = event.currentTarget.form?.querySelectorAll(
							'input[name="resorts"]:checked'
						);
						if (checked && checked.length > limit) event.currentTarget.checked = false;
					}}
				/>
				<span class="picker-text">
					<strong>{option.name}</strong>
					<span class="small muted">{option.region} · {countryLabels[option.country]()}</span>
				</span>
			</label>
		{/each}
	</fieldset>

	<div class="cluster" style="--gap: 0.6rem">
		<button class="btn" data-variant="primary" type="submit">{m.compare_submit()}</button>
		<a class="btn" href={href('/compare')}>{m.compare_clear()}</a>
		<span class="small muted">{m.compare_hint_max()}</span>
	</div>
</form>

<style>
	.picker {
		display: grid;
		gap: 0.4rem;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
		border: 0;
		padding: 0;
		margin: 0;
	}

	.picker-option {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg-elevated);
		cursor: pointer;
	}

	.picker-option[data-selected='true'] {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.picker-text {
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}

	input[type='checkbox'] {
		accent-color: var(--accent);
		width: 1.05rem;
		height: 1.05rem;
	}
</style>
