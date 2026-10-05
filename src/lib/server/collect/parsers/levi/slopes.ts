import type { ParseResult } from '../../types.js';

export interface SlopeRecord {
	readonly externalId: string;
	readonly name: string;
	readonly difficulty: 'green' | 'blue' | 'red' | 'black' | 'unknown';
	readonly lengthM?: number;
	readonly status: 'open' | 'closed';
}

export interface SlopeSnapshot {
	readonly kind: 'slope_status';
	readonly slopes: ReadonlyArray<SlopeRecord>;
	readonly fetchedAt: string;
	readonly sourceUpdatedAt?: string;
}

function fail(errors: string[]): ParseResult<SlopeSnapshot> {
	return { ok: false, fatal: true, errors, warnings: [] };
}

const DIFFICULTIES = new Set(['green', 'blue', 'red', 'black']);

export function parseSlopeResponse(input: unknown): ParseResult<SlopeSnapshot> {
	if (typeof input !== 'object' || input === null) return fail(['slope payload must be an object']);
	const root = input as Record<string, unknown>;
	const slopes = Array.isArray(root.slopes) ? root.slopes : null;
	if (!slopes) return fail(['slopes array missing']);

	const meta = (root._meta as Record<string, unknown> | undefined) ?? {};

	const errors: string[] = [];
	const records: SlopeRecord[] = slopes.map((raw, idx) => {
		const r = raw as Record<string, unknown>;
		const difficulty = (typeof r.difficulty === 'string' && DIFFICULTIES.has(r.difficulty)
			? r.difficulty
			: 'unknown') as SlopeRecord['difficulty'];
		const status = r.status === 'open' || r.status === 'closed' ? r.status : 'closed';
		if (typeof r.external_id !== 'string') errors.push(`slope[${idx}].external_id missing`);
		if (typeof r.name !== 'string') errors.push(`slope[${idx}].name missing`);
		return {
			externalId: typeof r.external_id === 'string' ? r.external_id : '',
			name: typeof r.name === 'string' ? r.name : '',
			difficulty,
			lengthM: typeof r.length_m === 'number' ? r.length_m : undefined,
			status
		};
	});

	if (errors.length > 0) return fail(errors);

	return {
		ok: true,
		fatal: false,
		data: {
			kind: 'slope_status',
			slopes: records,
			fetchedAt: typeof meta.fetched_at === 'string' ? meta.fetched_at : new Date().toISOString(),
			sourceUpdatedAt:
				typeof meta.source_updated_at === 'string' ? meta.source_updated_at : undefined
		},
		errors: [],
		warnings: []
	};
}