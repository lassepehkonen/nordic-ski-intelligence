import { createHttpCollector } from '../collect/collector.js';
import type { ParseResult, SourceConfig } from '../collect/types.js';
import type { PilotResort, WeatherProvider } from '../resorts/pilot.js';

export interface WeatherPoint {
	readonly validAt: string;
	readonly latitude: number | null;
	readonly longitude: number | null;
	readonly airTemperatureC: number | null;
	readonly windSpeedMs: number | null;
	readonly windDirectionDegrees: number | null;
	readonly relativeHumidityPercent: number | null;
	readonly precipitationMm: number | null;
	readonly precipitationPeriodHours: number | null;
	readonly snowfallMm: number | null;
	readonly snowDepthCm: number | null;
	readonly symbolCode: string | null;
}

export interface WeatherForecast {
	readonly provider: WeatherProvider;
	readonly sourceUpdatedAt: string | null;
	readonly latitude: number | null;
	readonly longitude: number | null;
	readonly points: ReadonlyArray<WeatherPoint>;
}

export interface CollectedWeatherForecast {
	readonly forecast: WeatherForecast;
	readonly providerRequests: number;
	readonly attempts: number;
	readonly cacheHit: boolean;
	readonly stale: boolean;
	readonly latencyMs: number;
	readonly fetchedAt: string;
	readonly sourceId: string;
	readonly endpoint: string;
}

export interface WeatherCollectorDeps {
	readonly fetchImpl?: typeof fetch;
	readonly now?: () => Date;
	sleep?: (ms: number) => Promise<void>;
	random?: () => number;
}

const MET_USER_AGENT =
	'NordicSkiIntelligence/0.0.1 (+https://github.com/lassepehkonen/nordic-ski-intelligence)';

