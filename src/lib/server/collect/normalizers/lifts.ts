import type { NormalizedFactCandidate } from '../types.js';

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

export function normalizeLifts(parsed: unknown): NormalizedFactCandidate[] {
	const root = asRecord(parsed);
	const meta = asRecord(root._meta);
	const observed =
		typeof meta.source_updated_at === 'string'
			? meta.source_updated_at
			: typeof meta.fetched_at === 'string'
				? meta.fetched_at
				: undefined;
	const lifts = Array.isArray(root.lifts) ? root.lifts : [];
	const facts: NormalizedFactCandidate[] = [];
	let open = 0;
	for (const raw of lifts) {
		const r = asRecord(raw);
		const status = r.status === 'open' || r.status === 'closed' ? r.status : null;
		if (!status || typeof r.external_id !== 'string') continue;
		if (status === 'open') open += 1;
		facts.push(txt('lift', `lift.${r.external_id}.status`, status, observed));
	}
	return [
		{ category: 'lift', key: 'open_count', valueNumeric: open, sourceObservedAt: observed },
		{ category: 'lift', key: 'total_count', valueNumeric: lifts.length, sourceObservedAt: observed },
		...facts
	];
}

export const __liftsInternals = { asRecord };