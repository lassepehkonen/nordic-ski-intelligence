import type { SourceId } from './types.js';

export interface SourceHealthSnapshot {
	readonly source_id: string;
	readonly consecutive_failures: number;
	readonly is_healthy: boolean;
	readonly last_success_at: string | null;
	readonly last_failure_at: string | null;
	readonly last_error: string | null;
	readonly total_successes: number;
	readonly total_failures: number;
	readonly cooldown_until: string | null;
}

interface SourceHealthState {
	readonly consecutiveFailures: number;
	readonly lastSuccessAt: string | null;
	readonly lastFailureAt: string | null;
	readonly lastError: string | null;
	readonly totalSuccesses: number;
	readonly totalFailures: number;
	readonly cooldownUntil: string | null;
}

export interface SourceHealthOptions {
	readonly unhealthyAfter?: number;
	readonly cooldownMs?: number;
	readonly clock?: () => Date;
}

export interface SourceHealth {
	recordSuccess(sourceId: SourceId, durationMs: number): void;
	recordFailure(sourceId: SourceId, reason: string): void;
	isHealthy(sourceId: SourceId): boolean;
	consecutiveFailures(sourceId: SourceId): number;
	snapshot(sourceId: SourceId): SourceHealthSnapshot;
	reset(sourceId: SourceId): void;
}

export function createInMemorySourceHealth(options: SourceHealthOptions = {}): SourceHealth {
	const unhealthyAfter = options.unhealthyAfter ?? 3;
	const cooldownMs = options.cooldownMs ?? 60_000;
	const clock = options.clock ?? (() => new Date());
	const state = new Map<string, SourceHealthState>();

	function get(sourceId: SourceId): SourceHealthState {
		const existing = state.get(sourceId);
		if (existing) return existing;
		const fresh: SourceHealthState = {
			consecutiveFailures: 0,
			lastSuccessAt: null,
			lastFailureAt: null,
			lastError: null,
			totalSuccesses: 0,
			totalFailures: 0,
			cooldownUntil: null
		};
		state.set(sourceId, fresh);
		return fresh;
	}

	function inCooldown(s: SourceHealthState): boolean {
		if (!s.cooldownUntil) return false;
		const until = new Date(s.cooldownUntil).getTime();
		return until > clock().getTime();
	}

	return {
		recordSuccess(sourceId) {
			const cur = get(sourceId);
			state.set(sourceId, {
				consecutiveFailures: 0,
				lastSuccessAt: clock().toISOString(),
				lastFailureAt: cur.lastFailureAt,
				lastError: null,
				totalSuccesses: cur.totalSuccesses + 1,
				totalFailures: cur.totalFailures,
				cooldownUntil: null
			});
		},
		recordFailure(sourceId, reason) {
			const cur = get(sourceId);
			const failures = cur.consecutiveFailures + 1;
			const cooldownUntil =
				failures >= unhealthyAfter
					? new Date(clock().getTime() + cooldownMs).toISOString()
					: null;
			state.set(sourceId, {
				consecutiveFailures: failures,
				lastSuccessAt: cur.lastSuccessAt,
				lastFailureAt: clock().toISOString(),
				lastError: reason,
				totalSuccesses: cur.totalSuccesses,
				totalFailures: cur.totalFailures + 1,
				cooldownUntil
			});
		},
		isHealthy(sourceId) {
			const cur = get(sourceId);
			if (cur.consecutiveFailures < unhealthyAfter) return true;
			return !inCooldown(cur);
		},
		consecutiveFailures(sourceId) {
			return get(sourceId).consecutiveFailures;
		},
		snapshot(sourceId) {
			const cur = get(sourceId);
			return {
				source_id: sourceId,
				consecutive_failures: cur.consecutiveFailures,
				is_healthy: cur.consecutiveFailures < unhealthyAfter || !inCooldown(cur),
				last_success_at: cur.lastSuccessAt,
				last_failure_at: cur.lastFailureAt,
				last_error: cur.lastError,
				total_successes: cur.totalSuccesses,
				total_failures: cur.totalFailures,
				cooldown_until: cur.cooldownUntil
			};
		},
		reset(sourceId) {
			state.set(sourceId, {
				consecutiveFailures: 0,
				lastSuccessAt: null,
				lastFailureAt: null,
				lastError: null,
				totalSuccesses: 0,
				totalFailures: 0,
				cooldownUntil: null
			});
		}
	};
}