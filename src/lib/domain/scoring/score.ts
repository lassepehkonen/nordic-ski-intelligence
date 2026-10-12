/**
 * Conditions Score engine (pure, independently testable).
 *
 * Input: provenance-carrying observations for one resort. Output: a 0–100 score with its version,
 * coverage, freshness, qualitative confidence and a per-input breakdown that the UI can explain.
 * Missing or stale data stays explicit — it never becomes a silent zero (ADR-0009).
 */

import type {
	Confidence,
	ConditionsScoreView,
	MetricKey,
	Observation,
	ScoreInputView,
	SnowQuality
} from '../types.js';
import { isUsable, lowestConfidence, worstFreshness, freshnessOf } from '../freshness.js';
import {
	CONDITIONS_SCORE_V1,
	bandFor,
	conditionsScoreWeightTotal,
	type ConditionsScoreConfig,
	type Normalizer,
	type ScoreInputDefinition
} from './config.js';

function clamp01(value: number): number {
	if (Number.isNaN(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

function numericValue(observation: Observation | undefined): number | null {
	if (!observation || !isUsable(observation)) return null;
	return typeof observation.value === 'number' ? observation.value : null;
}

function qualityValue(observation: Observation | undefined): SnowQuality | null {
	if (!observation || !isUsable(observation)) return null;
	return typeof observation.value === 'string' ? observation.value : null;
}

function latestByMetric(observations: readonly Observation[]): Map<MetricKey, Observation> {
	const byMetric = new Map<MetricKey, Observation>();
	for (const observation of observations) {
		const existing = byMetric.get(observation.metric);
		if (!existing || new Date(observation.observedAt) > new Date(existing.observedAt)) {
			byMetric.set(observation.metric, observation);
		}
	}
	return byMetric;
}

function normalise(normalizer: Normalizer, raw: number | SnowQuality | null): number | null {
	if (raw === null) return null;

	if (typeof raw === 'string') {
		return normalizer.kind === 'quality' ? clamp01(normalizer.map[raw] ?? 0) : null;
	}

	switch (normalizer.kind) {
		case 'ramp': {
			const span = normalizer.full - normalizer.zero;
			if (span === 0) return raw >= normalizer.full ? 1 : 0;
			return clamp01((raw - normalizer.zero) / span);
		}
		case 'ratio':
			return clamp01(raw);
		case 'ideal': {
			if (raw >= normalizer.idealLow && raw <= normalizer.idealHigh) return 1;
			if (raw < normalizer.idealLow) {
				const span = normalizer.idealLow - normalizer.zeroLow;
				return span <= 0 ? 0 : clamp01((raw - normalizer.zeroLow) / span);
			}
			const span = normalizer.zeroHigh - normalizer.idealHigh;
			return span <= 0 ? 0 : clamp01((normalizer.zeroHigh - raw) / span);
		}
		case 'quality':
			return null;
	}
}

function resolveRaw(
	input: ScoreInputDefinition,
	byMetric: Map<MetricKey, Observation>
): { raw: number | SnowQuality | null; unit: string | null; sources: Observation[] } {
	if (input.source.kind === 'ratio') {
		const numerator = byMetric.get(input.source.numerator);
		const denominator = byMetric.get(input.source.denominator);
		const numeratorValue = numericValue(numerator);
		const denominatorValue = numericValue(denominator);
		if (numeratorValue === null || denominatorValue === null || denominatorValue <= 0) {
			return { raw: null, unit: null, sources: [] };
		}
		return {
			raw: numeratorValue / denominatorValue,
			unit: null,
			sources: [numerator, denominator].filter((value): value is Observation => Boolean(value))
		};
	}

	const observation = byMetric.get(input.source.metric);
	if (input.source.metric === 'snow_quality') {
		const quality = qualityValue(observation);
		return { raw: quality, unit: null, sources: observation ? [observation] : [] };
	}
	const value = numericValue(observation);
	return {
		raw: value,
		unit: observation?.unit ?? null,
		sources: observation ? [observation] : []
	};
}

export interface ConditionsScoreInput {
	resortId: string;
	/** Conditions and weather observations for one resort; weather metrics are a subset. */
	observations: readonly Observation[];
	now: Date;
	config?: ConditionsScoreConfig;
}

export function computeConditionsScore({
	resortId,
	observations,
	now,
	config = CONDITIONS_SCORE_V1
}: ConditionsScoreInput): ConditionsScoreView {
	const usable = observations.filter(isUsable);
	const byMetric = latestByMetric(observations);

	const inputs: ScoreInputView[] = [];
	const usedObservations: Observation[] = [];
	const missingMetrics: MetricKey[] = [];
	let availableWeight = 0;

	for (const definition of config.inputs) {
		const { raw, unit, sources } = resolveRaw(definition, byMetric);
		const normalized = normalise(definition.normalizer, raw);
		const missing = normalized === null;
		if (missing) {
			if (definition.source.kind === 'metric') missingMetrics.push(definition.source.metric);
		} else {
			availableWeight += definition.weight;
			usedObservations.push(...sources);
		}
		inputs.push({
			id: definition.id,
			labelKey: definition.labelKey,
			metric:
				definition.source.kind === 'metric'
					? definition.source.metric
					: definition.source.numerator,
			weight: definition.weight,
			normalized,
			contribution: missing ? null : normalized * definition.weight,
			raw,
			unit,
			missing
		});
	}

	const totalWeight = conditionsScoreWeightTotal(config);
	const coverage = totalWeight === 0 ? 0 : availableWeight / totalWeight;

	const freshness =
		observations.length > 0 && usable.length === 0
			? 'invalid'
			: worstFreshness(usedObservations.map((observation) => freshnessOf(observation, now)));

	const confidence: Confidence =
		usedObservations.length === 0
			? 'unknown'
			: lowestConfidence(usedObservations.map((o) => o.confidence));

	const rawScore = inputs.reduce((total, input) => total + (input.contribution ?? 0), 0);
	const hasScore = coverage >= config.hideBelowCoverage && availableWeight > 0;
	const score = hasScore ? Math.round((rawScore / availableWeight) * 100) : null;

	return {
		version: config.version,
		resortId,
		score,
		band: score === null ? null : bandFor(score, config),
		coverage: Math.round(coverage * 1000) / 1000,
		partial: score !== null && coverage < config.partialBelowCoverage,
		computedAt: now.toISOString(),
		freshness,
		confidence,
		inputs,
		missingMetrics
	};
}
