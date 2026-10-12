import type { ParseResult } from '../../types.js';
import { isRecord, parseJsonObject } from '../json-object.js';

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
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseSlopeResponse(input: unknown): ParseResult<SlopeSnapshot> {
	const decoded = parseJsonObject(input, 'slope payload');
	if (!decoded.ok) return fail([decoded.error]);
	const root = decoded.value;
	if (!Array.isArray(root.slopes)) return fail(['slopes array missing']);

	const meta = isRecord(root._meta) ? root._meta : {};
	const errors: string[] = [];
	const seen = new Set<string>();
	const records: SlopeRecord[] = [];

	root.slopes.forEach((raw, idx) => {
		if (!isRecord(raw)) {
			errors.push(`slope[${idx}] must be an object`);
			return;
		}
		const id = typeof raw.external_id === 'string' ? raw.external_id.trim() : '';
		const name = typeof raw.name === 'string' ? raw.name.trim() : '';
		if (!SAFE_SLUG.test(id)) errors.push(`slope[${idx}].external_id must be a stable slug`);
		if (!name) errors.push(`slope[${idx}].name missing`);
		if (seen.has(id)) errors.push(`duplicate slope external_id ${id}`);
		seen.add(id);
		if (raw.status !== 'open' && raw.status !== 'closed') {
			errors.push(`slope[${idx}].status must be open or closed`);
		}
		if (
			raw.length_m !== undefined &&
			(typeof raw.length_m !== 'number' || !Number.isFinite(raw.length_m) || raw.length_m < 0)
		) {
			errors.push(`slope[${idx}].length_m must be a non-negative finite number`);
		}
		const difficulty =
			typeof raw.difficulty === 'string' && DIFFICULTIES.has(raw.difficulty)
				? (raw.difficulty as SlopeRecord['difficulty'])
				: 'unknown';
		if ((raw.status === 'open' || raw.status === 'closed') && SAFE_SLUG.test(id) && name) {
			records.push({
				externalId: id,
				name,
				difficulty,
				lengthM: typeof raw.length_m === 'number' ? raw.length_m : undefined,
				status: raw.status
			});
		}
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
