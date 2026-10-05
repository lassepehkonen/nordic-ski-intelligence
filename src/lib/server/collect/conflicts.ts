import type { Conflict, NormalizedFactCandidate, ValidatedFact } from './types.js';

function fingerprint(candidate: NormalizedFactCandidate): string {
	return `${candidate.category}.${candidate.key}`;
}

function valuesEqual(a: unknown, b: NormalizedFactCandidate): boolean {
	if (b.valueNumeric !== undefined) return typeof a === 'number' && a === b.valueNumeric;
	if (b.valueText !== undefined) return typeof a === 'string' && a === b.valueText;
	return a === undefined;
}

/**
 * Detect conflicts between incoming validated facts and the most recent
 * approved fact stored in the database. Any difference queues the incoming
 * candidate for editorial review without overwriting the existing valid value.
 */
export function detectConflicts(
	facts: ReadonlyArray<ValidatedFact>,
	existing: ReadonlyMap<string, unknown>
): ReadonlyArray<Conflict> {
	const conflicts: Conflict[] = [];
	for (const fact of facts) {
		const key = fingerprint(fact.candidate);
		const current = existing.get(key);
		if (current === undefined) continue;
		if (valuesEqual(current, fact.candidate)) continue;
		conflicts.push({
			candidate: fact.candidate,
			existingValue: current,
			resolution: 'queue_for_review',
			reason: 'incoming value differs from approved valid value; keep existing until reviewed'
		});
	}
	return conflicts;
}

export const __conflictInternals = { fingerprint };