function failure<T>(message: string): ParseResult<T> {
	return { ok: false, errors: [message], warnings: [], fatal: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string' || value.trim() === '') return null;
	const normalized = value.trim().toLowerCase();
	if (normalized === 'null' || normalized === 'nan' || normalized === '-9999') return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function validTimestamp(value: unknown): value is string {
	return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function escaped(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function xmlValue(xml: string, localName: string): string | null {
	const tag = escaped(localName);
	const expression = new RegExp(
		`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}\\s*>`,
		'i'
	);
	return expression.exec(xml)?.[1]?.trim() ?? null;
}

function emptyPoint(validAt: string, latitude: number, longitude: number): WeatherPoint {
	return {
		validAt,
		latitude,
		longitude,
		airTemperatureC: null,
		windSpeedMs: null,
		windDirectionDegrees: null,
		relativeHumidityPercent: null,
		precipitationMm: null,
		precipitationPeriodHours: null,
		snowfallMm: null,
		snowDepthCm: null,
		symbolCode: null
	};
}

function validCoordinates(latitude: number | null, longitude: number | null): boolean {
	return (
		latitude !== null &&
		longitude !== null &&
		latitude >= -90 &&
		latitude <= 90 &&
		longitude >= -180 &&
		longitude <= 180
	);
}

export function parseFmiForecast(xml: string): ParseResult<WeatherForecast> {
	if (typeof xml !== 'string' || xml.trim() === '') return failure('empty_fmi_response');
	if (/<(?:\w+:)?ExceptionReport\b/i.test(xml)) return failure('fmi_exception_response');

	const sourceUpdatedAt = /\btimeStamp="([^"]+)"/i.exec(xml)?.[1] ?? null;
	const points = new Map<string, WeatherPoint>();
	const blockPattern =
		/<(?:[\w.-]+:)?BsWfsElement\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?BsWfsElement\s*>/gi;
	let matchedBlocks = 0;

	for (const match of xml.matchAll(blockPattern)) {
		matchedBlocks += 1;
		const block = match[1];
		if (!block) continue;
		const validAt = xmlValue(block, 'Time');
		const parameter = xmlValue(block, 'ParameterName');
		const rawValue = xmlValue(block, 'ParameterValue');
		const position = xmlValue(block, 'pos')?.split(/\s+/).map(finiteNumber);
		if (!validTimestamp(validAt) || !parameter || !rawValue || !position || position.length < 2)
			continue;

		const latitude = position[0] ?? null;
		const longitude = position[1] ?? null;
		if (latitude === null || longitude === null || !validCoordinates(latitude, longitude)) continue;

		const key = validAt;
		const current = points.get(key) ?? emptyPoint(validAt, latitude, longitude);
		// HARMONIE reports NaN for "no snow at this point" — treat it as zero-measurable, not unknown.
		const isNoValue = rawValue.trim().toLowerCase() === 'nan';
		const value = isNoValue ? null : finiteNumber(rawValue);
		let next: WeatherPoint;
		switch (parameter) {
			case 'Temperature':
				if (value === null) continue;
				next = { ...current, airTemperatureC: value };
				break;
			case 'WindSpeedMS':
				if (value === null) continue;
				next = { ...current, windSpeedMs: value };
				break;
			case 'WindDirection':
				if (value === null) continue;
				next = { ...current, windDirectionDegrees: value };
				break;
			case 'Humidity':
				if (value === null) continue;
				next = { ...current, relativeHumidityPercent: value };
				break;
			case 'Precipitation1h':
				if (value === null) continue;
				next = { ...current, precipitationMm: value, precipitationPeriodHours: 1 };
				break;
			case 'SnowDepth':
				// FMI snow depth is in metres; the domain schema uses centimetres.
				next = { ...current, snowDepthCm: value === null ? 0 : value * 100 };
				break;
			default:
				continue;
		}
		points.set(key, next);
	}

	if (matchedBlocks === 0 || points.size === 0) return failure('no_fmi_forecast_points');
	if (sourceUpdatedAt !== null && !validTimestamp(sourceUpdatedAt))
		return failure('invalid_fmi_source_timestamp');

	// FMI's point query has no hourly snowfall parameter. Derive it the way national ski
	// services do: within an hour, precipitation falls as snow when the surface temperature
	// is at or below freezing (0.5 °C tolerance for melting flakes near 0 °C).
	for (const point of points.values()) {
		if (point.snowfallMm !== null) continue;
		if (
			point.precipitationMm !== null &&
			point.airTemperatureC !== null &&
			point.airTemperatureC <= 0.5
		) {
			points.set(point.validAt, { ...point, snowfallMm: point.precipitationMm });
		}
	}

	const ordered = [...points.values()].sort((a, b) => a.validAt.localeCompare(b.validAt));
	// FMI HARMONIE publishes model output progressively (runs ~every 6 h). Far-horizon hours
	// can arrive as EMPTY <ParameterValue/> placeholders — keeping them would render half-empty
	// forecast days. Stop the series at the last hour where any of temp/wind/precip carries a
	// real value; SnowDepth alone does not extend the series.
	let lastUsableIndex = -1;
	for (let index = 0; index < ordered.length; index += 1) {
		const point = ordered[index];
		const hasRealValue =
			point.airTemperatureC !== null ||
			point.windSpeedMs !== null ||
			point.precipitationMm !== null;
		if (hasRealValue) lastUsableIndex = index;
	}
	const usable = ordered.slice(0, lastUsableIndex + 1);
	if (usable.length === 0) return failure('fmi_forecast_empty_series');

	return {
		ok: true,
		data: {
			provider: 'fmi',
			sourceUpdatedAt,
			latitude: usable[0]?.latitude ?? null,
			longitude: usable[0]?.longitude ?? null,
			points: usable
		},
		errors: [],
		warnings: [],
		fatal: false
	};
}

export function parseSmhiForecast(input: unknown): ParseResult<WeatherForecast> {
	if (!isRecord(input)) return failure('invalid_smhi_payload');
	const geometry = isRecord(input.geometry) ? input.geometry : null;
	const coordinates = geometry?.coordinates;
	const timeSeries = input.timeSeries;
	if (!Array.isArray(coordinates) || coordinates.length < 2 || !Array.isArray(timeSeries))
		return failure('invalid_smhi_forecast_shape');

	const longitude = finiteNumber(coordinates[0]);
	const latitude = finiteNumber(coordinates[1]);
	if (latitude === null || longitude === null || !validCoordinates(latitude, longitude))
		return failure('invalid_smhi_coordinates');
	const sourceUpdatedAt = validTimestamp(input.createdTime) ? input.createdTime : null;
	const points: WeatherPoint[] = [];

	for (const item of timeSeries) {
		if (!isRecord(item) || !validTimestamp(item.time) || !isRecord(item.data)) continue;
		const data = item.data;
		const intervalStart = validTimestamp(item.intervalParametersStartTime)
			? item.intervalParametersStartTime
			: null;
		const elapsedHours = intervalStart
			? (Date.parse(item.time) - Date.parse(intervalStart)) / 3_600_000
			: null;
		const precipitation = finiteNumber(data.precipitation_amount_mean);
		points.push({
			...emptyPoint(item.time, latitude, longitude),
			airTemperatureC: finiteNumber(data.air_temperature),
			windSpeedMs: finiteNumber(data.wind_speed),
			windDirectionDegrees: finiteNumber(data.wind_from_direction),
			relativeHumidityPercent: finiteNumber(data.relative_humidity),
			precipitationMm: precipitation,
			precipitationPeriodHours:
				elapsedHours !== null && elapsedHours > 0 && elapsedHours <= 24 ? elapsedHours : null,
			snowfallMm: finiteNumber(data.snowfall_amount),
			snowDepthCm: finiteNumber(data.snow_depth),
			symbolCode: typeof data.symbol_code === 'string' ? data.symbol_code : null
		});
	}

	if (points.length === 0) return failure('no_smhi_forecast_points');
	return {
		ok: true,
		data: { provider: 'smhi', sourceUpdatedAt, latitude, longitude, points },
		errors: [],
		warnings: sourceUpdatedAt ? [] : ['smhi_created_time_missing'],
		fatal: false
	};
}

function precipitationInterval(data: Record<string, unknown>): {
	amount: number | null;
	hours: number | null;
	symbol: string | null;
	snowfall: number | null;
} {
	for (const [key, hours] of [
		['next_1_hours', 1],
		['next_6_hours', 6],
		['next_12_hours', 12]
	] as const) {
		const interval = data[key];
		if (!isRecord(interval)) continue;
		const details = isRecord(interval.details) ? interval.details : {};
		const summary = isRecord(interval.summary) ? interval.summary : {};
		const amount = finiteNumber(details.precipitation_amount);
		if (amount !== null) {
			return {
				amount,
				hours,
				symbol: typeof summary.symbol_code === 'string' ? summary.symbol_code : null,
				snowfall: finiteNumber(details.snowfall_amount)
			};
		}
	}
	return { amount: null, hours: null, symbol: null, snowfall: null };
}

export function parseMetNoForecast(input: unknown): ParseResult<WeatherForecast> {
	if (!isRecord(input) || !isRecord(input.properties)) return failure('invalid_met_payload');
	const properties = input.properties;
	const meta = isRecord(properties.meta) ? properties.meta : {};
	const geometry = isRecord(input.geometry) ? input.geometry : null;
	const coordinates = geometry?.coordinates;
	const timeSeries = properties.timeseries;
	if (!Array.isArray(coordinates) || coordinates.length < 2 || !Array.isArray(timeSeries))
		return failure('invalid_met_forecast_shape');

	const longitude = finiteNumber(coordinates[0]);
	const latitude = finiteNumber(coordinates[1]);
	if (latitude === null || longitude === null || !validCoordinates(latitude, longitude))
		return failure('invalid_met_coordinates');
	const sourceUpdatedAt = validTimestamp(meta.updated_at) ? meta.updated_at : null;
	const points: WeatherPoint[] = [];

	for (const item of timeSeries) {
		if (!isRecord(item) || !validTimestamp(item.time) || !isRecord(item.data)) continue;
		const data = item.data;
		const instant =
			isRecord(data.instant) && isRecord(data.instant.details) ? data.instant.details : {};
		const interval = precipitationInterval(data);
		points.push({
			...emptyPoint(item.time, latitude, longitude),
			airTemperatureC: finiteNumber(instant.air_temperature),
			windSpeedMs: finiteNumber(instant.wind_speed),
			windDirectionDegrees: finiteNumber(instant.wind_from_direction),
			relativeHumidityPercent: finiteNumber(instant.relative_humidity),
			precipitationMm: interval.amount,
			precipitationPeriodHours: interval.hours,
			snowfallMm: interval.snowfall,
			snowDepthCm: finiteNumber(instant.snow_depth),
			symbolCode: interval.symbol
		});
	}

	if (points.length === 0) return failure('no_met_forecast_points');
	return {
		ok: true,
		data: { provider: 'met-no', sourceUpdatedAt, latitude, longitude, points },
		errors: [],
		warnings: sourceUpdatedAt ? [] : ['met_updated_at_missing'],
		fatal: false
	};
}

const MAX_WEATHER_MODEL_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_FUTURE_MODEL_SKEW_MS = 5 * 60 * 1000;

export function validateWeatherForecast(
	forecast: WeatherForecast,
	now = new Date()
): ParseResult<WeatherForecast> {
	const errors: string[] = [];
	const warnings: string[] = [];
	if (forecast.points.length === 0) errors.push('forecast_has_no_measurements');
	if (
		forecast.latitude === null ||
		forecast.longitude === null ||
		!validCoordinates(forecast.latitude, forecast.longitude)
	) {
		errors.push('invalid_forecast_coordinates');
	}

	if (forecast.sourceUpdatedAt === null) {
		warnings.push('weather_model_timestamp_missing');
	} else if (!validTimestamp(forecast.sourceUpdatedAt)) {
		errors.push('invalid_weather_model_timestamp');
	} else {
		const ageMs = now.getTime() - Date.parse(forecast.sourceUpdatedAt);
		if (ageMs < -MAX_FUTURE_MODEL_SKEW_MS) errors.push('weather_model_timestamp_future');
		if (ageMs > MAX_WEATHER_MODEL_AGE_MS) warnings.push('weather_model_run_stale');
	}

	let hasAnyMeasurement = false;
	for (const point of forecast.points) {
		if (!validTimestamp(point.validAt)) errors.push('invalid_forecast_valid_time');
		const measurements = [
			point.airTemperatureC,
			point.windSpeedMs,
			point.windDirectionDegrees,
			point.relativeHumidityPercent,
			point.precipitationMm,
			point.snowfallMm,
			point.snowDepthCm
		];
		if (measurements.some((value) => value !== null)) hasAnyMeasurement = true;
		if (
			point.airTemperatureC !== null &&
			(point.airTemperatureC < -80 || point.airTemperatureC > 60)
		)
			errors.push('temperature_out_of_range');
		if (point.windSpeedMs !== null && (point.windSpeedMs < 0 || point.windSpeedMs > 100))
			errors.push('wind_speed_out_of_range');
		if (
			point.windDirectionDegrees !== null &&
			(point.windDirectionDegrees < 0 || point.windDirectionDegrees > 360)
		)
			errors.push('wind_direction_out_of_range');
		if (
			point.relativeHumidityPercent !== null &&
			(point.relativeHumidityPercent < 0 || point.relativeHumidityPercent > 100)
		)
			errors.push('humidity_out_of_range');
		if (
			point.precipitationMm !== null &&
			(point.precipitationMm < 0 || point.precipitationMm > 500)
		)
			errors.push('precipitation_out_of_range');
		if (
			point.precipitationPeriodHours !== null &&
			(point.precipitationPeriodHours <= 0 || point.precipitationPeriodHours > 24)
		)
			errors.push('precipitation_period_out_of_range');
		if (point.snowfallMm !== null && (point.snowfallMm < 0 || point.snowfallMm > 500))
			errors.push('snowfall_out_of_range');
		if (point.snowDepthCm !== null && (point.snowDepthCm < 0 || point.snowDepthCm > 2000))
			errors.push('snow_depth_out_of_range');
	}
	if (!hasAnyMeasurement) errors.push('forecast_has_no_measurements');

	const uniqueErrors = [...new Set(errors)];
	if (uniqueErrors.length > 0) return { ok: false, errors: uniqueErrors, warnings, fatal: true };
	return { ok: true, data: forecast, errors: [], warnings, fatal: false };
}

function fmiEndpoint(resort: PilotResort): string {
	const url = new URL('https://opendata.fmi.fi/wfs');
	url.searchParams.set('service', 'WFS');
	url.searchParams.set('version', '2.0.0');
	url.searchParams.set('request', 'getFeature');
	url.searchParams.set('storedquery_id', 'fmi::forecast::harmonie::surface::point::simple');
	url.searchParams.set('latlon', `${resort.location.latitude},${resort.location.longitude}`);
	// SnowDepth: HARMONIE serves snow depth at the point (NaN when no snow). Used for
	// snowDepthCm; hourly snowfall is derived at parse time from precipitation + temperature.
	url.searchParams.set(
		'parameters',
		'Temperature,WindSpeedMS,WindDirection,Precipitation1h,SnowDepth'
	);
	// Four days of day-by-day forecasting: HARMONIE serves up to ~108 hourly steps
	// only when an explicit endtime is passed (default stops at 50).
	url.searchParams.set('timestep', '60');
	url.searchParams.set(
		'endtime',
		new Date(Date.now() + 108 * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z')
	);
	return url.toString();
}

export function weatherSourceFor(resort: PilotResort): SourceConfig {
	const common = {
		requestTimeoutMs: 12_000,
		retry: { maxAttempts: 3, baseMs: 500, capMs: 4_000, jitterRatio: 0.2 },
		rateLimit: { requestsPerWindow: 10, windowMs: 60_000 },
		cacheTtlMs: 3_600_000,
		staleAfterMs: 21_600_000
	} as const;

	if (resort.weather.provider === 'fmi') {
		return {
			...common,
			sourceId: 'fmi-harmonie-pilot',
			sourceKind: 'national_api',
			endpoint: fmiEndpoint(resort),
			requestAccept: 'application/xml'
		};
	}

	if (resort.weather.provider === 'smhi') {
		const { latitude, longitude } = resort.location;
		return {
			...common,
			sourceId: 'smhi-snow1g-pilot',
			sourceKind: 'national_api',
			endpoint: `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${longitude}/lat/${latitude}/data.json`,
			requestAccept: 'application/json'
		};
	}

	const { latitude, longitude } = resort.location;
	return buildMetNoSource(resort, { latitude, longitude });
}

function buildMetNoSource(
	resort: PilotResort,
	location?: { latitude: number; longitude: number }
): SourceConfig {
	const { latitude, longitude } = location ?? resort.location;
	const common = {
		requestTimeoutMs: 12_000,
		retry: { maxAttempts: 3, baseMs: 500, capMs: 4_000, jitterRatio: 0.2 },
		rateLimit: { requestsPerWindow: 10, windowMs: 60_000 },
		cacheTtlMs: 3_600_000,
		staleAfterMs: 21_600_000
	} as const;
	const metNoSource: SourceConfig = {
		...common,
		sourceId: 'met-locationforecast-pilot',
		sourceKind: 'national_api',
		endpoint: `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude}&lon=${longitude}`,
		requestAccept: 'application/json',
		requestUserAgent: MET_USER_AGENT
	};
	return metNoSource;
}

/** Hours beyond which a national model series is treated as too short for a 4-day forecast. */
const MIN_FORECAST_COVERAGE_HOURS = 90;

async function extendShortSeries(
	resort: PilotResort,
	forecast: WeatherForecast,
	collector: ReturnType<typeof createHttpCollector>,
	collectedWarnings: ReadonlyArray<string>
): Promise<{ data: WeatherForecast | null; warnings: ReadonlyArray<string> }> {
	const lastPoint = forecast.points.at(-1);
	const nowMs = Date.now();
	const horizonOk =
		!!lastPoint &&
		Number.isFinite(Date.parse(lastPoint.validAt)) &&
		Date.parse(lastPoint.validAt) - nowMs >= MIN_FORECAST_COVERAGE_HOURS * 3_600_000;
	if (horizonOk || resort.weather.provider !== 'fmi') {
		return { data: null, warnings: collectedWarnings };
	}

	// FMI HARMONIE sometimes publishes only ~60 h mid-cycle. met.no locationforecast carries
	// the full horizon for the same coordinates, so top up the missing hours from it.
	const collected = await collector.collect(buildMetNoSource(resort));
	if (!collected.ok || !collected.data) {
		return {
			data: null,
			warnings: [...collectedWarnings, 'fmi_series_short_without_met_no_fallback']
		};
	}
	const parsed = decodeBody('met-no', collected.data.body);
	if (!parsed.ok || !parsed.data) {
		return { data: null, warnings: [...collectedWarnings, 'fmi_series_short_met_no_unparseable'] };
	}

	const byTimestamp = new Map(forecast.points.map((p) => [p.validAt, p]));
	for (const point of parsed.data.points) {
		const existing = byTimestamp.get(point.validAt);
		if (existing && existing.airTemperatureC !== null) continue;
		byTimestamp.set(point.validAt, existing ? { ...existing, ...filled(existing, point) } : point);
	}
	const merged = [...byTimestamp.values()].sort((a, b) => a.validAt.localeCompare(b.validAt));
	return {
		data: { ...forecast, points: merged },
		warnings: [...collectedWarnings, 'fmi_series_extended_with_met_no']
	};
}

/** Fill null fields of `base` with real values from `donor` (donor wins only where base is null). */
function filled(base: WeatherPoint, donor: WeatherPoint): WeatherPoint {
	return {
		...base,
		airTemperatureC: base.airTemperatureC ?? donor.airTemperatureC,
		windSpeedMs: base.windSpeedMs ?? donor.windSpeedMs,
		windDirectionDegrees: base.windDirectionDegrees ?? donor.windDirectionDegrees,
		relativeHumidityPercent: base.relativeHumidityPercent ?? donor.relativeHumidityPercent,
		precipitationMm: base.precipitationMm ?? donor.precipitationMm,
		snowfallMm: base.snowfallMm ?? donor.snowfallMm,
		snowDepthCm: base.snowDepthCm ?? donor.snowDepthCm,
		symbolCode: base.symbolCode ?? donor.symbolCode
	};
}

function decodeBody(provider: WeatherProvider, body: unknown): ParseResult<WeatherForecast> {
	if (provider === 'fmi') return parseFmiForecast(typeof body === 'string' ? body : '');
	if (typeof body !== 'string') return failure(`invalid_${provider}_body`);
	try {
		const value: unknown = JSON.parse(body);
		return provider === 'smhi' ? parseSmhiForecast(value) : parseMetNoForecast(value);
	} catch {
		return failure(`malformed_${provider}_json`);
	}
}

export async function collectResortForecast(
	resort: PilotResort,
	collector = createHttpCollector()
): Promise<ParseResult<CollectedWeatherForecast>> {
	const source = weatherSourceFor(resort);
	const collected = await collector.collect(source);
	if (!collected.ok || !collected.data) {
		return {
			ok: false,
			errors: collected.errors,
			warnings: collected.warnings,
			fatal: true,
			providerRequests: collected.providerRequests ?? 0
		};
	}

	const parsed = decodeBody(resort.weather.provider, collected.data.body);
	if (!parsed.ok || !parsed.data) {
		return {
			ok: false,
			errors: parsed.errors,
			warnings: parsed.warnings,
			fatal: true,
			providerRequests: collected.providerRequests ?? 0
		};
	}
	const validated = validateWeatherForecast(parsed.data);
	if (!validated.ok || !validated.data) {
		return {
			ok: false,
			errors: validated.errors,
			warnings: [...collected.warnings, ...parsed.warnings, ...validated.warnings],
			fatal: true,
			providerRequests: collected.providerRequests ?? 0
		};
	}

	const extension = await extendShortSeries(resort, validated.data, collector, [
		...collected.warnings,
		...parsed.warnings,
		...validated.warnings
	]);

	return {
		ok: true,
		data: {
			forecast: extension.data ?? validated.data,
			providerRequests: collected.providerRequests ?? 0,
			attempts: collected.data.attempts,
			cacheHit: collected.data.cacheHit,
			stale: collected.data.stale || validated.warnings.includes('weather_model_run_stale'),
			latencyMs: collected.data.durationMs,
			fetchedAt: collected.data.fetchedAt,
			sourceId: collected.data.sourceId,
			endpoint: collected.data.endpoint
		},
		errors: [],
		warnings: extension.warnings,
		providerRequests: collected.providerRequests ?? 0,
		fatal: false
	};
}
