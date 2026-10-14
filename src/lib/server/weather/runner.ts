import { randomUUID } from 'node:crypto';
import { createHttpCollector } from '../collect/collector.js';
import type { HttpCollectorDeps } from '../collect/collector.js';
import { createStructuredLogger } from '../collect/logger.js';
import { createInMemorySourceHealth } from '../collect/source-health.js';
import type { Logger } from '../collect/types.js';
import type { PilotResort, WeatherProvider } from '../resorts/pilot.js';
import { pilotResorts } from '../resorts/pilot.js';
import {
	collectResortForecast,
	weatherSourceFor,
	type CollectedWeatherForecast
} from './adapters.js';

export interface PilotWeatherResult {
	readonly slug: string;
	readonly provider: WeatherProvider;
	readonly ok: boolean;
	readonly data?: CollectedWeatherForecast;
	readonly errors: ReadonlyArray<string>;
	readonly warnings: ReadonlyArray<string>;
	readonly providerRequests: number;
}

export interface PilotWeatherRun {
	readonly runId: string;
	readonly startedAt: string;
	readonly endedAt: string;
	readonly results: ReadonlyArray<PilotWeatherResult>;
	readonly successCount: number;
	readonly failureCount: number;
	readonly staleCount: number;
	readonly totalProviderRequests: number;
	readonly providerRequestsByProvider: Readonly<Record<WeatherProvider, number>>;
	readonly sourceHealth: Readonly<
		Record<string, ReturnType<ReturnType<typeof createInMemorySourceHealth>['snapshot']>>
	>;
}

export interface PilotWeatherRunnerOptions {
	readonly resorts?: ReadonlyArray<PilotResort>;
	readonly collectorDeps?: HttpCollectorDeps;
	readonly fetchImpl?: typeof fetch;
	readonly now?: () => Date;
	readonly sleep?: (ms: number) => Promise<void>;
	readonly logger?: Logger;
}

export async function runPilotWeather(
	options: PilotWeatherRunnerOptions = {}
): Promise<PilotWeatherRun> {
	const now = options.now ?? (() => new Date());
	const logger = options.logger ?? createStructuredLogger('pilot-weather', { clock: now });
	const health = createInMemorySourceHealth({ clock: now });
	const collector = createHttpCollector({
		...options.collectorDeps,
		...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
		now,
		...(options.sleep ? { sleep: options.sleep } : {})
	});
	const resorts = options.resorts ?? pilotResorts;
	const startedAt = now().toISOString();
	const runId = randomUUID();
	const results: PilotWeatherResult[] = [];
	const providerRequestsByProvider: Record<WeatherProvider, number> = {
		fmi: 0,
		smhi: 0,
		'met-no': 0
	};
	const sourceIds = new Set<string>();

	for (const resort of resorts) {
		const result = await collectResortForecast(resort, collector, now);
		const provider = resort.weather.provider;
		const providerRequests = result.providerRequests ?? 0;
		providerRequestsByProvider[provider] += providerRequests;
		const sourceId = weatherSourceFor(resort).sourceId;
		sourceIds.add(sourceId);

		if (result.ok && result.data) {
			health.recordSuccess(sourceId, result.data.latencyMs);
		} else if (providerRequests > 0) {
			health.recordFailure(sourceId, result.errors[0] ?? 'weather_collection_failed');
		}

		const normalized: PilotWeatherResult = {
			slug: resort.slug,
			provider,
			ok: result.ok,
			...(result.data ? { data: result.data } : {}),
			errors: result.errors,
			warnings: result.warnings,
			providerRequests
		};
		results.push(normalized);
		const event = {
			event: 'weather_collection_complete',
			run_id: runId,
			resort_slug: resort.slug,
			provider,
			source_id: sourceId,
			outcome: result.ok ? (result.data?.stale ? 'stale' : 'success') : 'failure',
			provider_requests: providerRequests,
			latency_ms: result.data?.latencyMs ?? null,
			forecast_points: result.data?.forecast.points.length ?? 0,
			error_codes: result.errors
		};
		if (result.ok && !result.data?.stale) logger.info(event);
		else if (result.ok) logger.warn(event);
		else logger.error(event);
	}

	const endedAt = now().toISOString();
	const successCount = results.filter((result) => result.ok).length;
	const failureCount = results.length - successCount;
	const staleCount = results.filter((result) => result.data?.stale).length;
	const sourceHealth = Object.fromEntries(
		[...sourceIds].map((sourceId) => [sourceId, health.snapshot(sourceId)])
	);
	const totalProviderRequests = Object.values(providerRequestsByProvider).reduce(
		(total, count) => total + count,
		0
	);

	return {
		runId,
		startedAt,
		endedAt,
		results,
		successCount,
		failureCount,
		staleCount,
		totalProviderRequests,
		providerRequestsByProvider,
		sourceHealth
	};
}
