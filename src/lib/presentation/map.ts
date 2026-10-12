/**
 * Presentation model for the map: the marker layer only needs a flat, localized shape, so the
 * domain records are projected here instead of being passed into a Leaflet callback.
 */

import type { ResortListItem } from '../domain/selectors.js';
import type { ScoreBand } from '../domain/types.js';
import { href } from '../i18n/ui.js';
import type { Locale } from '../i18n/locales.js';

export interface MapPoint {
	id: string;
	name: string;
	/** Score as shown on the marker, or null when the resort has no publishable score. */
	score: number | null;
	band: ScoreBand | null;
	lat: number;
	lon: number;
	/** Localized resort URL. */
	href: string;
	/** Localized comparison URL that adds this resort to the current selection. */
	compareHref: string;
	summary: string;
}

export function toMapPoints(
	items: readonly ResortListItem[],
	locale: Locale,
	compareHrefFor: (slug: string) => string
): MapPoint[] {
	return items.map((item) => ({
		id: item.resort.id,
		name: item.translation.name,
		score: item.score.score,
		band: item.score.band,
		lat: item.resort.coordinates.lat,
		lon: item.resort.coordinates.lon,
		href: href(`/resort/${item.resort.id}`, locale),
		compareHref: compareHrefFor(item.resort.id),
		summary: item.translation.summary
	}));
}
