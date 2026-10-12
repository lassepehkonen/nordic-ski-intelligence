/**
 * Illustrative sample conditions adapter.
 *
 * This is deliberately *not* a collector: it produces a deterministic, clearly labelled dataset
 * (`dataState: 'illustrative'`, confidence `low`) so the product UI, freshness states and the
 * scoring path can be exercised before any source is rights-approved (ADR-0008). Observation
 * timestamps are derived from the current request time so freshness display can be demonstrated;
 * the snow, weather and forecast values themselves are hand-authored sample values, not
 * measurements. Replacing this file with an approved collector changes nothing in the UI.
 */

import type {
	Confidence,
	ForecastPoint,
	ForecastSeries,
	Observation,
	Resort,
	ResortConditions,
	SnowQuality,
	ValidationState,
	WeatherObservation,
	WeatherStation
} from '../domain/types.js';
import { RESORTS, findResort } from './resorts.js';
import { SAMPLE_CONDITIONS_SOURCE } from './sources.js';

interface SampleBase {
	snowDepthCm: number;
	newSnow24hCm: number;
	newSnow72hCm: number;
	forecastSnow72hCm: number;
	openPistes: number;
	openLifts: number;
	temperatureC: number;
	windMs: number;
	precipitationMm: number;
	snowQuality: SnowQuality;
	stationName: string;
	stationDistanceKm: number;
	/** Minutes since the sample feed "fetched" this snapshot; drives the freshness state. */
	fetchedMinutesAgo: number;
	/** Hours the source claims the snapshot is valid for after fetching. */
	validityHours: number;
	validationState?: ValidationState;
}

