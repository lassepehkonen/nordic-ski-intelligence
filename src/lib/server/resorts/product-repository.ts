import type { WeatherPoint } from '../weather/adapters.js';
import type { PilotCountryCode, ResortSize, StatusFreshness, WeatherProvider } from './pilot.js';

export interface PilotProductResort {
	slug: string;
	name: string;
	countryCode: PilotCountryCode;
	region: string;
	size: ResortSize;
	location: {
		latitude: number;
		longitude: number;
		sourceUrl: string;
		attribution: string;
	};
	inventory: {
		lifts: number | null;
		pistes: number | null;
		sourceUrl: string;
		attribution: string;
	};
	status: {
		lifts: { open: number | null; total: number | null };
		pistes: { open: number | null; total: number | null };
		freshness: StatusFreshness;
		checkedAt: string | null;
		sourceUrl: string;
		attribution: string;
	};
	weather: {
		provider: WeatherProvider;
		sourceUrl: string;
		attribution: string;
		freshness: 'fresh' | 'stale' | 'unavailable';
		fetchedAt: string | null;
		sourceUpdatedAt: string | null;
		current: WeatherPoint | null;
		forecast: WeatherPoint[];
		snow: {
			depthCm: number | null;
			recentSnowfall24hCm: number | null;
			observedAt: string | null;
			sourceUrl: string | null;
		};
	};
}

export interface PilotCollectionSummary {
	completedAt: string;
	outcome: 'success' | 'partial' | 'failed';
	totalProviderRequests: number;
	providerRequestsByProvider: Record<WeatherProvider, number>;
	resortsAttempted: number;
	resortsSucceeded: number;
	resortsFailed: number;
	resortsStale: number;
}

export interface PilotProductSnapshot {
	resorts: PilotProductResort[];
	lastCollectionRun: PilotCollectionSummary | null;
}

export interface PilotProductReaderOptions {
	supabaseUrl: string;
	publishableKey: string;
	fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProductSnapshot(value: unknown): value is PilotProductSnapshot {
	return (
		isRecord(value) &&
		Array.isArray(value.resorts) &&
		value.resorts.every((resort) => isRecord(resort) && typeof resort.slug === 'string') &&
		(value.lastCollectionRun === null || isRecord(value.lastCollectionRun))
	);
}

export function createPilotProductReader(options: PilotProductReaderOptions) {
	const baseUrl = options.supabaseUrl.replace(/\/+$/, '');
	const fetchImpl = options.fetchImpl ?? fetch;

	return {
		async getProduct(): Promise<PilotProductSnapshot> {
			if (!baseUrl || !options.publishableKey) {
				throw new Error('pilot_product_configuration_missing');
			}

			let response: Response;
			try {
				response = await fetchImpl(`${baseUrl}/rest/v1/rpc/get_pilot_product`, {
					method: 'POST',
					headers: {
						apikey: options.publishableKey,
						Authorization: `Bearer ${options.publishableKey}`,
						'Content-Type': 'application/json',
						Accept: 'application/json'
					},
					body: '{}',
					cache: 'no-store',
					signal: AbortSignal.timeout(8_000)
				});
			} catch {
				throw new Error('pilot_product_query_failed');
			}

			if (!response.ok) throw new Error('pilot_product_query_failed');

			let payload: unknown;
			try {
				payload = await response.json();
			} catch {
				throw new Error('pilot_product_invalid_payload');
			}

			if (!isProductSnapshot(payload)) throw new Error('pilot_product_invalid_payload');
			return payload;
		}
	};
}
