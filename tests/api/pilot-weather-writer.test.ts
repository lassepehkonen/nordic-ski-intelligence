import { describe, expect, it } from 'vitest';
import { createPilotWeatherWriter } from '../../src/lib/server/resorts/weather-writer.js';
import type { PilotWeatherRun } from '../../src/lib/server/weather/runner.js';

const point = {
	validAt: '2026-10-12T12:00:00Z',
	latitude: 67.8,
	longitude: 24.8,
	airTemperatureC: -2.5,
	windSpeedMs: 4,
	windDirectionDegrees: 180,
	relativeHumidityPercent: 70,
	precipitationMm: 0,
	precipitationPeriodHours: 1,
	snowfallMm: 0,
	snowDepthCm: null,
	symbolCode: 'clearsky_day'
} as const;

const run: PilotWeatherRun = {
	runId: 'fbfb9707-145e-4bbc-8060-e52c63f7556b',
	startedAt: '2026-10-12T11:59:00Z',
	endedAt: '2026-10-12T12:01:00Z',
	results: [
		{
			slug: 'levi',
			provider: 'fmi',
			ok: true,
			data: {
				forecast: {
					provider: 'fmi',
					sourceUpdatedAt: '2026-10-12T11:50:00Z',
					latitude: 67.8,
					longitude: 24.8,
					points: [point]
				},
				providerRequests: 1,
				attempts: 1,
				cacheHit: false,
				stale: false,
				latencyMs: 1200,
				fetchedAt: '2026-10-12T12:00:00Z',
				sourceId: 'weather:fmi:levi',
				endpoint: 'https://opendata.fmi.fi/test'
			},
			errors: [],
			warnings: [],
			providerRequests: 1
		},
		{
			slug: 'ruka',
			provider: 'fmi',
			ok: false,
			errors: ['timeout'],
			warnings: [],
			providerRequests: 1
		}
	],
	successCount: 1,
	failureCount: 1,
	staleCount: 0,
	totalProviderRequests: 2,
	providerRequestsByProvider: { fmi: 2, smhi: 0, 'met-no': 0 },
	sourceHealth: {}
};

describe('pilot weather writer', () => {
	it('stores only normalized weather fields and persists actual provider request counts', async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const fetchImpl: typeof fetch = async (input, init = {}) => {
			calls.push({ url: String(input), init });
			return new Response(null, { status: 204 });
		};
		const writer = createPilotWeatherWriter({
			supabaseUrl: 'https://ugeoxrfagumamxyhqnjw.supabase.co',
			serviceRoleKey: 'service-role-test',
			fetchImpl,
			now: () => new Date('2026-10-12T12:02:00Z')
		});

		await writer.persistRun(run);

		expect(calls).toHaveLength(3);
		const leviPatch = calls.find((call) => call.url.includes('slug=eq.levi'));
		const rukaPatch = calls.find((call) => call.url.includes('slug=eq.ruka'));
		const runInsert = calls.find((call) => call.url.endsWith('/pilot_collection_runs'));
		expect(leviPatch?.init.method).toBe('PATCH');
		expect(JSON.parse(String(leviPatch?.init.body))).toEqual({
			weather_fetched_at: '2026-10-12T12:00:00Z',
			weather_source_updated_at: '2026-10-12T11:50:00Z',
			weather_freshness: 'fresh',
			weather_current: point,
			forecast_points: [point],
			updated_at: '2026-10-12T12:02:00.000Z'
		});
		expect(JSON.parse(String(rukaPatch?.init.body))).toEqual({ weather_freshness: 'stale' });
		const savedRun = JSON.parse(String(runInsert?.init.body)) as Record<string, unknown>;
		expect(savedRun.total_provider_requests).toBe(2);
		expect(savedRun.provider_requests_by_provider).toEqual({ fmi: 2, smhi: 0, 'met-no': 0 });
		expect((savedRun.result_summary as Array<Record<string, unknown>>)[0]).toMatchObject({
			forecastPointsParsed: 1,
			forecastPointsStored: 1
		});
		expect(savedRun.outcome).toBe('partial');
		expect((savedRun.result_summary as Array<Record<string, unknown>>)[1]).toMatchObject({
			slug: 'ruka',
			ok: false,
			errorCodes: ['timeout']
		});
		for (const call of calls) {
			const headers = new Headers(call.init.headers);
			expect(headers.get('apikey')).toBe('service-role-test');
			expect(headers.get('authorization')).toBe('Bearer service-role-test');
			expect(call.url).not.toMatch(/opendata|met\.no|smhi\.se/i);
		}
	});
});
