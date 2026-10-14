/**
 * Synthetic pilot fixtures for the product view/query tests.
 *
 * The fixtures mirror the Phase 5 read model exactly (`PilotProductResort`), including its
 * deliberate nulls: a missing count, a missing snow-depth observation or a missing current
 * weather point is `null`, never 0.
 */
import type { PilotProductResort } from '../../src/lib/server/resorts/product-repository.js';
import type { WeatherPoint } from '../../src/lib/server/weather/adapters.js';

export function weatherPoint(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
	return {
		validAt: '2026-10-12T13:00:00.000Z',
		latitude: 67.8,
		longitude: 24.8,
		airTemperatureC: -3,
		windSpeedMs: 4,
		windDirectionDegrees: 210,
		relativeHumidityPercent: 85,
		precipitationMm: 0.2,
		precipitationPeriodHours: 1,
		snowfallMm: null,
		snowDepthCm: null,
		symbolCode: 'partlycloudy_day',
		...overrides
	};
}

export interface PilotResortOptions {
	slug?: string;
	name?: string;
	countryCode?: 'FI' | 'SE' | 'NO';
	region?: string;
	size?: 'small' | 'medium' | 'large';
	latitude?: number;
	longitude?: number;
	inventoryLifts?: number | null;
	inventoryPistes?: number | null;
	openLifts?: number | null;
	totalLifts?: number | null;
	openPistes?: number | null;
	totalPistes?: number | null;
	statusFreshness?: 'fresh' | 'partial' | 'stale' | 'scheduled' | 'unavailable';
	checkedAt?: string | null;
	weatherProvider?: 'fmi' | 'smhi' | 'met-no';
	weatherFreshness?: 'fresh' | 'stale' | 'unavailable';
	fetchedAt?: string | null;
	sourceUpdatedAt?: string | null;
	current?: WeatherPoint | null;
	forecast?: WeatherPoint[];
	snowDepthCm?: number | null;
	recentSnowfall24hCm?: number | null;
	snowObservedAt?: string | null;
	snowSourceUrl?: string | null;
}

export function pilotResort(options: PilotResortOptions = {}): PilotProductResort {
	return {
		slug: options.slug ?? 'levi',
		name: options.name ?? 'Levi',
		countryCode: options.countryCode ?? 'FI',
		region: options.region ?? 'Kittilä, Lapland',
		size: options.size ?? 'large',
		location: {
			latitude: options.latitude ?? 67.8038,
			longitude: options.longitude ?? 24.8088,
			sourceUrl: 'https://api.lipas.fi/v2/sports-sites',
			attribution: 'LIPAS, CC BY 4.0'
		},
		inventory: {
			lifts: options.inventoryLifts === undefined ? 28 : options.inventoryLifts,
			pistes: options.inventoryPistes === undefined ? 44 : options.inventoryPistes,
			sourceUrl: 'https://www.levi.fi/en/ski/ski-resort-today/',
			attribution: 'Levi official count page; numeric totals only'
		},
		status: {
			lifts: {
				open: options.openLifts === undefined ? 3 : options.openLifts,
				total: options.totalLifts === undefined ? 28 : options.totalLifts
			},
			pistes: {
				open: options.openPistes === undefined ? 3 : options.openPistes,
				total: options.totalPistes === undefined ? 44 : options.totalPistes
			},
			freshness: options.statusFreshness ?? 'fresh',
			checkedAt: options.checkedAt === undefined ? '2026-10-12T11:29:27.000Z' : options.checkedAt,
			sourceUrl: 'https://www.levi.fi/en/ski/ski-resort-today/',
			attribution: 'Levi official count page; four numeric counts only'
		},
		weather: {
			provider: options.weatherProvider ?? 'fmi',
			sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services',
			attribution: 'FMI, CC BY 4.0',
			freshness: options.weatherFreshness ?? 'fresh',
			fetchedAt: options.fetchedAt === undefined ? '2026-10-12T13:03:20.623Z' : options.fetchedAt,
			sourceUpdatedAt:
				options.sourceUpdatedAt === undefined
					? '2026-10-12T12:00:00.000Z'
					: options.sourceUpdatedAt,
			current:
				options.current === undefined
					? weatherPoint({ validAt: '2026-10-12T13:00:00.000Z' })
					: options.current,
			forecast: options.forecast ?? [
				weatherPoint({
					validAt: '2026-10-12T15:00:00.000Z',
					snowfallMm: 2,
					precipitationPeriodHours: 2
				})
			],
			snow: {
				depthCm: options.snowDepthCm === undefined ? null : options.snowDepthCm,
				recentSnowfall24hCm:
					options.recentSnowfall24hCm === undefined ? null : options.recentSnowfall24hCm,
				observedAt: options.snowObservedAt === undefined ? null : options.snowObservedAt,
				sourceUrl: options.snowSourceUrl === undefined ? null : options.snowSourceUrl
			}
		}
	};
}

export function pilotSnapshot(resorts: PilotProductResort[]) {
	return {
		resorts,
		lastCollectionRun: {
			completedAt: '2026-10-12T13:03:21.269Z',
			outcome: 'success' as const,
			totalProviderRequests: resorts.length,
			providerRequestsByProvider: { fmi: 6, smhi: 2, 'met-no': 2 },
			resortsAttempted: resorts.length,
			resortsSucceeded: resorts.length,
			resortsFailed: 0,
			resortsStale: 0
		}
	};
}

/** The asOf clock used by every product view test: shortly after the fixture retrieval time. */
export const TEST_NOW = new Date('2026-10-12T13:30:00.000Z');
