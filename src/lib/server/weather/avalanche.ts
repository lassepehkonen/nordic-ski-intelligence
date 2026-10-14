/**
 * Avalanche forecast lookup (Phase 7 product slice).
 *
 * Data sources:
 * - Norway: NVE SnøskredAPI (https://api01.nve.no/hydrology/forecast/avalanche/), no key, 3-day
 *   regional danger scale 1–5. Region assignments per resort live in the pilot catalog.
 * - Sweden: Naturvårdsverket geoserver WFS returns the lavinprognoser.se forecasts as JSON
 *   (GeoJSON FeatureCollection, one feature per area with `risk` 0–4, rubric, recommendation).
 *   One feature per AREA per season-window — the current forecast is the newest feature whose
 *   window covers now. Sweden has no 3-day outlook publicly, so we surface the current day.
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
	/** Days valid (max 3). level: null = not rated this season. */
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

interface SeForecastResponse {
	features?: ReadonlyArray<SeForecastFeature>;
}

interface SeForecastFeature {
	properties: {
		id: number;
		valid_from: string;
		valid_to: string;
		area_id: number;
		location: string;
		risk: number;
		risk_rubrik: string | null;
		recommendation: string | null;
		assessment_title: string | null;
		assessment_text: string | null;
	};
}

const NVE_BASE = 'https://api01.nve.no/hydrology/forecast/avalanche/v6.3.2/api';
const NVE_SOURCE_URL = 'https://www.varsom.no/en/avalanches/avalanche-warnings/';
const NVE_ATTRIBUTION = 'NVE / varsom.no — SnøskredAPI';

const SE_WFS_URL =
	'https://nvgis.naturvardsverket.se/geoserver/lavinprognoser/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=published_forecasts&outputFormat=application/json&maxFeatures=200';
const SE_SOURCE_URL = 'https://www.lavinprognoser.se/';
const SE_ATTRIBUTION = 'Naturvårdsverket / lavinprognoser.se';
const SE_TIMEOUT_DAYS = 6 * 24 * 3_600_000;

export function avalancheSourceFor(slug: string): AvalancheSourceConfig | null {
	// Pilot region map: B-region ids from NVE /api/Region list; Swedish areas from
	// lavinprognoser WFS (area_id).
	switch (slug) {
		case 'hemsedal':
			return { regionId: 3032, regionName: 'Hallingdal', days: 3 };
		case 'riksgransen':
			return { regionId: 2, regionName: 'Abisko/Riksgränsenfjällen', days: 1 };
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

function parseSeFeatures(payload: unknown, now: number): AvalancheForecastView['days'] {
	const features = (payload as SeForecastResponse | null)?.features ?? [];
	if (!features.length) return [];
	// Pick the newest feature whose valid window covers now; seasons with no assessment yield risk 0.
	const nowMs = now;
	const current = features
		.filter(
			(f) =>
				f &&
				typeof f.properties === 'object' &&
				typeof f.properties.valid_from === 'string' &&
				typeof f.properties.valid_to === 'string' &&
				Number.isFinite(Date.parse(f.properties.valid_from)) &&
				Number.isFinite(Date.parse(f.properties.valid_to)) &&
				Date.parse(f.properties.valid_from) <= nowMs &&
				Date.parse(f.properties.valid_to) >= nowMs
		)
		.sort((a, b) => Date.parse(b.properties.valid_from) - Date.parse(a.properties.valid_from))[0];
	if (!current) return [];
	const risk = Number(current.properties.risk);
	return [
		{
			// Present the forecast as of its own start; season-closed entries still surface.
			validFrom: current.properties.valid_from,
			dangerLevel: risk >= 1 && risk <= 5 ? risk : null,
			text: current.properties.risk_rubrik ?? ''
		}
	];
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

async function fetchSe(
	config: AvalancheSourceConfig,
	fetchImpl: typeof fetch
): Promise<AvalancheForecastView | null> {
	try {
		const response = await fetchImpl(SE_WFS_URL, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(8_000),
			cache: 'no-store'
		} as RequestInit);
		if (!response.ok) return null;
		const payload = (await response.json()) as unknown;
		const days = parseSeFeatures(payload, Date.now());
		if (!days.length) return null;
		return {
			regionId: config.regionId,
			regionName: config.regionName,
			sourceUrl: SE_SOURCE_URL,
			attribution: SE_ATTRIBUTION,
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
	if (slug === 'riksgransen') return fetchSe(config, fetchImpl);
	return fetchNve(config, fetchImpl);
}
