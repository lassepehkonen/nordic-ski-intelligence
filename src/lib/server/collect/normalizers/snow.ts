import type { NormalizedFactCandidate } from '../types.js';
import type { SnowSnapshot } from '../parsers/levi/snow.js';

export function normalizeSnow(parsed: SnowSnapshot): NormalizedFactCandidate[] {
	const observed = parsed.lastMeasuredAt ?? parsed.sourceUpdatedAt ?? parsed.fetchedAt;
	return [
		{
			category: 'snow',
			key: 'base_depth',
			fieldKey: 'snow_base_depth',
			valueNumeric: parsed.baseDepthCm,
			unit: 'cm',
			sourceObservedAt: observed
		},
		{
			category: 'snow',
			key: 'mid_depth',
			fieldKey: 'snow_mid_depth',
			valueNumeric: parsed.midDepthCm,
			unit: 'cm',
			sourceObservedAt: observed
		},
		{
			category: 'snow',
			key: 'summit_depth',
			fieldKey: 'snow_summit_depth',
			valueNumeric: parsed.summitDepthCm,
			unit: 'cm',
			sourceObservedAt: observed
		},
		{
			category: 'snow',
			key: 'new_snow_24h',
			fieldKey: 'snow_new_24h',
			valueNumeric: parsed.newSnow24hCm,
			unit: 'cm',
			sourceObservedAt: observed
		},
		{
			category: 'snow',
			key: 'new_snow_72h',
			fieldKey: 'snow_new_72h',
			valueNumeric: parsed.newSnow72hCm,
			unit: 'cm',
			sourceObservedAt: observed
		},
		{
			category: 'snow',
			key: 'surface_condition',
			fieldKey: 'snow_surface_condition',
			valueText: parsed.surfaceCondition,
			sourceObservedAt: observed
		}
	];
}
