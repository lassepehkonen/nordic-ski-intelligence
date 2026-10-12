import type { NormalizedFactCandidate } from '../types.js';
import type { LiftSnapshot } from '../parsers/levi/lifts.js';

export function normalizeLifts(parsed: LiftSnapshot): NormalizedFactCandidate[] {
	const observed = parsed.sourceUpdatedAt ?? parsed.fetchedAt;
	const openCount = parsed.lifts.filter((lift) => lift.status === 'open').length;
	return [
		{
			category: 'lift',
			key: 'open_count',
			fieldKey: 'open_lift_count',
			valueNumeric: openCount,
			unit: 'count',
			sourceObservedAt: observed
		},
		{
			category: 'lift',
			key: 'total_count',
			fieldKey: 'total_lift_count',
			valueNumeric: parsed.lifts.length,
			unit: 'count',
			sourceObservedAt: observed
		},
		...parsed.lifts.map((lift) => ({
			category: 'lift' as const,
			key: `lift.${lift.externalId}.status`,
			fieldKey: 'operating_status',
			valueText: lift.status,
			sourceObservedAt: observed
		}))
	];
}
