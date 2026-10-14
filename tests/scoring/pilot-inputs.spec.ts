import { describe, expect, it } from 'vitest';
import type { WeatherPoint } from '../../src/lib/server/weather/adapters.js';
import type { PilotProductResort } from '../../src/lib/server/resorts/product-repository.js';
import {
	forecastSnowfallCm,
	mapPilotResortToConditionsScoreInputs
} from '../../src/lib/server/scoring/pilot-inputs.js';
import { resolveConditionsScoreConfig } from '../../src/lib/server/scoring/config.js';
import { computeConditionsScore } from '../../src/lib/server/scoring/conditions-score.js';

const AS_OF = new Date('2026-12-01T12:00:00Z');

function weatherPoint(overrides: Partial<WeatherPoint> & { validAt: string }): WeatherPoint {
	return {
		latitude: 67.5,
		longitude: 24.2,
		airTemperatureC: null,
		windSpeedMs: null,
		windDirectionDegrees: null,
		relativeHumidityPercent: null,
		precipitationMm: null,
		precipitationPeriodHours: null,
		snowfallMm: null,
		snowDepthCm: null,
		symbolCode: null,
		...overrides
	};
}

function pilotResortFixture(): PilotProductResort {
	return {
		slug: 'levi',
		name: 'Levi',
		countryCode: 'FI',
		region: 'Kittilä, Lapland',
		size: 'large',
		location: {
			latitude: 67.8038,
			longitude: 24.8088,
			sourceUrl: 'https://example.com/location',
			attribution: 'Test'
		},
		inventory: { lifts: 28, pistes: 44, sourceUrl: 'https://example.com/inv', attribution: 'Test' },
		status: {
			lifts: { open: 3, total: 28 },
			pistes: { open: 3, total: 44 },
			freshness: 'fresh',
			checkedAt: '2026-12-01T10:00:00Z',
			sourceUrl: 'https://example.com/status',
			attribution: 'Test'
		},
		weather: {
			provider: 'fmi',
			sourceUrl: 'https://example.com/weather',
			attribution: 'Test',
			freshness: 'fresh',
			fetchedAt: '2026-12-01T11:50:00Z',
			sourceUpdatedAt: '2026-12-01T11:00:00Z',
			current: weatherPoint({
				validAt: '2026-12-01T11:00:00Z',
				airTemperatureC: -6.5,
				windSpeedMs: 4.2
			}),
			forecast: [
				weatherPoint({
					validAt: '2026-12-01T13:00:00Z',
					snowfallMm: 2,
					precipitationPeriodHours: 1
				}),
				weatherPoint({
					validAt: '2026-12-01T14:00:00Z',
					snowfallMm: 1.5,
					precipitationPeriodHours: 1
				}),
				weatherPoint({
					validAt: '2026-12-02T09:00:00Z',
					snowfallMm: 5,
					precipitationPeriodHours: 1
				}),
				// Outside the 48h window (asOf + 48h = 2026-12-03T12:00Z):
				weatherPoint({
					validAt: '2026-12-10T12:00:00Z',
					snowfallMm: 100,
					precipitationPeriodHours: 1
				})
			],
			snow: {
				depthCm: null,
				recentSnowfall24hCm: null,
				observedAt: null,
				sourceUrl: null
			}
		}
	};
}