const SAMPLE: Readonly<Record<string, SampleBase>> = {
	levi: {
		snowDepthCm: 78,
		newSnow24hCm: 12,
		newSnow72hCm: 28,
		forecastSnow72hCm: 22,
		openPistes: 37,
		openLifts: 23,
		temperatureC: -11.4,
		windMs: 4.2,
		precipitationMm: 1.2,
		snowQuality: 'powder',
		stationName: 'Kittilä sample station',
		stationDistanceKm: 14,
		fetchedMinutesAgo: 26,
		validityHours: 6
	},
	yllas: {
		snowDepthCm: 92,
		newSnow24hCm: 18,
		newSnow72hCm: 41,
		forecastSnow72hCm: 26,
		openPistes: 57,
		openLifts: 27,
		temperatureC: -13.1,
		windMs: 5.1,
		precipitationMm: 0.4,
		snowQuality: 'powder',
		stationName: 'Kolari sample station',
		stationDistanceKm: 9,
		fetchedMinutesAgo: 18,
		validityHours: 6
	},
	ruka: {
		snowDepthCm: 64,
		newSnow24hCm: 6,
		newSnow72hCm: 14,
		forecastSnow72hCm: 11,
		openPistes: 30,
		openLifts: 18,
		temperatureC: -8.2,
		windMs: 6.4,
		precipitationMm: 0.2,
		snowQuality: 'packed',
		stationName: 'Kuusamo sample station',
		stationDistanceKm: 21,
		fetchedMinutesAgo: 34,
		validityHours: 6
	},
	tahko: {
		snowDepthCm: 41,
		newSnow24hCm: 2,
		newSnow72hCm: 5,
		forecastSnow72hCm: 6,
		openPistes: 15,
		openLifts: 10,
		temperatureC: -2.8,
		windMs: 3.1,
		precipitationMm: 0,
		snowQuality: 'packed',
		stationName: 'Kuopio sample station',
		stationDistanceKm: 32,
		// A stale snapshot: fetched over a day ago with an 18-hour validity window.
		fetchedMinutesAgo: 1900,
		validityHours: 18
	},
	are: {
		snowDepthCm: 105,
		newSnow24hCm: 24,
		newSnow72hCm: 58,
		forecastSnow72hCm: 34,
		openPistes: 75,
		openLifts: 37,
		temperatureC: -9.3,
		windMs: 7.2,
		precipitationMm: 3.4,
		snowQuality: 'powder',
		stationName: 'Åre sample station',
		stationDistanceKm: 6,
		fetchedMinutesAgo: 12,
		validityHours: 6
	},
	salen: {
		snowDepthCm: 88,
		newSnow24hCm: 15,
		newSnow72hCm: 33,
		forecastSnow72hCm: 19,
		openPistes: 93,
		openLifts: 83,
		temperatureC: -7.1,
		windMs: 4.8,
		precipitationMm: 1.1,
		snowQuality: 'packed',
		stationName: 'Malung sample station',
		stationDistanceKm: 17,
		fetchedMinutesAgo: 41,
		validityHours: 6
	},
	vemdalen: {
		snowDepthCm: 72,
		newSnow24hCm: 9,
		newSnow72hCm: 21,
		forecastSnow72hCm: 15,
		openPistes: 44,
		openLifts: 28,
		temperatureC: -5.4,
		windMs: 5.5,
		precipitationMm: 0.8,
		snowQuality: 'packed',
		stationName: 'Härjedalen sample station',
		stationDistanceKm: 11,
		fetchedMinutesAgo: 55,
		validityHours: 6
	},
	trysil: {
		snowDepthCm: 96,
		newSnow24hCm: 21,
		newSnow72hCm: 47,
		forecastSnow72hCm: 29,
		openPistes: 60,
		openLifts: 28,
		temperatureC: -10.2,
		windMs: 6.1,
		precipitationMm: 2.7,
		snowQuality: 'powder',
		stationName: 'Trysil sample station',
		stationDistanceKm: 8,
		fetchedMinutesAgo: 22,
		validityHours: 6
	},
	hemsedal: {
		snowDepthCm: 118,
		newSnow24hCm: 27,
		newSnow72hCm: 63,
		forecastSnow72hCm: 38,
		openPistes: 47,
		openLifts: 19,
		temperatureC: -8.4,
		windMs: 8.4,
		precipitationMm: 4.9,
		snowQuality: 'powder',
		stationName: 'Hemsedal sample station',
		stationDistanceKm: 5,
		fetchedMinutesAgo: 15,
		validityHours: 6
	},
	hafjell: {
		snowDepthCm: 69,
		newSnow24hCm: 4,
		newSnow72hCm: 11,
		forecastSnow72hCm: 9,
		openPistes: 12,
		openLifts: 7,
		temperatureC: -6.2,
		windMs: 3.6,
		precipitationMm: 0.5,
		snowQuality: 'wet',
		stationName: 'Øyer sample station',
		stationDistanceKm: 7,
		fetchedMinutesAgo: 95,
		validityHours: 6,
		// Reported, but not yet validated by the product: stays visible and lowers confidence.
		validationState: 'needs_review'
	}
};

const SAMPLE_CONFIDENCE: Confidence = 'low';

/** Fixed per-day offsets keep the sample forecast deterministic across requests. */
const TEMP_MIN_OFFSETS = [-2.5, -3.5, -1.5, 1, 2.5];
const TEMP_MAX_OFFSETS = [0.5, -0.5, 1.5, 3.5, 5];
const WIND_OFFSETS = [0, 1.4, 2.2, -0.9, -1.8];
const SNOW_SHARES = [0.4, 0.25, 0.15, 0.12, 0.08];

function hoursToMs(hours: number): number {
	return hours * 3_600_000;
}

function sampleObservation(
	resortId: string,
	metric: Observation['metric'],
	value: number | SnowQuality,
	unit: string | null,
	base: SampleBase,
	now: Date
): Observation {
	const fetchedAt = new Date(now.getTime() - base.fetchedMinutesAgo * 60_000);
	const observedAt = new Date(fetchedAt.getTime() - 35 * 60_000);
	return {
		resortId,
		metric,
		value,
		unit,
		observedAt: observedAt.toISOString(),
		fetchedAt: fetchedAt.toISOString(),
		validUntil: new Date(fetchedAt.getTime() + hoursToMs(base.validityHours)).toISOString(),
		validationState: base.validationState ?? 'pending',
		confidence: SAMPLE_CONFIDENCE,
		dataState: 'illustrative',
		sourceId: SAMPLE_CONDITIONS_SOURCE.id
	};
}

