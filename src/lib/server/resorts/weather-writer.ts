import type { PilotWeatherRun, PilotWeatherResult } from '../weather/runner.js';
import type { WeatherPoint } from '../weather/adapters.js';

export interface PilotWeatherWriterOptions {
	supabaseUrl: string;
	serviceRoleKey: string;
	fetchImpl?: typeof fetch;
	now?: () => Date;
}

function safeErrorCodes(errors: ReadonlyArray<string>): string[] {
	return errors.filter((error) => /^[a-z0-9:_-]{1,80}$/i.test(error));
}

function weatherCurrent(points: ReadonlyArray<WeatherPoint>, now: Date): WeatherPoint | null {
	if (points.length === 0) return null;
	const timestamp = now.getTime();
	return points.reduce((nearest, point) => {
		const distance = Math.abs(Date.parse(point.validAt) - timestamp);
		const nearestDistance = Math.abs(Date.parse(nearest.validAt) - timestamp);
		return distance < nearestDistance ? point : nearest;
	});
}

function weatherPatch(result: PilotWeatherResult, now: Date): Record<string, unknown> {
	if (!result.ok || !result.data) return { weather_freshness: 'stale' };
	// Today (partial) + the next four days of hourly points; a 24 h fetch offset means the
	// span can reach ~130 points, so store everything FMI returns and cap generously.
	const points = result.data.forecast.points.slice(0, 130);
	return {
		weather_fetched_at: result.data.fetchedAt,
		weather_source_updated_at: result.data.forecast.sourceUpdatedAt,
		weather_freshness: result.data.stale ? 'stale' : 'fresh',
		weather_current: weatherCurrent(points, now),
		forecast_points: points,
		updated_at: now.toISOString()
	};
}

export function createPilotWeatherWriter(options: PilotWeatherWriterOptions) {
	const baseUrl = options.supabaseUrl.replace(/\/+$/, '');
	const fetchImpl = options.fetchImpl ?? fetch;
	const now = options.now ?? (() => new Date());

	async function write(path: string, method: 'PATCH' | 'POST', body: unknown): Promise<void> {
		let response: Response;
		try {
			response = await fetchImpl(`${baseUrl}/rest/v1/${path}`, {
				method,
				headers: {
					apikey: options.serviceRoleKey,
					Authorization: `Bearer ${options.serviceRoleKey}`,
					'Content-Type': 'application/json',
					Prefer: 'return=minimal'
				},
				body: JSON.stringify(body),
				cache: 'no-store',
				signal: AbortSignal.timeout(10_000)
			});
		} catch {
			throw new Error('pilot_database_write_failed');
		}
		if (!response.ok) throw new Error('pilot_database_write_failed');
	}

	return {
		async persistRun(run: PilotWeatherRun): Promise<void> {
			if (!baseUrl || !options.serviceRoleKey) {
				throw new Error('pilot_writer_configuration_missing');
			}
			const storedAt = now();
			const rowWrites = await Promise.allSettled(
				run.results.map((result) =>
					write(
						`pilot_resorts?slug=eq.${encodeURIComponent(result.slug)}`,
						'PATCH',
						weatherPatch(result, storedAt)
					)
				)
			);
			const persistenceFailures = rowWrites.filter((result) => result.status === 'rejected').length;
			const outcome =
				persistenceFailures > 0 || run.failureCount > 0 || run.staleCount > 0
					? run.successCount === 0
						? 'failed'
						: 'partial'
					: 'success';
			const resultSummary = run.results.map((result, index) => ({
				slug: result.slug,
				provider: result.provider,
				ok: result.ok,
				stale: result.data?.stale ?? false,
				providerRequests: result.providerRequests,
				latencyMs: result.data?.latencyMs ?? null,
				forecastPointsParsed: result.data?.forecast.points.length ?? 0,
				forecastPointsStored: Math.min(
					result.data?.forecast.points.length ?? 0,
					130
				),
				errorCodes: safeErrorCodes(result.errors),
				persistenceOk: rowWrites[index]?.status === 'fulfilled'
			}));
			const totalLatencyMs = run.results.reduce(
				(total, result) => total + (result.data?.latencyMs ?? 0),
				0
			);

			await write('pilot_collection_runs', 'POST', {
				run_id: run.runId,
				started_at: run.startedAt,
				completed_at: run.endedAt,
				outcome,
				resorts_attempted: run.results.length,
				resorts_succeeded: run.successCount,
				resorts_failed: run.failureCount,
				resorts_stale: run.staleCount,
				total_provider_requests: run.totalProviderRequests,
				provider_requests_by_provider: run.providerRequestsByProvider,
				total_latency_ms: totalLatencyMs,
				result_summary: resultSummary
			});

			if (persistenceFailures > 0) throw new Error('pilot_weather_persistence_incomplete');
		}
	};
}
