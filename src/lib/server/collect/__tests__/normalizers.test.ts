import { describe, expect, it } from 'vitest';
import { normalizeSnow } from '../normalizers/snow.js';
import { normalizeLifts } from '../normalizers/lifts.js';
import { normalizeSlopes } from '../normalizers/slopes.js';
import { parseSnowResponse } from '../parsers/levi/snow.js';
import { parseLiftResponse } from '../parsers/levi/lifts.js';
import { parseSlopeResponse } from '../parsers/levi/slopes.js';
import type { NormalizedFactCandidate } from '../types.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = (sub: string): unknown =>
	JSON.parse(
		readFileSync(
			resolve(here, `../../../../../tests/fixtures/resorts/levi/${sub}/synthetic-response.json`),
			'utf8'
		)
	);
const expected = (name: string): { facts: ReadonlyArray<NormalizedFactCandidate> } =>
	JSON.parse(
		readFileSync(
			resolve(here, `../../../../../tests/fixtures/resorts/levi/expected/${name}.json`),
			'utf8'
		)
	);

describe('Snow normalizer', () => {
	it('maps the synthetic snow snapshot to canonical fact candidates', () => {
		const parsed = parseSnowResponse(fixtures('snow'));
		expect(parsed.ok).toBe(true);
		const facts = normalizeSnow(parsed.data!);

		expect(facts.length).toBeGreaterThan(0);
		expect(facts).toMatchObject(expected('normalized-snow').facts);
	});
});

describe('Lift normalizer', () => {
	it('maps the synthetic lifts payload to fact candidates including per-lift details', () => {
		const parsed = parseLiftResponse(fixtures('lifts'));
		expect(parsed.ok).toBe(true);
		const facts = normalizeLifts(parsed.data!);
		expect(facts).toMatchObject(expected('normalized-lifts').facts);
		expect(facts.find((f) => f.key === 'open_count')?.valueNumeric).toBe(2);
		expect(facts.find((f) => f.key === 'total_count')?.valueNumeric).toBe(3);
	});

	it('emits one fact per lift detail record', () => {
		const parsed = parseLiftResponse(fixtures('lifts'));
		expect(parsed.ok).toBe(true);
		const facts = normalizeLifts(parsed.data!);
		const perLift = facts.filter((f) => f.key.startsWith('lift.'));
		expect(perLift.length).toBe(3);
	});
});

describe('Slope normalizer', () => {
	it('maps the synthetic slopes payload to fact candidates', () => {
		const parsed = parseSlopeResponse(fixtures('slopes'));
		expect(parsed.ok).toBe(true);
		const facts = normalizeSlopes(parsed.data!);
		expect(facts).toMatchObject(expected('normalized-slopes').facts);
		expect(facts.find((f) => f.key === 'open_count')?.valueNumeric).toBe(2);
		expect(facts.find((f) => f.key === 'total_count')?.valueNumeric).toBe(3);
	});

	it('emits one fact per slope detail record', () => {
		const parsed = parseSlopeResponse(fixtures('slopes'));
		expect(parsed.ok).toBe(true);
		const facts = normalizeSlopes(parsed.data!);
		const perSlope = facts.filter((f) => f.key.startsWith('piste.'));
		expect(perSlope.length).toBe(3);
	});
});