describe('pilot inputs mapper', () => {
	it('maps the phase-5 data reality: snow fields stay null, weather and ratios map', () => {
		const resort = pilotResortFixture();
		const windowHours = resolveConditionsScoreConfig('v1.0').forecastWindowHours;
		const inputs = mapPilotResortToConditionsScoreInputs(resort, windowHours, AS_OF);

		// Nulls stay nulls — never inferred, never zero-filled.
		expect(inputs.snowDepthCm.value).toBeNull();
		expect(inputs.recentSnowCm.value).toBeNull();
		expect(inputs.snowDepthCm.observedAt).toBeNull();
		expect(inputs.recentSnowCm.observedAt).toBeNull();

		// Weather from the current point, observedAt from validAt.
		expect(inputs.temperatureC.value).toBe(-6.5);
		expect(inputs.windMs.value).toBe(4.2);
		expect(inputs.temperatureC.observedAt).toBe('2026-12-01T11:00:00Z');
		expect(inputs.windMs.observedAt).toBe('2026-12-01T11:00:00Z');

		// Ratios stay un-divided; the scoring layer owns guards.
		expect(inputs.terrainOpenRatio).toEqual({
			open: 3,
			total: 44,
			observedAt: '2026-12-01T10:00:00Z'
		});
		expect(inputs.liftsOpenRatio).toEqual({
			open: 3,
			total: 28,
			observedAt: '2026-12-01T10:00:00Z'
		});

		// Snow quality is not observed anywhere in the pilot pipeline.
		expect(inputs.snowQuality.value).toBeNull();
		expect(inputs.snowQuality.observedAt).toBeNull();
	});

	it('maps null current weather and empty forecast to null components', () => {
		const resort = pilotResortFixture();
		const stripped: PilotProductResort = {
			...resort,
			weather: {
				...resort.weather,
				current: null,
				forecast: [],
				freshness: 'unavailable',
				fetchedAt: null
			}
		};
		const inputs = mapPilotResortToConditionsScoreInputs(stripped, 48, AS_OF);

		expect(inputs.temperatureC.value).toBeNull();
		expect(inputs.temperatureC.observedAt).toBeNull();
		expect(inputs.windMs.value).toBeNull();
		expect(inputs.forecastSnowCm.value).toBeNull();
		expect(inputs.forecastSnowCm.observedAt).toBeNull();
	});

	it('null current point fields fall through to null component values', () => {
		const resort = pilotResortFixture();
		const sparse: PilotProductResort = {
			...resort,
			weather: {
				...resort.weather,
				current: weatherPoint({ validAt: '2026-12-01T11:00:00Z' })
			}
		};
		const inputs = mapPilotResortToConditionsScoreInputs(sparse, 48, AS_OF);

		expect(inputs.temperatureC.value).toBeNull();
		expect(inputs.windMs.value).toBeNull();
		// The point itself still carries its valid time.
		expect(inputs.temperatureC.observedAt).toBe('2026-12-01T11:00:00Z');
	});

	it('populated snow fields map with their observation time (future-proof path)', () => {
		const resort = pilotResortFixture();
		const withSnow: PilotProductResort = {
			...resort,
			weather: {
				...resort.weather,
				snow: {
					depthCm: 45,
					recentSnowfall24hCm: 6,
					observedAt: '2026-12-01T09:30:00Z',
					sourceUrl: 'https://example.com/snow'
				}
			}
		};
		const inputs = mapPilotResortToConditionsScoreInputs(withSnow, 48, AS_OF);

		expect(inputs.snowDepthCm.value).toBe(45);
		expect(inputs.recentSnowCm.value).toBe(6);
		expect(inputs.snowDepthCm.observedAt).toBe('2026-12-01T09:30:00Z');
		expect(inputs.recentSnowCm.observedAt).toBe('2026-12-01T09:30:00Z');
	});

	it('is a pure function: freezing the resort input does not break the mapping', () => {
		const resort = pilotResortFixture();
		const deepFreeze = (value: unknown): void => {
			if (value && typeof value === 'object') {
				Object.freeze(value);
				for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
			}
		};
		deepFreeze(resort);

		expect(() => mapPilotResortToConditionsScoreInputs(resort, 48, AS_OF)).not.toThrow();
	});

	it('uses the pilot forecast window from config end-to-end (sum feeds the score)', () => {
		const resort = pilotResortFixture();
		const windowHours = resolveConditionsScoreConfig('v1.0').forecastWindowHours;
		const inputs = mapPilotResortToConditionsScoreInputs(resort, windowHours, AS_OF);
		expect(inputs.forecastSnowCm.value).not.toBeNull();

		// The mapper output plugs straight into the score computation.
		const result = computeConditionsScore(inputs, 'v1.0', { now: () => AS_OF });
		const forecast = result.components.find((component) => component.id === 'forecast_snow');
		expect(forecast?.status).toBe('ok');
		// 2 + 1.5 + 5 = 8.5 cm in-window; the 100 point outside the window must not leak in.
		expect(forecast?.input.raw).toBe(8.5);
		// Coverage: snow depth (0.1), recent snow (0.15) and quality (0.05) missing → 0.7.
		expect(result.coverage.availableWeightShare).toBeCloseTo(0.7, 6);
	});
});

describe('forecast snowfall window', () => {
	it('sums snowfall strictly after asOf within the window and reports the last valid time', () => {
		const forecast = [
			weatherPoint({ validAt: '2026-12-01T11:00:00Z', snowfallMm: 99 }), // at asOf → excluded
			weatherPoint({ validAt: '2026-12-01T13:00:00Z', snowfallMm: 2, precipitationPeriodHours: 1 }),
			weatherPoint({
				validAt: '2026-12-01T14:00:00Z',
				snowfallMm: 1.5,
				precipitationPeriodHours: 1
			}),
			weatherPoint({ validAt: '2026-12-03T13:00:00Z', snowfallMm: 10, precipitationPeriodHours: 1 }) // > 48h
		];
		const { value, observedAt } = forecastSnowfallCm(forecast, AS_OF, 48);

		expect(value).toBe(3.5);
		expect(observedAt).toBe('2026-12-01T14:00:00Z');
	});

	it('returns null (missing), not 0, when no window point carries snowfall', () => {
		const forecast = [
			weatherPoint({ validAt: '2026-12-01T13:00:00Z' }),
			weatherPoint({ validAt: '2026-12-01T15:00:00Z', snowfallMm: null })
		];
		const { value, observedAt } = forecastSnowfallCm(forecast, AS_OF, 48);

		expect(value).toBeNull();
		expect(observedAt).toBeNull();
	});

	it('zero snowfall values inside the window are a measured zero', () => {
		const forecast = [weatherPoint({ validAt: '2026-12-01T13:00:00Z', snowfallMm: 0 })];
		const { value } = forecastSnowfallCm(forecast, AS_OF, 48);

		expect(value).toBe(0);
	});

	it('ignores points with malformed valid times', () => {
		const forecast = [
			weatherPoint({ validAt: 'not-a-time', snowfallMm: 5 }),
			weatherPoint({ validAt: '2026-12-01T13:00:00Z', snowfallMm: 2 })
		];
		const { value } = forecastSnowfallCm(forecast, AS_OF, 48);

		expect(value).toBe(2);
	});
});
