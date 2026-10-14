import type { NormalizedFactCandidate } from '../types.js';
import type { SlopeSnapshot } from '../parsers/levi/slopes.js';

export function normalizeSlopes(parsed: SlopeSnapshot): NormalizedFactCandidate[] {
	const observed = parsed.sourceUpdatedAt ?? parsed.fetchedAt;
	const openCount = parsed.slopes.filter((slope) => slope.status === 'open').length;
	return [
		{
			category: 'slope',
			key: 'open_count',
			fieldKey: 'open_piste_count',
			valueNumeric: openCount,
			unit: 'count',
			sourceObservedAt: observed
		},
		{
			category: 'slope',
			key: 'total_count',
			fieldKey: 'total_piste_count',
			valueNumeric: parsed.slopes.length,
			unit: 'count',
			sourceObservedAt: observed
		},
		...parsed.slopes.map((slope) => ({
			category: 'slope' as const,
			key: `piste.${slope.externalId}.status`,
			fieldKey: 'operating_status',
			valueText: slope.status,
			sourceObservedAt: observed
		}))
	];
}
