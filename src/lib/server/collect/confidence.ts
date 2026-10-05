import type { ConfidenceLevel, NormalizedFactCandidate, SourceConfig } from './types.js';

/**
 * Confidence scoring follows ADR-0009: return a qualitative value from
 * `app.confidence_level` ('unknown' | 'low' | 'medium' | 'high') rather than a
 * numeric probability that has not been calibrated. The scorer uses three
 * signals:
 *
 *   1. Source kind: synthetic/manual -> low; licensed/national API -> medium;
 *      open_dataset/manual review -> high.
 *   2. Source-observed timestamp: missing -> unknown; stale (>staleAfterMs)
 *      -> low; within freshness window -> step 3.
 *   3. Numeric fall-through: numeric value present -> one notch above text-only.
 */
const KIND_WEIGHT: Record<SourceConfig['sourceKind'], number> = {
	synthetic: 1,
	manual: 2,
	resort_website: 2,
	national_api: 3,
	licensed_feed: 3,
	open_dataset: 4
};

const LEVELS: ReadonlyArray<ConfidenceLevel> = ['unknown', 'low', 'medium', 'high'];

function clamp(level: number): ConfidenceLevel {
	return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
}

export function scoreConfidence(
	candidate: NormalizedFactCandidate,
	source: SourceConfig,
	now: () => Date = () => new Date()
): { confidence: ConfidenceLevel; reasons: ReadonlyArray<string> } {
	const reasons: string[] = [];
	let level = KIND_WEIGHT[source.sourceKind];

	if (source.sourceKind === 'synthetic') {
		reasons.push('synthetic fixture data; confidence capped at low');
		level = Math.min(level, 1);
	}

	if (!candidate.sourceObservedAt) {
		reasons.push('source-observed timestamp missing');
		return { confidence: 'unknown', reasons };
	}

	const observed = new Date(candidate.sourceObservedAt);
	const ageMs = now().getTime() - observed.getTime();
	if (Number.isNaN(ageMs) || ageMs < 0) {
		reasons.push('invalid source-observed timestamp');
		return { confidence: 'unknown', reasons };
	}

	if (ageMs > source.staleAfterMs) {
		reasons.push(`value is older than staleAfterMs (${ageMs}ms > ${source.staleAfterMs}ms)`);
		return { confidence: 'low', reasons };
	}

	if (candidate.valueNumeric !== undefined) {
		level = Math.min(LEVELS.length - 1, level + 1);
		reasons.push('numeric value supports direct comparison');
	} else {
		reasons.push('text-only value; conservative confidence');
	}

	return { confidence: clamp(level), reasons };
}