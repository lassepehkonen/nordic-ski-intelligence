/**
 * Avalanche forecast lookup (Phase 7 product slice).
 *
 * Data sources:
 * - Norway: NVE SnøskredAPI (https://api01.nve.no/hydrology/forecast/avalanche/), no key, 3-day
 *   regional danger scale 1–5. Region assignments per resort live in the pilot catalog.
 * - Sweden: lavinprognoser.se publishes no open JSON API (WMS map only) → no live lookup.
 * - Finland: no national public avalanche forecast → no card.
 *
 * The lookup is per-request with an 8 s timeout and never fails the page: any error yields null
 * and the resort page simply omits the card.
 */

export interface AvalancheForecastView {
	readonly regionId: number;
	readonly regionName: string;
	readonly sourceUrl: string;
	readonly attribution: string;
	/** Days valid (max 3). level: null = 'Ikke vurdert' (not rated this season). */
	readonly days: ReadonlyArray<{
		readonly validFrom: string;
		readonly dangerLevel: number | null;
		readonly text: string;
	}>;
}

interface NveSimpleWarning {
	RegId: number;
	RegionId: number;
	RegionName: string;
	DangerLevel: string;
	ValidFrom: string;
	ValidTo: string;
	MainText: string;
	LangKey: number;
}

interface AvalancheSourceConfig {
	readonly regionId: number;
	readonly regionName: string;
	readonly days: number;
}

const NVE_BASE = 'https://api01.nve.no/hydrology/forecast/avalanche/v6.3.2/api';
const NVE_SOURCE_URL = 'https://www.varsom.no/en/avalanches/avalanche-warnings/';
const NVE_ATTRIBUTION = 'NVE / varsom.no — SnøskredAPI';

export function avalancheSourceFor(slug: string): AvalancheSourceConfig | null {
	// Pilot region map: B-region ids from NVE /api/Region list.
	switch (slug) {
		case 'hemsedal':
			return { regionId: 3032, regionName: 'Hallingdal', days: 3 };
		default:
			return null;
	}
}

function parseNveSimple(payload: unknown): AvalancheForecastView['days'] {
	if (!Array.isArray(payload)) return [];
	const days = payload
		.filter(
			(w): w is NveSimpleWarning =>
				typeof w === 'object' &&
				w !== null &&
				typeof (w as NveSimpleWarning).ValidFrom === 'string' &&
				typeof (w as NveSimpleWarning).DangerLevel === 'string'
		)
		.map((w) => ({
			validFrom: w.ValidFrom,
			dangerLevel: w.DangerLevel === '0' ? null : Number(w.DangerLevel),
			text: typeof w.MainText === 'string' ? w.MainText : ''
		}))
		.filter((d) => Number.isFinite(Date.parse(d.validFrom)))
		// Danger level sanity: 1..5 or null.
		.map((d) => ({
			...d,
			dangerLevel:
				d.dangerLevel !== null && d.dangerLevel >= 1 && d.dangerLevel <= 5 ? d.dangerLevel : null
		}));
	return days;
}

async function fetchNve(
	config: AvalancheSourceConfig,
	fetchImpl: typeof fetch
): Promise<AvalancheForecastView | null> {
	const start = new Date();
	const end = new Date(start.getTime() + config.days * 24 * 3_600_000);
	const iso = (d: Date) => d.toISOString().slice(0, 10);
	const url = `${NVE_BASE}/AvalancheWarningByRegion/Simple/${config.regionId}/1/${iso(start)}/${iso(end)}`;
	try {
		const response = await fetchImpl(url, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(8_000),
			cache: 'no-store'
		} as RequestInit);
		if (!response.ok) return null;
		const days = parseNveSimple(await response.json());
		if (!days.length) return null;
		return {
			regionId: config.regionId,
			regionName: config.regionName,
			sourceUrl: NVE_SOURCE_URL,
			attribution: NVE_ATTRIBUTION,
			days
		};
	} catch {
		return null;
	}
}

export async function lookupAvalancheForecast(
	slug: string,
	fetchImpl: typeof fetch = fetch
): Promise<AvalancheForecastView | null> {
	const config = avalancheSourceFor(slug);
	if (!config) return null;
	return fetchNve(config, fetchImpl);
}
