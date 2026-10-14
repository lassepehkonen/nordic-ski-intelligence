export type PilotCountryCode = 'FI' | 'SE' | 'NO';
export type WeatherProvider = 'fmi' | 'smhi' | 'met-no';
export type ResortSize = 'small' | 'medium' | 'large';
export type StatusFreshness = 'fresh' | 'partial' | 'stale' | 'scheduled' | 'unavailable';

export interface CountSnapshot {
	open: number | null;
	total: number | null;
}

export interface PilotResort {
	slug: string;
	name: string;
	countryCode: PilotCountryCode;
	region: string;
	size: ResortSize;
	location: {
		latitude: number;
		longitude: number;
		sourceUrl: string;
		sourceLabel: string;
	};
	inventory: {
		lifts: number | null;
		pistes: number | null;
		sourceUrl: string;
	};
	weather: {
		provider: WeatherProvider;
		sourceUrl: string;
	};
	status: {
		lifts: CountSnapshot;
		pistes: CountSnapshot;
		freshness: StatusFreshness;
		fetchedAt: string;
		sourceUrl: string;
		displayApproval: 'pending' | 'approved';
	};
	/** Countable published off-piste routes; present only when a factual total exists. */
	offpiste?: {
		routes: number;
		open: number | null;
		sourceUrl: string;
		attribution: string;
	};
}

const MANUAL_STATUS_TTL_MS = 6 * 60 * 60 * 1000;
const ALLOWED_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function getStatusFreshness(
	status: Pick<PilotResort['status'], 'freshness' | 'fetchedAt'>,
	now = new Date()
): StatusFreshness {
	if (status.freshness !== 'fresh') return status.freshness;
	const fetchedAtMs = Date.parse(status.fetchedAt);
	if (!Number.isFinite(fetchedAtMs)) return 'unavailable';
	const ageMs = now.getTime() - fetchedAtMs;
	if (ageMs < -ALLOWED_CLOCK_SKEW_MS) return 'unavailable';
	return ageMs >= MANUAL_STATUS_TTL_MS ? 'stale' : 'fresh';
}

export function isStatusDisplayApproved(
	status: Pick<PilotResort['status'], 'displayApproval'>
): boolean {
	return status.displayApproval === 'approved';
}

