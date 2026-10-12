import type {
	NormalizedFactCandidate,
	SourceConfig,
	StageResult,
	ValidationState
} from './types.js';

export interface RangeRule {
	readonly key: string;
	readonly min: number;
	readonly max: number;
	readonly unit: string;
	readonly allowText?: boolean;
	readonly allowedValues?: ReadonlyArray<string>;
}

export interface RuleSet {
	readonly category: NormalizedFactCandidate['category'];
	readonly rules: ReadonlyArray<RangeRule>;
}

export function createRangeValidator(rules: ReadonlyArray<RangeRule>) {
	const lookup = new Map(rules.map((rule) => [rule.key, rule]));

	return function validate(
		candidates: ReadonlyArray<NormalizedFactCandidate>,
		source: SourceConfig
	): StageResult<ReadonlyArray<NormalizedFactCandidate>> {
		void source;
		const errors: string[] = [];
		const accepted: NormalizedFactCandidate[] = [];
		const seen = new Set<string>();

		for (const candidate of candidates) {
			const identity = `${candidate.category}.${candidate.key}`;
			if (seen.has(identity)) {
				errors.push(`duplicate fact ${identity}`);
				continue;
			}
			seen.add(identity);

			const rule = lookup.get(candidate.key) ?? lookup.get(candidate.fieldKey ?? '');
			if (!rule) {
				errors.push(`unsupported metric ${identity}`);
				continue;
			}

			const hasNumeric = candidate.valueNumeric !== undefined;
			const hasText = candidate.valueText !== undefined;
			if (hasNumeric === hasText) {
				errors.push(`fact ${identity} must contain exactly one value`);
				continue;
			}

			if (hasText) {
				const value = candidate.valueText!.trim();
				if (!rule.allowText || !rule.allowedValues || !rule.allowedValues.includes(value)) {
					errors.push(`text value for ${identity} is not allowed`);
					continue;
				}
				if (candidate.unit !== undefined && candidate.unit !== rule.unit) {
					errors.push(`unit mismatch for ${identity}`);
					continue;
				}
				accepted.push({ ...candidate, valueText: value });
				continue;
			}

			const value = candidate.valueNumeric!;
			if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
				errors.push(`value for ${identity} is outside the approved range`);
				continue;
			}
			if (candidate.unit !== rule.unit) {
				errors.push(`unit mismatch for ${identity}`);
				continue;
			}
			accepted.push(candidate);
		}

		return {
			ok: accepted.length > 0,
			data: accepted,
			errors,
			warnings:
				errors.length > 0 && accepted.length > 0
					? ['some candidates were rejected; only validated candidates may be persisted']
					: []
		};
	};
}

export interface FactWithValidation {
	readonly candidate: NormalizedFactCandidate;
	readonly validation: ValidationState;
	readonly reasons: ReadonlyArray<string>;
}

export function applyValidationFacts(
	accepted: ReadonlyArray<NormalizedFactCandidate>,
	knownRanges: ReadonlyArray<RangeRule>
): ReadonlyArray<FactWithValidation> {
	const lookup = new Map(knownRanges.map((rule) => [rule.key, rule]));
	return accepted.map((candidate) => {
		const rule = lookup.get(candidate.key) ?? lookup.get(candidate.fieldKey ?? '');
		return {
			candidate,
			validation: rule ? 'validated' : 'needs_review',
			reasons: rule ? [] : ['no validation rule defined']
		};
	});
}
