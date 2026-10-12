import { describe, expect, it } from 'vitest';
import { createStructuredLogger } from '../../src/lib/server/collect/logger.js';
import { pilotResorts } from '../../src/lib/server/resorts/pilot.js';
import { createPilotProductReader } from '../../src/lib/server/resorts/product-repository.js';
import { createPilotWeatherWriter } from '../../src/lib/server/resorts/weather-writer.js';
import { runPilotWeather } from '../../src/lib/server/weather/runner.js';

const liveEnabled = process.env.RUN_LIVE_PILOT === '1';

describe.skipIf(!liveEnabled)('live pilot weather providers', () => {
	it('collects one normalized forecast from each of the ten configured resorts', async () => {
		const run = await runPilotWeather({
			resorts: pilotResorts,
			logger: createStructuredLogger('pilot-weather-live')
		});
		if (process.env.PERSIST_PILOT_RUN === '1') {
			const supabaseUrl = process.env.SUPABASE_URL;
			const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
			const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
			if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
				throw new Error('pilot_persistence_environment_missing');
			}
			await createPilotWeatherWriter({ supabaseUrl, serviceRoleKey }).persistRun(run);
			const product = await createPilotProductReader({ supabaseUrl, publishableKey }).getProduct();
			expect(product.lastCollectionRun?.completedAt).toBe(run.endedAt);
			expect(product.lastCollectionRun?.providerRequestsByProvider).toEqual(
				run.providerRequestsByProvider
			);
			for (const result of run.results.filter((item) => item.ok && item.data)) {
				expect(
					product.resorts.find((resort) => resort.slug === result.slug)?.weather.fetchedAt
				).toBe(result.data?.fetchedAt);
			}
		}

		if (process.env.DUMP_PILOT_NORMALIZED === '1') {
			process.stdout.write(
				`PILOT_WEATHER_NORMALIZED=${JSON.stringify({
					runId: run.runId,
					startedAt: run.startedAt,
					endedAt: run.endedAt,
					successCount: run.successCount,
					failureCount: run.failureCount,
					staleCount: run.staleCount,
					totalProviderRequests: run.totalProviderRequests,
					providerRequestsByProvider: run.providerRequestsByProvider,
					totalLatencyMs: run.results.reduce(
						(sum, result) => sum + (result.data?.latencyMs ?? 0),
						0
					),
					results: run.results.map((result) => ({
						slug: result.slug,
						provider: result.provider,
						ok: result.ok,
						stale: result.data?.stale ?? false,
						providerRequests: result.providerRequests,
						latencyMs: result.data?.latencyMs ?? null,
						fetchedAt: result.data?.fetchedAt ?? null,
						sourceUpdatedAt: result.data?.forecast.sourceUpdatedAt ?? null,
						current: result.data?.forecast.points[0] ?? null,
						forecast: result.data?.forecast.points.slice(0, 4) ?? [],
						pointCount: result.data?.forecast.points.length ?? 0,
						errorCodes: result.errors
					}))
				})}\n`
			);
		}

		console.log(
			JSON.stringify({
				runId: run.runId,
				successCount: run.successCount,
				failureCount: run.failureCount,
				totalProviderRequests: run.totalProviderRequests,
				providerRequestsByProvider: run.providerRequestsByProvider,
				results: run.results.map((result) => ({
					slug: result.slug,
					provider: result.provider,
					ok: result.ok,
					requests: result.providerRequests,
					points: result.data?.forecast.points.length ?? 0,
					modelUpdatedAt: result.data?.forecast.sourceUpdatedAt ?? null,
					weather: result.data
						? {
								fetchedAt: result.data.fetchedAt,
								sourceUpdatedAt: result.data.forecast.sourceUpdatedAt,
								current: result.data.forecast.points[0] ?? null,
								forecast: result.data.forecast.points.slice(0, 8)
							}
						: null,
					errorCodes: result.errors
				}))
			})
		);

		expect(run.results).toHaveLength(10);
		expect(run.successCount).toBe(10);
		expect(run.failureCount).toBe(0);
		expect(run.totalProviderRequests).toBe(10);
	});
});
