import type { ConfidenceLevel, NormalizedFactCandidate, SourceConfig } from './types.js';

const BASE_CONFIDENCE: Readonly<Record<SourceConfig['sourceKind'], ConfidenceLevel>> = {
	synthetic: 'low',
	manual: 'low',
	resort_website: 'medium',
	national_api: 'medium',
	licensed_feed: 'medium',
	open_dataset: 'medium'
};

/**
 * Assign a qualitative, deliberately uncalibrated confidence level. Source kind
 * provides only a conservative baseline; freshness can lower it. High is not
 * emitted until a source-specific reliability calibration exists.
 */
export function scoreConfidence(
	candidate: NormalizedFactCandidate,
	source: SourceConfig,
	now: () => Date = () => new Date()
): { confidence: ConfidenceLevel; reasons: ReadonlyArray<string> } {
	if (!candidate.sourceObservedAt) {
		return { confidence: 'unknown', reasons: ['source-observed timestamp missing'] };
	}

	const observedAt = Date.parse(candidate.sourceObservedAt);
	const ageMs = now().getTime() - observedAt;
	if (!Number.isFinite(observedAt) || ageMs < 0) {
		return {
			confidence: 'unknown',
			reasons: ['source-observed timestamp is invalid or in the future']
		};
	}
	if (ageMs > source.staleAfterMs) {
		return {
			confidence: 'low',
			reasons: [`source observation is stale (${ageMs}ms > ${source.staleAfterMs}ms)`]
		};
	}

	const baseline = BASE_CONFIDENCE[source.sourceKind];
	const reason =
		source.sourceKind === 'synthetic'
			? 'synthetic fixture data; confidence capped at low'
			: `approved source kind ${source.sourceKind}; no source-specific calibration, so confidence is capped at medium`;
	return {
		confidence: baseline,
		reasons: [reason, 'source-observed timestamp is within freshness threshold']
	};
}
