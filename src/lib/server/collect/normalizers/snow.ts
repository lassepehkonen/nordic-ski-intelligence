import type { NormalizedFactCandidate } from '../types.js';

function num(
	category: NormalizedFactCandidate['category'],
	key: string,
	value: number,
	unit: string,
	sourceObservedAt?: string
): NormalizedFactCandidate {
	return { category, key, valueNumeric: value, unit, sourceObservedAt };
}

function txt(
	category: NormalizedFactCandidate['category'],
	key: string,
	value: string,
	sourceObservedAt?: string
): NormalizedFactCandidate {
	return { category, key, valueText: value, sourceObservedAt };
}

function asRecord(v: unknown): Record<string, unknown> {
	return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}

function observedAt(parsed: Record<string, unknown>, snow: Record<string, unknown>): string | undefined {
	const meta = asRecord(parsed._meta);
	const candidate = meta.source_updated_at ?? meta.fetched_at ?? snow.last_measured_at;
	return typeof candidate === 'string' ? candidate : undefined;
}

export function normalizeSnow(parsed: unknown): NormalizedFactCandidate[] {
	const root = asRecord(parsed);
	const snow = asRecord(root.snow);
	const observed = observedAt(root, snow);
	const facts: NormalizedFactCandidate[] = [];

	if (typeof snow.base_depth_cm === 'number')
		facts.push(num('snow', 'base_depth', snow.base_depth_cm, 'cm', observed));
	if (typeof snow.mid_depth_cm === 'number')
		facts.push(num('snow', 'mid_depth', snow.mid_depth_cm, 'cm', observed));
	if (typeof snow.summit_depth_cm === 'number')
		facts.push(num('snow', 'summit_depth', snow.summit_depth_cm, 'cm', observed));
	if (typeof snow.new_snow_24h_cm === 'number')
		facts.push(num('snow', 'new_snow_24h', snow.new_snow_24h_cm, 'cm', observed));
	if (typeof snow.new_snow_72h_cm === 'number')
		facts.push(num('snow', 'new_snow_72h', snow.new_snow_72h_cm, 'cm', observed));
	if (typeof snow.surface_condition === 'string')
		facts.push(txt('snow', 'surface_condition', snow.surface_condition, observed));

	return facts;
}

export const __normalizerInternals = { asRecord, observedAt };