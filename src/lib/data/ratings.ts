/**
 * Editorial Resort Rating values for the preview dataset.
 *
 * These are *preview editorial values* on the 0–10 scale configured in
 * `src/lib/domain/rating/config.ts`. They exist so the rating presentation and comparison can be
 * built and reviewed; the editorial process, ownership and calibration of these values remain an
 * open product decision (ADR-0009), and the UI labels them as preview values.
 */

import type { RatingInputs } from '../domain/rating/rating.js';

export const RESORT_RATING_VALUES: Readonly<Record<string, RatingInputs>> = {
	levi: {
		atmosphere: 7.8,
		slopes: 7.4,
		lifts: 7.6,
		offpiste: 6.4,
		accommodation: 8,
		food: 7.2,
		apres: 7
	},
	yllas: {
		atmosphere: 8.4,
		slopes: 8,
		lifts: 7.8,
		offpiste: 7.6,
		accommodation: 8.2,
		food: 7.4,
		apres: 7.2
	},
	ruka: {
		atmosphere: 8,
		slopes: 7.6,
		lifts: 7.4,
		offpiste: 6.6,
		accommodation: 7.8,
		food: 7.4,
		apres: 7.6
	},
	tahko: {
		atmosphere: 7.2,
		slopes: 6.8,
		lifts: 6.6,
		offpiste: 5.8,
		accommodation: 7.6,
		food: 7,
		apres: 6.8
	},
	are: {
		atmosphere: 8.2,
		slopes: 8.8,
		lifts: 8.6,
		offpiste: 8.4,
		accommodation: 8.6,
		food: 8.2,
		apres: 8.8
	},
	salen: {
		atmosphere: 7.6,
		slopes: 8.2,
		lifts: 8.8,
		offpiste: 7.2,
		accommodation: 8.8,
		food: 7.8,
		apres: 8.4
	},
	vemdalen: {
		atmosphere: 7.4,
		slopes: 7.8,
		lifts: 7.6,
		offpiste: 7,
		accommodation: 7.4,
		food: 7.2,
		apres: 7
	},
	trysil: {
		atmosphere: 7.8,
		slopes: 8.4,
		lifts: 8.2,
		offpiste: 7.8,
		accommodation: 8,
		food: 7.6,
		apres: 7.4
	},
	hemsedal: {
		atmosphere: 8,
		slopes: 8.2,
		lifts: 8,
		offpiste: 8.6,
		accommodation: 7.8,
		food: 7.8,
		apres: 8.2
	},
	hafjell: {
		atmosphere: 7.4,
		slopes: 7.6,
		lifts: 8.4,
		offpiste: 7.4,
		accommodation: 8.2,
		food: 7.4,
		apres: 7.2
	}
};

export function ratingValuesFor(resortId: string): RatingInputs {
	return RESORT_RATING_VALUES[resortId] ?? {};
}
