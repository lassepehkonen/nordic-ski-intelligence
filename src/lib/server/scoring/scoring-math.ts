/**
 * Shared pure math/format helpers for the scoring layer. No side effects, no state.
 */
import type { ConditionsComponentId } from './types.js';

/** Deterministic rounding to 4 decimals keeps serialized results byte-stable. */
export function round4(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

export function clip(value: number, range: { readonly min: number; readonly max: number }): number {
	return Math.min(range.max, Math.max(range.min, value));
}

/** Interpolates a piecewise-linear band. Points must be sorted by strictly increasing x (config validation ensures this); x before the first point extends the first segment, x after the last extends the last. */
export function piecewiseLinear(
	points: readonly { readonly x: number; readonly y: number }[],
	x: number
): number {
	if (points.length === 0) return 0;
	if (x <= points[0].x) return points[0].y;
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1];
		const current = points[index];
		if (x <= current.x) {
			const span = current.x - previous.x;
			if (span <= 0) return current.y;
			const ratio = (x - previous.x) / span;
			return previous.y + ratio * (current.y - previous.y);
		}
	}
	return points[points.length - 1].y;
}

export function dedupeComponentIds(ids: readonly ConditionsComponentId[]): ConditionsComponentId[] {
	return [...new Set(ids)];
}

export function dedupeStrings(values: readonly string[]): string[] {
	return [...new Set(values)];
}

/**
 * Reconciles the missing-component id list with the final per-component statuses
 * (buildComponents may downgrade an ok component to missing when normalization fails).
 */
export function evaluatedStatusToMissing(
	componentResults: readonly {
		readonly id: ConditionsComponentId;
		readonly status: 'ok' | 'stale' | 'missing' | 'out_of_range';
	}[]
): ConditionsComponentId[] {
	return dedupeComponentIds(
		componentResults
			.filter((component) => component.status === 'missing')
			.map((component) => component.id)
	);
}
