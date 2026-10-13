import { describe, expect, it } from 'vitest';
import type { WeatherForecast, WeatherPoint } from '../../src/lib/server/weather/adapters.js';
import { validateWeatherForecast } from '../../src/lib/server/weather/adapters.js';

function samplePoint(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
	return {
		validAt: '2026-10-12T12:00:00Z',
		latitude: 63.4,
		longitude: 13,
		airTemperatureC: 1,
		windSpeedMs: 3,
		windDirectionDegrees: 180,
		relativeHumidityPercent: 75,
		precipitationMm: 0,
		precipitationPeriodHours: 1,
		snowfallMm: null,
		snowDepthCm: null,
		symbolCode: null,
		...overrides
	};
}

function sampleForecast(points: WeatherPoint[]): WeatherForecast {
	return {
		provider: 'smhi',
		sourceUpdatedAt: '2026-10-12T11:00:00Z',
		latitude: 63.4,
		longitude: 13,
		points
	};
}

describe('weather forecast validation', () => {
	it('rejects suspicious measurements instead of clamping them', () => {
		const result = validateWeatherForecast(
			sampleForecast([samplePoint({ airTemperatureC: 95 })]),
			new Date('2026-10-12T11:30:00Z')
		);

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('temperature_out_of_range');
	});

	it('preserves null provider values and reports an empty measurement set', () => {
		const result = validateWeatherForecast(
			sampleForecast([
				samplePoint({
					airTemperatureC: null,
					windSpeedMs: null,
					windDirectionDegrees: null,
					relativeHumidityPercent: null,
					precipitationMm: null
				})
			]),
			new Date('2026-10-12T11:30:00Z')
		);

		expect(result.ok).toBe(false);
		expect(result.errors).toContain('forecast_has_no_measurements');
	});

	it('marks an old model run stale without replacing missing values with zero', () => {
		const result = validateWeatherForecast(
			sampleForecast([samplePoint({ snowfallMm: null, snowDepthCm: null })]),
			new Date('2026-10-13T12:00:00Z')
		);

		expect(result.ok).toBe(true);
		expect(result.warnings).toContain('weather_model_run_stale');
		expect(result.data?.points[0].snowfallMm).toBeNull();
		expect(result.data?.points[0].snowDepthCm).toBeNull();
	});
});
