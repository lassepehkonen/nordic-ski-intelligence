import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	parseFmiForecast,
	parseMetNoForecast,
	parseSmhiForecast
} from '../../src/lib/server/weather/adapters.js';

const fmiXml = readFileSync(new URL('../fixtures/weather/fmi-simple.xml', import.meta.url), 'utf8');
const smhiJson = JSON.parse(
	readFileSync(new URL('../fixtures/weather/smhi-point.json', import.meta.url), 'utf8')
);
const metNoJson = JSON.parse(
	readFileSync(new URL('../fixtures/weather/met-locationforecast.json', import.meta.url), 'utf8')
);

describe('national forecast parsers', () => {
	it('normalizes FMI simple-feature XML without a network request', () => {
		const result = parseFmiForecast(fmiXml);

		expect(result.ok).toBe(true);
		expect(result.data?.provider).toBe('fmi');
		expect(result.data?.sourceUpdatedAt).toBe('2026-10-12T11:33:05Z');
		expect(result.data?.points[0]).toMatchObject({
			validAt: '2026-10-12T12:00:00Z',
			latitude: 67.8014,
			longitude: 24.798,
			airTemperatureC: -0.1,
			windSpeedMs: 0.7,
			precipitationMm: 0,
			precipitationPeriodHours: 1
		});
		expect(result.data?.points[1].precipitationMm).toBeNull();
	});

	it('normalizes SMHI point JSON and preserves missing values as null', () => {
		const result = parseSmhiForecast(smhiJson);

		expect(result.ok).toBe(true);
		expect(result.data?.provider).toBe('smhi');
		expect(result.data?.sourceUpdatedAt).toBe('2026-10-12T11:16:35Z');
		expect(result.data?.points[0]).toMatchObject({
			validAt: '2026-10-12T12:00:00Z',
			latitude: 63.420869,
			longitude: 13.037606,
			airTemperatureC: -1,
			windSpeedMs: 4.5,
			windDirectionDegrees: 118,
			precipitationMm: 0
		});
		expect(result.data?.points[1].airTemperatureC).toBeNull();
	});

	it('normalizes MET Norway instant and interval forecast fields', () => {
		const result = parseMetNoForecast(metNoJson);

		expect(result.ok).toBe(true);
		expect(result.data?.provider).toBe('met-no');
		expect(result.data?.sourceUpdatedAt).toBe('2026-10-12T11:00:00Z');
		expect(result.data?.points[0]).toMatchObject({
			validAt: '2026-10-12T12:00:00Z',
			latitude: 61.31,
			longitude: 12.315,
			airTemperatureC: 2.1,
			windSpeedMs: 3.2,
			precipitationMm: 0.2,
			precipitationPeriodHours: 1
		});
		expect(result.data?.points[1].precipitationPeriodHours).toBe(6);
		expect(result.data?.points[1].airTemperatureC).toBeNull();
	});

	it('rejects malformed and null provider payloads rather than fabricating zeros', () => {
		expect(parseFmiForecast('<not-forecast/>').ok).toBe(false);
		expect(parseSmhiForecast(null).ok).toBe(false);
		expect(parseMetNoForecast({ properties: { timeseries: null } }).ok).toBe(false);
	});
});
