import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { pilotResorts } from '../../src/lib/server/resorts/pilot.js';
import { runPilotWeather } from '../../src/lib/server/weather/runner.js';

const fmiXml = readFileSync(new URL('../fixtures/weather/fmi-simple.xml', import.meta.url), 'utf8');
const smhiJson = readFileSync(
	new URL('../fixtures/weather/smhi-point.json', import.meta.url),
	'utf8'
);
const metJson = readFileSync(
	new URL('../fixtures/weather/met-locationforecast.json', import.meta.url),
	'utf8'
);

describe('pilot weather collection', () => {
	it('fetches once per configured resort through the shared provider adapters', async () => {
		const calls: Array<{ url: string; headers: Headers }> = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			const url = String(input);
			calls.push({ url, headers: new Headers(init?.headers) });
			const body = url.includes('opendata.fmi.fi')
				? fmiXml
				: url.includes('smhi.se')
					? smhiJson
					: metJson;
			return new Response(body, {
				status: 200,
				headers: {
					'content-type': url.includes('opendata.fmi.fi') ? 'application/xml' : 'application/json'
				}
			});
		};
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

		const result = await runPilotWeather({
			resorts: pilotResorts,
			fetchImpl,
			logger,
			now: () => new Date('2026-10-12T12:00:00Z'),
			sleep: async () => undefined
		});

		expect(result.results).toHaveLength(10);
		expect(result.successCount).toBe(10);
		expect(result.failureCount).toBe(0);
		expect(result.totalProviderRequests).toBe(10);
		expect(result.providerRequestsByProvider).toEqual({ fmi: 6, smhi: 2, 'met-no': 2 });
		expect(calls).toHaveLength(10);
		expect(
			calls.find((call) => call.url.includes('api.met.no'))?.headers.get('user-agent')
		).toContain('NordicSkiIntelligence');
		expect(logger.info).toHaveBeenCalledTimes(10);
	});

	it('records malformed provider payloads as parse failures and counts the requests', async () => {
		const fetchImpl: typeof fetch = async (input) => {
			const url = String(input);
			const body = url.includes('opendata.fmi.fi')
				? '<html>not a forecast</html>'
				: url.includes('smhi.se')
					? smhiJson
					: metJson;
			return new Response(body, { status: 200 });
		};

		const result = await runPilotWeather({
			resorts: pilotResorts,
			fetchImpl,
			logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
			now: () => new Date('2026-10-12T12:00:00Z'),
			sleep: async () => undefined
		});

		expect(result.failureCount).toBe(6);
		expect(result.totalProviderRequests).toBe(10);
		expect(result.providerRequestsByProvider.fmi).toBe(6);
		expect(
			result.results
				.filter((item) => !item.ok)
				.every((item) => item.errors.includes('no_fmi_forecast_points'))
		).toBe(true);
	});
});
