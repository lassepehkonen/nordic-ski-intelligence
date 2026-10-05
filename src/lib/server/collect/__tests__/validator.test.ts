import { describe, expect, it } from 'vitest';
import { createRangeValidator } from '../validator.js';
import { scoreConfidence } from '../confidence.js';
import { detectConflicts } from '../conflicts.js';
import { normalizeSnow } from '../normalizers/snow.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { SourceConfig, SourceId, ValidatedFact } from '../types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
	readFileSync(
		resolve(here, '../../../../../tests/fixtures/resorts/levi/snow/synthetic-response.json'),
		'utf8'
	)
);

const SOURCE: SourceConfig = {
	sourceId: 'levi-fixture' as SourceId,
	sourceKind: 'synthetic',
	endpoint: 'https://example.invalid/levi/snow',
	requestTimeoutMs: 1000,
	retry: { maxAttempts: 1, baseMs: 1, capMs: 1, jitterRatio: 0 },
	rateLimit: { requestsPerWindow: 1000, windowMs: 1000 },
	cacheTtlMs: 5000,
	staleAfterMs: 60_000,
	permitRawStorage: false
};

describe('Range validator', () => {
	const validate = createRangeValidator([
		{ key: 'base_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'mid_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'summit_depth', min: 0, max: 1000, unit: 'cm' },
		{ key: 'new_snow_24h', min: 0, max: 100, unit: 'cm' },
		{ key: 'new_snow_72h', min: 0, max: 300, unit: 'cm' }
	]);

	it('passes all numeric candidates within their declared ranges', () => {
		const facts = normalizeSnow(fixture);
		const result = validate(facts, SOURCE);
		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('rejects a numeric candidate outside its declared range', () => {
		const result = validate(
			[{ category: 'snow', key: 'new_snow_24h', valueNumeric: 999, unit: 'cm' }],
			SOURCE
		);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toMatch(/new_snow_24h/);
	});

	it('rejects an unknown fact key that has no rule', () => {
		const result = validate(
			[{ category: 'snow', key: 'unsupported_metric', valueNumeric: 5, unit: 'cm' }],
			SOURCE
		);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toMatch(/unsupported/);
	});
});

describe('Confidence scorer', () => {
	it('returns medium confidence for fully validated fixture data', () => {
		const facts = normalizeSnow(fixture);
		const out = scoreConfidence(facts[0], SOURCE);
		expect(['low', 'medium', 'high']).toContain(out.confidence);
		expect(out.reasons.length).toBeGreaterThan(0);
	});

	it('returns unknown for a candidate missing source-observed time', () => {
		const out = scoreConfidence(
			{ category: 'snow', key: 'base_depth', valueNumeric: 50, unit: 'cm' },
			SOURCE
		);
		expect(out.confidence).toBe('unknown');
	});

	it('returns low for a synthetic source', () => {
		const out = scoreConfidence(
			{ category: 'snow', key: 'base_depth', valueNumeric: 50, unit: 'cm', sourceObservedAt: '2026-02-20T08:00:00.000Z' },
			SOURCE
		);
		expect(out.confidence).toBe('low');
	});
});

describe('Conflict detector', () => {
	function fact(overrides: Partial<ValidatedFact['candidate']>): ValidatedFact {
		return {
			candidate: { category: 'snow', key: 'base_depth', valueNumeric: 50, unit: 'cm', ...overrides },
			validation: 'validated',
			confidence: 'medium',
			sourceId: SOURCE.sourceId,
			approvalId: '00000000-0000-0000-0000-000000000001',
			sourceReferenceId: '00000000-0000-0000-0000-000000000002',
			fetchedAt: '2026-02-20T09:00:00.000Z',
			validUntil: '2026-02-20T18:00:00.000Z',
			retentionExpiresAt: '2026-02-27T09:00:00.000Z',
			reasons: []
		};
	}

	it('queues a conflict when the new value differs from an approved existing value', () => {
		const existing = new Map<string, unknown>([['snow.base_depth', 60]]);
		const conflicts = detectConflicts([fact({ valueNumeric: 50 })], existing);
		expect(conflicts).toHaveLength(1);
		expect(conflicts[0]?.resolution).toBe('queue_for_review');
		expect(conflicts[0]?.existingValue).toBe(60);
	});

	it('does not conflict when the new value matches the existing value', () => {
		const existing = new Map<string, unknown>([['snow.base_depth', 50]]);
		expect(detectConflicts([fact({ valueNumeric: 50 })], existing)).toEqual([]);
	});

	it('does not conflict when there is no existing value for the key', () => {
		const existing = new Map<string, unknown>();
		expect(detectConflicts([fact({ valueNumeric: 50 })], existing)).toEqual([]);
	});
});