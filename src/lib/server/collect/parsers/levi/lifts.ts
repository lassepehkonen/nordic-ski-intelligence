import type { ParseResult } from '../../types.js';

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

export function parseLiftResponse(input: unknown): ParseResult<LiftSnapshot> {
	if (typeof input !== 'object' || input === null) return fail(['lift payload must be an object']);

	const root = input as Record<string, unknown>;
	const lifts = Array.isArray(root.lifts) ? root.lifts : null;
	if (!lifts) return fail(['lifts array missing']);

	const meta = (root._meta as Record<string, unknown> | undefined) ?? {};

	const errors: string[] = [];
	const records: LiftRecord[] = lifts.map((raw, idx) => {
		const r = raw as Record<string, unknown>;
		const status = r.status === 'open' || r.status === 'closed' ? r.status : 'closed';
		if (typeof r.external_id !== 'string') errors.push(`lift[${idx}].external_id missing`);
		if (typeof r.name !== 'string') errors.push(`lift[${idx}].name missing`);
		return {
			externalId: typeof r.external_id === 'string' ? r.external_id : '',
			name: typeof r.name === 'string' ? r.name : '',
			kind: typeof r.kind === 'string' ? r.kind : 'unknown',
			status,
			capacityPerHour: typeof r.capacity_per_hour === 'number' ? r.capacity_per_hour : undefined,
			closureReason: typeof r.closure_reason === 'string' ? r.closure_reason : undefined
		};
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