export const pilotResorts: PilotResort[] = [
	{
		slug: 'yllas',
		name: 'Ylläs',
		countryCode: 'FI',
		region: 'Kolari, Lapland',
		size: 'large',
		location: {
			latitude: 67.551,
			longitude: 24.2573,
			sourceUrl: 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1',
			sourceLabel: 'Jyväskylän yliopisto / LIPAS; Ylläsjärvi site 98018'
		},
		inventory: {
			lifts: 29,
			pistes: 63,
			sourceUrl: 'https://ski.yllas.fi/rinteet-ja-hissit/'
		},
		weather: {
			provider: 'fmi',
			sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: null, total: 29 },
			pistes: { open: null, total: 63 },
			freshness: 'unavailable',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://ski.yllas.fi/en/slopes-and-lifts/opening-hours/'
		}
	},
	{
		slug: 'levi',
		name: 'Levi',
		countryCode: 'FI',
		region: 'Kittilä, Lapland',
		size: 'large',
		location: {
			latitude: 67.8038,
			longitude: 24.8088,
			sourceUrl: 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1',
			sourceLabel: 'Jyväskylän yliopisto / LIPAS; site 98005'
		},
		inventory: {
			lifts: 28,
			pistes: 44,
			sourceUrl: 'https://www.levi.fi/en/ski/ski-resort-today/'
		},
		weather: {
			provider: 'fmi',
			sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: 3, total: 28 },
			pistes: { open: 3, total: 44 },
			freshness: 'fresh',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://www.levi.fi/en/ski/ski-resort-today/'
		}
	},
	{
		slug: 'ruka',
		name: 'Ruka',
		countryCode: 'FI',
		region: 'Kuusamo, North Ostrobothnia',
		size: 'large',
		location: {
			latitude: 66.1652,
			longitude: 29.1514,
			sourceUrl: 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1',
			sourceLabel: 'Jyväskylän yliopisto / LIPAS; site 98069'
		},
		inventory: {
			lifts: 22,
			pistes: 41,
			sourceUrl: 'https://www.ruka.fi/en/skiresort/slopes'
		},
		weather: {
			provider: 'fmi',
			sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: 3, total: 22 },
			pistes: { open: 3, total: 41 },
			freshness: 'fresh',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://www.ruka.fi/en/skiresort/slopes'
		}
	},
	{
		slug: 'himos',
		name: 'Himos',
		countryCode: 'FI',
		region: 'Jämsä, Central Finland',
		size: 'medium',
		location: {
			latitude: 61.8792,
			longitude: 25.2994,
			sourceUrl: 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1',
			sourceLabel: 'Jyväskylän yliopisto / LIPAS; site 98071'
		},
		inventory: {
			lifts: 17,
			pistes: 26,
			sourceUrl: 'https://himos.fi/en/skiing/slope-info/'
		},
		weather: {
			provider: 'fmi',
			sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: 0, total: 17 },
			pistes: { open: 0, total: 26 },
			freshness: 'fresh',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://himos.fi/en/skiing/slope-info/'
		}
	},
	{
		slug: 'tahko',
		name: 'Tahko',
		countryCode: 'FI',
		region: 'Kuopio, North Savo',
		size: 'medium',
		location: {
			latitude: 63.292,
			longitude: 28.0255,
			sourceUrl: 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1',
			sourceLabel: 'Jyväskylän yliopisto / LIPAS; site 98003'
		},
		inventory: {
			lifts: 14,
			pistes: 25,
			sourceUrl: 'https://www.tahko.com/en/things-to-do/activities/skiing-and-snowboarding/'
		},
		weather: {
			provider: 'fmi',
			sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: 0, total: 15 },
			pistes: { open: 0, total: 25 },
			freshness: 'fresh',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://www.tahko.com/en/things-to-do/activities/skiing-and-snowboarding/'
		}
	},
	{
		slug: 'iso-syote',
		name: 'Iso-Syöte',
		countryCode: 'FI',
		region: 'Pudasjärvi, North Ostrobothnia',
		size: 'small',
		location: {
			latitude: 65.6248,
			longitude: 27.6292,
			sourceUrl: 'https://api.lipas.fi/v2/sports-sites?type-codes=4110&page-size=100&page=1',
			sourceLabel: 'Jyväskylän yliopisto / LIPAS; site 98004'
		},
		inventory: {
			lifts: 9,
			pistes: 18,
			sourceUrl: 'https://www.isosyote.fi/en/slopes-and-lifts'
		},
		weather: {
			provider: 'fmi',
			sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: null, total: 9 },
			pistes: { open: null, total: 18 },
			freshness: 'unavailable',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://www.isosyote.fi/en/slopes-and-lifts'
		}
	},
	{
		slug: 'are',
		name: 'Åre',
		countryCode: 'SE',
		region: 'Åre, Jämtland',
		size: 'large',
		location: {
			latitude: 63.415,
			longitude: 13.062,
			sourceUrl: 'https://en.wikipedia.org/wiki/%C3%85re_ski_resort',
			sourceLabel: 'Published resort reference point; regional forecast anchor, not a piste sensor'
		},
		inventory: {
			lifts: 41,
			pistes: 89,
			sourceUrl: 'https://www.skistar.com/en/ski-destinations/are/winter-in-are/'
		},
		weather: {
			provider: 'smhi',
			sourceUrl: 'https://opendata.smhi.se/metfcst/snow1gv1'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: 0, total: 41 },
			pistes: { open: 0, total: 89 },
			freshness: 'fresh',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://sv.wikipedia.org/wiki/%C3%85re_(skidomr%C3%A5de)'
		}
	},
	{
		slug: 'riksgransen',
		name: 'Riksgränsen',
		countryCode: 'SE',
		region: 'Kiruna, Norrbotten',
		size: 'medium',
		location: {
			latitude: 68.4278,
			longitude: 18.1222,
			sourceUrl: 'https://en.wikipedia.org/wiki/Riksgr%C3%A4nsen',
			sourceLabel: 'Published resort reference point; regional forecast anchor, not a piste sensor'
		},
		inventory: {
			lifts: 6,
			pistes: 19,
			sourceUrl: 'https://sv.wikipedia.org/wiki/Riksgr%C3%A4nsen'
		},
		offpiste: {
			// sv.wiki infobox: "Totalt 34 inkl off-pist" against 19 marked pistes → 15 routes.
			routes: 15,
			open: null,
			sourceUrl: 'https://sv.wikipedia.org/wiki/Riksgr%C3%A4nsen',
			attribution: 'Wikipedia (sv) — Riksgränsen infobox'
		},
		weather: {
			provider: 'smhi',
			sourceUrl: 'https://opendata.smhi.se/metfcst/snow1gv1'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: null, total: 6 },
			pistes: { open: null, total: 19 },
			freshness: 'unavailable',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl: 'https://riksgransen.se/en/snow-report-mountain-status/'
		}
	},
	{
		slug: 'trysil',
		name: 'Trysil',
		countryCode: 'NO',
		region: 'Trysil, Innlandet',
		size: 'large',
		location: {
			latitude: 61.31,
			longitude: 12.315,
			sourceUrl: 'https://en.wikipedia.org/wiki/Trysil_Municipality',
			sourceLabel: 'Municipality reference point; regional forecast anchor, not a piste sensor'
		},
		inventory: {
			lifts: 41,
			pistes: 69,
			sourceUrl: 'https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/ski-area/'
		},
		weather: {
			provider: 'met-no',
			sourceUrl: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: 0, total: 15 },
			pistes: { open: 0, total: 23 },
			freshness: 'fresh',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl:
				'https://www.skistar.com/en/ski-destinations/trysil/winter-in-trysil/weather-and-slopes/'
		}
	},
	{
		slug: 'hemsedal',
		name: 'Hemsedal',
		countryCode: 'NO',
		region: 'Hemsedal, Buskerud',
		size: 'large',
		location: {
			latitude: 60.9058,
			longitude: 8.5147,
			sourceUrl: 'https://en.wikipedia.org/wiki/Hemsedal',
			sourceLabel: 'Municipality reference point; regional forecast anchor, not a piste sensor'
		},
		inventory: {
			lifts: 22,
			pistes: 47,
			sourceUrl:
				'https://www.skistar.com/en/ski-destinations/hemsedal/winter-in-hemsedal/weather-and-slopes/'
		},
		weather: {
			provider: 'met-no',
			sourceUrl: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation'
		},
		status: {
			displayApproval: 'approved',
			lifts: { open: 0, total: 22 },
			pistes: { open: 0, total: 47 },
			freshness: 'fresh',
			fetchedAt: '2026-10-13T20:42:19Z',
			sourceUrl:
				'https://www.skistar.com/en/ski-destinations/hemsedal/winter-in-hemsedal/weather-and-slopes/'
		}
	}
];

