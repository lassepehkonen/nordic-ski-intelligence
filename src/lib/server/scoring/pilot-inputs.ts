/**
 * Pure mapper from the Phase 5 pilot product snapshot to Conditions Score inputs.
 *
 * Type-only coupling: imports pilot types as `import type`. No network, no fetch, no
 * DB, no clock — observation timestamps come from the source fields; the asOf clock is
 * the caller's concern (passed to computeConditionsScore by the caller).
 */
import type { WeatherPoint } from '../weather/adapters.js';
import type { PilotProductResort } from '../resorts/product-repository.js';
import type {
	CategoricalComponentInput,
	ConditionsScoreInputs,
	NumericComponentInput,
	RatioComponentInput
} from './types.js';

function numeric(
	value: number | null | undefined,
	observedAt: string | null
): NumericComponentInput {
	return { value: typeof value === 'number' && Number.isFinite(value) ? value : null, observedAt };
}

function ratio(
	open: number | null | undefined,
	total: number | null | undefined,
	observedAt: string | null
): RatioComponentInput {
	return {
		open: typeof open === 'number' && Number.isFinite(open) ? open : null,
		total: typeof total === 'number' && Number.isFinite(total) ? total : null,
		observedAt
	};
}

function categorical(value: null, observedAt: string | null): CategoricalComponentInput {
	return { value, observedAt };
}

/**
 * Sums forecast snowfall over the window (asOf, asOf + windowHours]. Interprets each
 * point's `snowfallMm` as a depth-equivalent rate in cm/h scaled by the point interval
 * (`precipitationPeriodHours`); points without a period or a value contribute their raw
 * amount. Points without any numeric snowfall inside the window leave the sum null:
 * a null value is missing data, not zero snowfall, so it must not mask fresh-snow
 * unknowns (phase 5 reality keeps snow depth / recent snowfall null, never inferred).
 */
export function forecastSnowfallCm(
	forecast: readonly WeatherPoint[],
	asOf: Date,
	windowHours: number
): { value: number | null; observedAt: string | null } {
	const windowMs = windowHours * 3_600_000;
	const windowEndMs = asOf.getTime() + windowMs;
	let sum = 0;
	let hasValue = false;
	let observedAt: string | null = null;
	for (const point of forecast) {
		const validMs = Date.parse(point.validAt);
		if (!Number.isFinite(validMs)) continue;
		if (validMs <= asOf.getTime() || validMs > windowEndMs) continue;
		if (point.snowfallMm !== null && Number.isFinite(point.snowfallMm)) {
			// SMHI/MET snowfall_amount is a depth-equivalent sum for the point's interval;
			// summing overlapping intervals would double-count, so overlap is dropped.
			sum += point.snowfallMm * (point.precipitationPeriodHours ?? 1);
			hasValue = true;
			if (observedAt === null || validMs > Date.parse(observedAt)) observedAt = point.validAt;
		}
	}
	return { value: hasValue ? roundCm(sum) : null, observedAt };
}

function roundCm(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/**
 * Maps one pilot product resort into the typed Conditions Score inputs.
 *
 * - `snowDepthCm` / `recentSnowCm` stay null when the source value is null (phase 5
 *   reality); they are never inferred from other fields.
 * - Ratio components keep open/total un-divided; the scoring layer's division guards
 *   decide unavailability (e.g. Iso-Syöte/Ylläs null counts, Riksgränsen missing totals).
 * - Weather temperature/wind come from the current WeatherPoint; `current: null` maps
 *   to null values with observedAt null.
 * - `snowQuality` is null everywhere today: not observed by any pilot source.
 */
export function mapPilotResortToConditionsScoreInputs(
	resort: PilotProductResort,
	forecastWindowHours: number,
	asOf: Date
): ConditionsScoreInputs {
	const statusObservedAt = resort.status.checkedAt;
	const current: WeatherPoint | null = resort.weather.current;
	const weatherObservedAt = current?.validAt ?? null;

	const forecastSnow = forecastSnowfallCm(resort.weather.forecast, asOf, forecastWindowHours);

	return {
		snowDepthCm: numeric(resort.weather.snow.depthCm, resort.weather.snow.observedAt),
		recentSnowCm: numeric(resort.weather.snow.recentSnowfall24hCm, resort.weather.snow.observedAt),
		forecastSnowCm: numeric(forecastSnow.value, forecastSnow.observedAt),
		terrainOpenRatio: ratio(
			resort.status.pistes.open,
			resort.status.pistes.total,
			statusObservedAt
		),
		liftsOpenRatio: ratio(resort.status.lifts.open, resort.status.lifts.total, statusObservedAt),
		temperatureC: numeric(current?.airTemperatureC ?? null, weatherObservedAt),
		windMs: numeric(current?.windSpeedMs ?? null, weatherObservedAt),
		// The pilot pipeline reports no snow-quality observation anywhere yet; the category
		// stays null and its observation time empty rather than borrowing another field's.
		snowQuality: categorical(null, null)
	};
}
