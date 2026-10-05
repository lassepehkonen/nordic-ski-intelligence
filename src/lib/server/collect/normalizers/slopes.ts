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

export function normalizeSlopes(parsed: unknown): NormalizedFactCandidate[] {
	const root = asRecord(parsed);
	const meta = asRecord(root._meta);
	const observed =
		typeof meta.source_updated_at === 'string'
			? meta.source_updated_at
			: typeof meta.fetched_at === 'string'
				? meta.fetched_at
				: undefined;
	const slopes = Array.isArray(root.slopes) ? root.slopes : [];
	const facts: NormalizedFactCandidate[] = [];
	let open = 0;
	for (const raw of slopes) {
		const r = asRecord(raw);
		const status = r.status === 'open' || r.status === 'closed' ? r.status : null;
		if (!status || typeof r.external_id !== 'string') continue;
		if (status === 'open') open += 1;
		facts.push(txt('slope', `piste.${r.external_id}.status`, status, observed));
	}
	return [
		{ category: 'slope', key: 'open_count', valueNumeric: open, sourceObservedAt: observed },
		{ category: 'slope', key: 'total_count', valueNumeric: slopes.length, sourceObservedAt: observed },
		...facts
	];
}

export const __slopesInternals = { asRecord };