export function validatePilotResort(resort: PilotResort): void {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resort.slug)) {
		throw new Error(`Invalid resort slug: ${resort.slug}`);
	}

	if (!resort.name.trim() || !resort.region.trim()) {
		throw new Error(`Resort ${resort.slug} is missing its display name or region`);
	}

	if (
		!Number.isFinite(resort.location.latitude) ||
		resort.location.latitude < -90 ||
		resort.location.latitude > 90 ||
		!Number.isFinite(resort.location.longitude) ||
		resort.location.longitude < -180 ||
		resort.location.longitude > 180
	) {
		throw new Error(`Resort ${resort.slug} has invalid coordinates`);
	}

	const expectedWeatherProvider: Record<PilotCountryCode, WeatherProvider> = {
		FI: 'fmi',
		SE: 'smhi',
		NO: 'met-no'
	};
	if (resort.weather.provider !== expectedWeatherProvider[resort.countryCode]) {
		throw new Error(`Resort ${resort.slug} uses a weather provider for the wrong country`);
	}

	for (const sourceUrl of [
		resort.location.sourceUrl,
		resort.inventory.sourceUrl,
		resort.weather.sourceUrl,
		resort.status.sourceUrl
	]) {
		if (!/^https:\/\//i.test(sourceUrl)) {
			throw new Error(`Resort ${resort.slug} has a non-HTTPS source URL`);
		}
	}

	for (const [label, count] of [
		['inventory lifts', resort.inventory.lifts],
		['inventory pistes', resort.inventory.pistes],
		['status total lifts', resort.status.lifts.total],
		['status total pistes', resort.status.pistes.total]
	] as const) {
		if (count !== null && (!Number.isInteger(count) || count < 0)) {
			throw new Error(`Resort ${resort.slug} has invalid ${label} count`);
		}
	}

	for (const [label, counts] of [
		['lifts', resort.status.lifts],
		['pistes', resort.status.pistes]
	] as const) {
		if (counts.open !== null && (counts.total === null || counts.open > counts.total)) {
			throw new Error(`Resort ${resort.slug} has an invalid open ${label} count`);
		}
	}
}

for (const resort of pilotResorts) validatePilotResort(resort);

if (new Set(pilotResorts.map((resort) => resort.slug)).size !== pilotResorts.length) {
	throw new Error('Pilot resort slugs must be unique');
}
