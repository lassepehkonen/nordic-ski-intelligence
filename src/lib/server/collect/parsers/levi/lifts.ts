import type { ParseResult } from '../../types.js';
import { isRecord, parseJsonObject } from '../json-object.js';

export interface LiftRecord {
	readonly externalId: string;
	readonly name: string;
	readonly kind: string;
	readonly status: 'open' | 'closed';
	readonly capacityPerHour?: number;
	readonly closureReason?: string;
}

export interface LiftSnapshot {
	readonly kind: 'lift_status';
	readonly lifts: ReadonlyArray<LiftRecord>;
	readonly fetchedAt: string;
	readonly sourceUpdatedAt?: string;
}

function fail(errors: string[]): ParseResult<LiftSnapshot> {
	return { ok: false, fatal: true, errors, warnings: [] };
}

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseLiftResponse(input: unknown): ParseResult<LiftSnapshot> {
	const decoded = parseJsonObject(input, 'lift payload');
	if (!decoded.ok) return fail([decoded.error]);
	const root = decoded.value;
	if (!Array.isArray(root.lifts)) return fail(['lifts array missing']);

	const meta = isRecord(root._meta) ? root._meta : {};
	const errors: string[] = [];
	const seen = new Set<string>();
	const records: LiftRecord[] = [];

	root.lifts.forEach((raw, idx) => {
		if (!isRecord(raw)) {
			errors.push(`lift[${idx}] must be an object`);
			return;
		}
		const id = typeof raw.external_id === 'string' ? raw.external_id.trim() : '';
		const name = typeof raw.name === 'string' ? raw.name.trim() : '';
		if (!SAFE_SLUG.test(id)) errors.push(`lift[${idx}].external_id must be a stable slug`);
		if (!name) errors.push(`lift[${idx}].name missing`);
		if (seen.has(id)) errors.push(`duplicate lift external_id ${id}`);
		seen.add(id);

		if (raw.status !== 'open' && raw.status !== 'closed') {
			errors.push(`lift[${idx}].status must be open or closed`);
		}
		if (
			raw.capacity_per_hour !== undefined &&
			(typeof raw.capacity_per_hour !== 'number' ||
				!Number.isFinite(raw.capacity_per_hour) ||
				raw.capacity_per_hour < 0)
		) {
			errors.push(`lift[${idx}].capacity_per_hour must be a non-negative finite number`);
		}
		if (raw.closure_reason !== undefined && typeof raw.closure_reason !== 'string') {
			errors.push(`lift[${idx}].closure_reason must be a string`);
		}
		if ((raw.status === 'open' || raw.status === 'closed') && SAFE_SLUG.test(id) && name) {
			records.push({
				externalId: id,
				name,
				kind: typeof raw.kind === 'string' ? raw.kind : 'unknown',
				status: raw.status,
				capacityPerHour:
					typeof raw.capacity_per_hour === 'number' ? raw.capacity_per_hour : undefined,
				closureReason: typeof raw.closure_reason === 'string' ? raw.closure_reason : undefined
			});
		}
	});

	if (errors.length > 0) return fail(errors);
	return {
		ok: true,
		fatal: false,
		data: {
			kind: 'lift_status',
			lifts: records,
			fetchedAt: typeof meta.fetched_at === 'string' ? meta.fetched_at : new Date().toISOString(),
			sourceUpdatedAt:
				typeof meta.source_updated_at === 'string' ? meta.source_updated_at : undefined
		},
		errors: [],
		warnings: []
	};
}
