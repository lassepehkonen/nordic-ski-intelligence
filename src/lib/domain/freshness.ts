/**
 * Freshness is derived from validation state and `validUntil` at read time (domain model §
 * "Changing conditions and weather"). A rejected observation is invalid; a missing validity window
 * is `unknown` rather than implicitly fresh; an expired window is `stale`; otherwise `fresh`.
 */

import type { Confidence, FreshnessState, Observation } from './types.js';

const CONFIDENCE_ORDER: readonly Confidence[] = ['unknown', 'low', 'medium', 'high'];

export function isUsable(observation: Observation): boolean {
	return observation.validationState !== 'rejected';
}

export function freshnessOf(observation: Observation, now: Date): FreshnessState {
	if (observation.validationState === 'rejected') return 'invalid';
	if (!observation.validUntil) return 'unknown';
	const validUntil = new Date(observation.validUntil);
	if (Number.isNaN(validUntil.getTime())) return 'unknown';
	return validUntil.getTime() < now.getTime() ? 'stale' : 'fresh';
}

/** Worst (least trustworthy) freshness across a set of observations, ignoring invalid ones. */
export function worstFreshness(states: readonly FreshnessState[]): FreshnessState {
	if (states.length === 0) return 'unknown';
	const order: readonly FreshnessState[] = ['fresh', 'stale', 'unknown', 'invalid'];
	let worst: FreshnessState = 'fresh';
	for (const state of states) {
		if (order.indexOf(state) > order.indexOf(worst)) worst = state;
	}
	return worst;
}

/** Qualitative confidence: the lowest confidence among the inputs that were actually used. */
export function lowestConfidence(values: readonly Confidence[]): Confidence {
	if (values.length === 0) return 'unknown';
	let lowest = values[0];
	for (const value of values) {
		if (CONFIDENCE_ORDER.indexOf(value) < CONFIDENCE_ORDER.indexOf(lowest)) lowest = value;
	}
	return lowest;
}

export function latestFetch(observations: readonly Observation[]): string | null {
	let latest: number | null = null;
	for (const observation of observations) {
		if (!isUsable(observation)) continue;
		const time = new Date(observation.fetchedAt).getTime();
		if (Number.isNaN(time)) continue;
		if (latest === null || time > latest) latest = time;
	}
	return latest === null ? null : new Date(latest).toISOString();
}
