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
}

export interface RuleSet {
	readonly category: NormalizedFactCandidate['category'];
	readonly rules: ReadonlyArray<RangeRule>;
}

export function createRangeValidator(rules: ReadonlyArray<RangeRule>) {
	const lookup = new Map<string, RangeRule>();
	for (const r of rules) lookup.set(r.key, r);

	return function validate(
		candidates: ReadonlyArray<NormalizedFactCandidate>,
		_source: SourceConfig
	): StageResult<ReadonlyArray<NormalizedFactCandidate>> {
		const errors: string[] = [];
		const accepted: NormalizedFactCandidate[] = [];
		const perKey = new Map<string, NormalizedFactCandidate>();

		for (const candidate of candidates) {
			const key = `${candidate.category}.${candidate.key}`;
			if (candidate.valueText !== undefined) {
				const rule = lookup.get(candidate.key);
				if (rule && !rule.allowText) {
					errors.push(`unsupported text value for ${key}`);
					continue;
				}
				perKey.set(key, candidate);
				accepted.push(candidate);
				continue;
			}
			const value = candidate.valueNumeric;
			if (value === undefined) {
				errors.push(`missing numeric value for ${key}`);
				continue;
			}
			const rule = lookup.get(candidate.key);
			if (!rule) {
				errors.push(`unsupported metric ${key}`);
				continue;
			}
			if (value < rule.min || value > rule.max) {
				errors.push(`out of range ${key}=${value} (${rule.min}-${rule.max} ${rule.unit})`);
				continue;
			}
			if (candidate.unit && candidate.unit !== rule.unit) {
				errors.push(`unit mismatch for ${key}: expected ${rule.unit}, got ${candidate.unit}`);
				continue;
			}
			perKey.set(key, candidate);
			accepted.push(candidate);
		}

		if (errors.length > 0 && accepted.length === 0) {
			return { ok: false, errors, warnings: [] };
		}

		if (errors.length > 0) {
			return {
				ok: accepted.length > 0,
				data: accepted,
				errors,
				warnings: ['some candidates were rejected but others accepted']
			};
		}

		return {
			ok: accepted.length > 0,
			data: accepted,
			errors,
			warnings: []
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
	const lookup = new Map(knownRanges.map((r) => [r.key, r]));
	return accepted.map<FactWithValidation>((candidate) => {
		const reasons: string[] = [];
		let validation: ValidationState = 'validated';
		const rule = lookup.get(candidate.key);
		if (!rule) {
			validation = 'needs_review';
			reasons.push('no range rule defined');
		} else if (candidate.valueNumeric !== undefined) {
			if (candidate.valueNumeric < rule.min || candidate.valueNumeric > rule.max) {
				validation = 'rejected';
				reasons.push(`value outside approved range [${rule.min}, ${rule.max}]`);
			}
		}
		return { candidate, validation, reasons };
	});
}