function buildForecast(resort: Resort, base: SampleBase, now: Date): ForecastSeries {
	const startOfToday = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	);
	const points: ForecastPoint[] = TEMP_MIN_OFFSETS.map((minOffset, index) => ({
		date: new Date(startOfToday.getTime() + index * 86_400_000).toISOString().slice(0, 10),
		tempMinC: Math.round((base.temperatureC + minOffset) * 10) / 10,
		tempMaxC: Math.round((base.temperatureC + (TEMP_MAX_OFFSETS[index] ?? 0)) * 10) / 10,
		snowCm: Math.round(base.forecastSnow72hCm * (SNOW_SHARES[index] ?? 0) * 10) / 10,
		windMs: Math.round((base.windMs + (WIND_OFFSETS[index] ?? 0)) * 10) / 10,
		precipitationMm:
			Math.round(base.precipitationMm * (SNOW_SHARES[index] ?? 0) * 10 * 10) / 10
	}));

	return {
		resortId: resort.id,
		issuedAt: new Date(now.getTime() - 40 * 60_000).toISOString(),
		points,
		sourceId: SAMPLE_CONDITIONS_SOURCE.id,
		dataState: 'illustrative'
	};
}

/**
 * Builds the sample condition snapshot for one resort, or `null` when the resort has no sample
 * record (a real repository would return `unavailable` rather than inventing values).
 */
export function buildSampleConditions(resortId: string, now: Date): ResortConditions | null {
	const resort = findResort(resortId);
	const base = SAMPLE[resortId];
	if (!resort || !base) return null;

	const observations: Observation[] = [
		sampleObservation(resortId, 'snow_depth_cm', base.snowDepthCm, 'cm', base, now),
		sampleObservation(resortId, 'new_snow_24h_cm', base.newSnow24hCm, 'cm', base, now),
		sampleObservation(resortId, 'new_snow_72h_cm', base.newSnow72hCm, 'cm', base, now),
		sampleObservation(
			resortId,
			'forecast_snow_72h_cm',
			base.forecastSnow72hCm,
			'cm',
			base,
			now
		),
		sampleObservation(resortId, 'snow_quality', base.snowQuality, null, base, now)
	];

	// Piste and lift totals come from the sourced resort facts; when a resort has no reported
	// totals, the open/ratio inputs stay missing instead of being invented (coverage drops).
	if (resort.terrain.pistes !== null) {
		observations.push(
			sampleObservation(resortId, 'open_pistes', base.openPistes, null, base, now),
			sampleObservation(resortId, 'total_pistes', resort.terrain.pistes, null, base, now)
		);
	}
	if (resort.terrain.lifts !== null) {
		observations.push(
			sampleObservation(resortId, 'open_lifts', base.openLifts, null, base, now),
			sampleObservation(resortId, 'total_lifts', resort.terrain.lifts, null, base, now)
		);
	}

	const station: WeatherStation = {
		id: `${resortId}-sample-station`,
		name: base.stationName,
		distanceKm: base.stationDistanceKm
	};

	const weather: WeatherObservation[] = [
		{
			...sampleObservation(resortId, 'temperature_c', base.temperatureC, '°C', base, now),
			metric: 'temperature_c',
			value: base.temperatureC
		},
		{
			...sampleObservation(resortId, 'wind_ms', base.windMs, 'm/s', base, now),
			metric: 'wind_ms',
			value: base.windMs
		},
		{
			...sampleObservation(resortId, 'precipitation_mm', base.precipitationMm, 'mm', base, now),
			metric: 'precipitation_mm',
			value: base.precipitationMm
		}
	];

	const fetchedTimes = [...observations, ...weather].map((observation) =>
		new Date(observation.fetchedAt).getTime()
	);

	return {
		resortId,
		observations,
		weather,
		station,
		forecast: buildForecast(resort, base, now),
		lastUpdated: new Date(Math.max(...fetchedTimes)).toISOString(),
		dataState: 'illustrative'
	};
}

export function listSampleResortIds(): string[] {
	return RESORTS.filter((resort) => resort.id in SAMPLE).map((resort) => resort.id);
}
