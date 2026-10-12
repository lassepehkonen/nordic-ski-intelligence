/**
 * Resort Rating engine: a weighted editorial assessment on a configurable scale, kept structurally
 * separate from the Conditions Score (ADR-0009).
 */

import type { DataState, RatingCategory, ResortRatingView } from '../types.js';
import {
	RESORT_RATING_V1,
	ratingWeightTotal,
	type ResortRatingConfig
} from './config.js';

export type RatingInputs = Partial<Record<RatingCategory, number | null>>;

export interface ResortRatingInput {
	resortId: string;
	values: RatingInputs;
	dataState: DataState;
	config?: ResortRatingConfig;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function computeResortRating({
	resortId,
	values,
	dataState,
	config = RESORT_RATING_V1
}: ResortRatingInput): ResortRatingView {
	const categories = config.categories.map((definition) => {
		const raw = values[definition.category];
		const value = typeof raw === 'number' ? clamp(raw, 0, config.scaleMax) : null;
		return {
			category: definition.category,
			value: value ?? 0,
			weight: definition.weight,
			contribution: value === null ? 0 : value * definition.weight,
			available: value !== null
		};
	});

	const availableWeight = categories
		.filter((entry) => entry.available)
		.reduce((total, entry) => total + entry.weight, 0);
	const totalWeight = ratingWeightTotal(config);
	const weighted = categories.reduce((total, entry) => total + entry.contribution, 0);

	const overall =
		availableWeight === 0 ? null : Math.round((weighted / availableWeight) * 100) / 100;

	return {
		version: config.version,
		resortId,
		scaleMax: config.scaleMax,
		overall,
		coverage: totalWeight === 0 ? 0 : Math.round((availableWeight / totalWeight) * 1000) / 1000,
		categories: categories.map(({ available: _available, ...entry }) => entry),
		dataState
	};
}
