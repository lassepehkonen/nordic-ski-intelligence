/**
 * Resort Rating configuration, version 1 (ADR-0009).
 *
 * The Resort Rating is a comparatively permanent editorial assessment and is never mixed into the
 * dynamic Conditions Score. Categories and weights come from the Master Product Context and stay
 * configurable. The 0–10 scale is the product decision recorded for this phase; the values
 * themselves are editorial preview values in the sample dataset.
 */

import type { RatingCategory } from '../types.js';

export interface RatingCategoryDefinition {
	category: RatingCategory;
	labelKey: string;
	weight: number;
}

export interface ResortRatingConfig {
	version: string;
	scaleMax: number;
	categories: readonly RatingCategoryDefinition[];
}

export const RESORT_RATING_V1: ResortRatingConfig = {
	version: 'v1',
	scaleMax: 10,
	categories: [
		{ category: 'atmosphere', labelKey: 'rating_atmosphere', weight: 0.15 },
		{ category: 'slopes', labelKey: 'rating_slopes', weight: 0.25 },
		{ category: 'lifts', labelKey: 'rating_lifts', weight: 0.15 },
		{ category: 'offpiste', labelKey: 'rating_offpiste', weight: 0.2 },
		{ category: 'accommodation', labelKey: 'rating_accommodation', weight: 0.1 },
		{ category: 'food', labelKey: 'rating_food', weight: 0.075 },
		{ category: 'apres', labelKey: 'rating_apres', weight: 0.075 }
	]
};

export function ratingWeightTotal(config: ResortRatingConfig): number {
	return config.categories.reduce((total, entry) => total + entry.weight, 0);
}
