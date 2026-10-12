/**
 * Pure compute for the permanent Resort Rating (ADR-0009).
 *
 * Separation contract:
 * - The rating consumes only explicitly provided category values (internal 0–100
 *   computation scale). It neither imports nor exposes anything from any external
 *   rating/review concept, and it has no data source of its own.
 * - Unknown extra properties in the input are reported in `ignoredInputKeys` and can
 *   never influence the weighted mean. When the input carries at least one unknown key
 *   but NO recognized category key, it cannot be a category payload at all (caller or
 *   config-version mismatch): `computeResortRating` throws ScoringConfigError
 *   instead of returning an empty rating.
 * - Missing categories are skipped, never zero-filled; the coverage share is reported
 *   and gated by `gates.minimumCategoryCoverageShare`. Below the gate: rating = null,
 *   published = false, explicit reason key.
 * - No DB, no SvelteKit, no network, no default clock: `options.now` must be injected.
 */
import {
	ScoringConfigError,
	resolveResortRatingConfig,
	type ResortRatingConfig
} from './config.js';
import { dedupeStrings, round4 } from './scoring-math.js';
import type {
	ResortRatingCategoryId,
	ResortRatingExplanation,
	ResortRatingInputCategoryValues,
	ResortRatingResult,
	ScoringComputeOptions,
	ScoringExplanationMessage
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reason(
	key: string,
	subjectId: string | null,
	params: Record<string, string | number> = {}
): ScoringExplanationMessage {
	return Object.freeze({ key, subjectId, params: Object.freeze({ ...params }) });
}

/** Public list of the rating categories with their configured weights, per version. */
export function listResortRatingCategories(versionId?: string): {
	readonly id: ResortRatingCategoryId;
	readonly weight: number;
}[] {
	const config = resolveResortRatingConfig(versionId);
	return config.categories.map((category) => ({ id: category.id, weight: category.weight }));
}

interface CategoryEvaluation {
	readonly id: ResortRatingCategoryId;
	readonly weight: number;
	readonly value: number | null;
	readonly status: 'ok' | 'missing';
	readonly reasons: ScoringExplanationMessage[];
}

function evaluateCategories(
	config: ResortRatingConfig,
	categoryValues: ResortRatingInputCategoryValues
): CategoryEvaluation[] {
	return config.categories.map((category) => {
		const raw = categoryValues[category.id];
		const reasons: ScoringExplanationMessage[] = [];
		// Out-of-range and non-numeric values make the category missing for the weighted
		// mean; they are never silently coerced to the nearest bound (ADR-0009).
		if (raw === undefined || raw === null) {
			reasons.push(reason('scoring_category_missing', category.id));
			return {
				id: category.id,
				weight: category.weight,
				value: null,
				status: 'missing' as const,
				reasons
			};
		}
		if (typeof raw !== 'number' || !Number.isFinite(raw)) {
			reasons.push(reason('scoring_category_not_a_number', category.id));
			return {
				id: category.id,
				weight: category.weight,
				value: null,
				status: 'missing' as const,
				reasons
			};
		}
		const { min, max } = config.computationScale;
		if (raw < min || raw > max) {
			reasons.push(reason('scoring_category_out_of_range', category.id, { min, max }));
			return {
				id: category.id,
				weight: category.weight,
				value: null,
				status: 'missing' as const,
				reasons
			};
		}
		return {
			id: category.id,
			weight: category.weight,
			value: round4(raw),
			status: 'ok' as const,
			reasons
		};
	});
}

export function computeResortRating(
	versionId: string | undefined,
	categoryValues: ResortRatingInputCategoryValues,
	options: ScoringComputeOptions
): ResortRatingResult {
	if (!isRecord(options) || typeof options.now !== 'function') {
		throw new Error('scoring_compute_requires_injected_clock');
	}
	if (!isRecord(categoryValues) || Object.keys(categoryValues).length === 0) {
		throw new ScoringConfigError(
			['scoring_resort_rating_input_invalid'],
			'Resort rating category values must be a non-empty object of category id → number|null'
		);
	}
	const config = resolveResortRatingConfig(versionId);
	const asOf = options.now();
	if (!Number.isFinite(asOf.getTime())) throw new Error('scoring_clock_invalid');

	// Foreign keys (e.g. review payloads smuggled into the input) are ignored, never read.
	const recognizedIds = new Set<string>(config.categories.map((category) => category.id));
	const allKeys = Object.keys(categoryValues);
	const unknownKeys = allKeys.filter((key) => !recognizedIds.has(key)).sort();
	const hasRecognizedKey = allKeys.some((key) => recognizedIds.has(key));
	if (unknownKeys.length > 0 && !hasRecognizedKey) {
		throw new ScoringConfigError(
			['scoring_resort_rating_unknown_category'],
			`Input carries no recognized resort rating category; unknown keys: ${unknownKeys.join(', ')}`
		);
	}

	const categories = evaluateCategories(config, categoryValues);

	let availableWeightSum = 0;
	let weightedSum = 0;
	for (const category of categories) {
		if (category.status === 'ok' && category.value !== null) {
			availableWeightSum += category.weight;
			weightedSum += category.value * category.weight;
		}
	}

	const totalWeight = config.categories.reduce((sum, category) => sum + category.weight, 0);
	const coverageShare = totalWeight > 0 ? availableWeightSum / totalWeight : 0;
	const roundedShare = round4(coverageShare);
	const coverageThreshold = config.gates.minimumCategoryCoverageShare;
	const gatePassed = coverageShare >= coverageThreshold;

	const missingCategoryIds = categories
		.filter((category) => category.status !== 'ok')
		.map((category) => category.id);

	// Contribution = share of the rating this category explains, on the 0–100 scale.
	// Null while unpublished: an unpublished result commits to no per-category numbers.
	const contributions = new Map<ResortRatingCategoryId, number | null>();
	for (const category of categories) {
		contributions.set(
			category.id,
			category.status === 'ok' && category.value !== null && availableWeightSum > 0 && gatePassed
				? round4((category.value * category.weight) / availableWeightSum)
				: null
		);
	}

	const warnings: ScoringExplanationMessage[] = [];
	for (const id of missingCategoryIds) {
		warnings.push(reason('scoring_missing_category_excluded', id));
	}
	for (const key of unknownKeys) {
		warnings.push(reason('scoring_unknown_category_ignored', null, { key }));
	}
	if (!gatePassed) {
		warnings.push(
			reason('scoring_coverage_below_threshold', null, {
				coverageShare: roundedShare,
				threshold: coverageThreshold
			})
		);
	}

	// Category values arrive on the 0–100 computation scale, so the weighted mean over
	// available weights is already on the rating scale (no scaleSpan multiplication).
	const ratingValue =
		gatePassed && availableWeightSum > 0 ? round4(weightedSum / availableWeightSum) : null;

	const categoryResults = categories.map((category) => ({
		id: category.id,
		weight: category.weight,
		value: category.value,
		contribution: contributions.get(category.id) ?? null,
		status: category.status,
		reasons: category.reasons
	}));

	const result: ResortRatingResult = {
		rating: ratingValue,
		published: gatePassed && availableWeightSum > 0,
		version: config.versionId,
		computedAt: asOf.toISOString(),
		coverage: {
			availableCategoryCount: categoryResults.filter((category) => category.status === 'ok').length,
			totalCategoryCount: config.categories.length,
			coverageShare: roundedShare,
			coverageThreshold
		},
		categories: categoryResults,
		missingCategoryIds,
		ignoredInputKeys: unknownKeys,
		warnings,
		explanation(): ResortRatingExplanation {
			const gateReasonKeys: string[] = [];
			if (!gatePassed) gateReasonKeys.push('scoring_coverage_below_threshold');
			return {
				type: 'resort_rating_explanation',
				version: config.versionId,
				rating: result.rating,
				published: result.published,
				computedAt: result.computedAt,
				coverage: result.coverage,
				gate: { passed: gatePassed, reasonKeys: dedupeStrings(gateReasonKeys) },
				categories: categoryResults,
				missingCategoryIds,
				ignoredInputKeys: unknownKeys,
				warnings
			};
		}
	};
	return result;
}
