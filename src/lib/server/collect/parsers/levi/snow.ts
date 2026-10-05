import type { ParseResult } from '../types.js';

export interface SnowSnapshot {
	readonly kind: 'snow_snapshot';
	readonly baseDepthCm: number;
	readonly midDepthCm: number;
	readonly summitDepthCm: number;
	readonly newSnow24hCm: number;
	readonly newSnow72hCm: number;
	readonly surfaceCondition: string;
	readonly lastMeasuredAt?: string;
	readonly sourceUpdatedAt?: string;
	readonly fetchedAt: string;
}

function fail(errors: string[]): ParseResult<SnowSnapshot> {
	return { ok: false, fatal: true, errors, warnings: [] };
}

function asFiniteNumber(x: unknown, field: string, errors: string[]): number | undefined {
	if (typeof x !== 'number' || !Number.isFinite(x)) {
		errors.push(`field ${field} is not a finite number`);
		return undefined;
	}
	return x;
}

export function parseSnowResponse(input: unknown): ParseResult<SnowSnapshot> {
	if (typeof input !== 'object' || input === null) return fail(['snow payload must be an object']);

	const root = input as Record<string, unknown>;
	const meta = (root._meta as Record<string, unknown> | undefined) ?? {};
	const snow = (root.snow as Record<string, unknown> | undefined) ?? {};
	const errors: string[] = [];

	const baseDepthCm = asFiniteNumber(snow.base_depth_cm, 'snow.base_depth_cm', errors);
	const midDepthCm = asFiniteNumber(snow.mid_depth_cm, 'snow.mid_depth_cm', errors);
	const summitDepthCm = asFiniteNumber(snow.summit_depth_cm, 'snow.summit_depth_cm', errors);
	const newSnow24hCm = asFiniteNumber(snow.new_snow_24h_cm, 'snow.new_snow_24h_cm', errors);
	const newSnow72hCm = asFiniteNumber(snow.new_snow_72h_cm, 'snow.new_snow_72h_cm', errors);
	if (typeof snow.surface_condition !== 'string') {
		errors.push('snow.surface_condition must be a string');
	}

	if (errors.length > 0) return fail(errors);

	return {
		ok: true,
		fatal: false,
		data: {
			kind: 'snow_snapshot',
			baseDepthCm: baseDepthCm!,
			midDepthCm: midDepthCm!,
			summitDepthCm: summitDepthCm!,
			newSnow24hCm: newSnow24hCm!,
			newSnow72hCm: newSnow72hCm!,
			surfaceCondition: snow.surface_condition as string,
			lastMeasuredAt: typeof snow.last_measured_at === 'string' ? snow.last_measured_at : undefined,
			sourceUpdatedAt:
				typeof meta.source_updated_at === 'string' ? meta.source_updated_at : undefined,
			fetchedAt: typeof meta.fetched_at === 'string' ? meta.fetched_at : new Date().toISOString()
		},
		errors: [],
		warnings: []
	};
}