import type { Conflict, NormalizedFactCandidate, ValidatedFact } from './types.js';

interface ExistingObservation {
	readonly value: unknown;
	readonly sourceId?: string;
	readonly sourceObservedAt?: string;
}

function fingerprint(candidate: NormalizedFactCandidate): string {
	return `${candidate.category}.${candidate.key}`;
}

function unpackExisting(value: unknown): ExistingObservation {
	if (typeof value === 'object' && value !== null && 'value' in value) {
		const record = value as Record<string, unknown>;
		return {
			value: record.value,
			sourceId: typeof record.sourceId === 'string' ? record.sourceId : undefined,
			sourceObservedAt:
				typeof record.sourceObservedAt === 'string' ? record.sourceObservedAt : undefined
		};
	}
	return { value };
}

function valuesEqual(a: unknown, candidate: NormalizedFactCandidate): boolean {
	if (candidate.valueNumeric !== undefined)
		return typeof a === 'number' && a === candidate.valueNumeric;
	if (candidate.valueText !== undefined) return typeof a === 'string' && a === candidate.valueText;
	return a === undefined;
}

function isLaterObservation(candidate: ValidatedFact, existing: ExistingObservation): boolean {
	if (
		existing.sourceId !== candidate.sourceId ||
		!existing.sourceObservedAt ||
		!candidate.candidate.sourceObservedAt
	)
		return false;
	const prior = Date.parse(existing.sourceObservedAt);
	const incoming = Date.parse(candidate.candidate.sourceObservedAt);
	return Number.isFinite(prior) && Number.isFinite(incoming) && incoming > prior;
}

/**
 * Preserve an existing value when another source disagrees, or when an older
 * observation arrives out of order. A newer reading from the same source is a
 * normal update, not a conflict.
 */
export function detectConflicts(
	facts: ReadonlyArray<ValidatedFact>,
	existing: ReadonlyMap<string, unknown>
): ReadonlyArray<Conflict> {
	const conflicts: Conflict[] = [];
	for (const fact of facts) {
		const currentRaw = existing.get(fingerprint(fact.candidate));
		if (currentRaw === undefined) continue;
		const current = unpackExisting(currentRaw);
		if (valuesEqual(current.value, fact.candidate)) continue;
		if (isLaterObservation(fact, current)) continue;

		const sameSource = current.sourceId === fact.sourceId;
		conflicts.push({
			candidate: fact.candidate,
			existingValue: current.value,
			resolution: 'queue_for_review',
			reason: sameSource
				? 'incoming observation is not newer than the latest valid value; existing value retained'
				: 'incoming value disagrees with the latest valid observation; existing value retained'
		});
	}
	return conflicts;
}

export const __conflictInternals = { fingerprint, unpackExisting, isLaterObservation };
