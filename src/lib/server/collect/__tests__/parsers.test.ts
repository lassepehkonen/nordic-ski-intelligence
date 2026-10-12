import { describe, expect, it } from 'vitest';
import { parseSnowResponse } from '../parsers/levi/snow.js';
import { parseLiftResponse } from '../parsers/levi/lifts.js';
import { parseSlopeResponse } from '../parsers/levi/slopes.js';
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

describe('Levi snow parser', () => {
	it('parses the synthetic snow fixture from JSON text without a live request', () => {
		const result = parseSnowResponse(JSON.stringify(fixtures('snow')));
		expect(result.ok).toBe(true);
		expect(result.fatal).toBe(false);
		expect(result.data).toMatchObject({
			kind: 'snow_snapshot',
			baseDepthCm: 62,
			midDepthCm: 55,
			summitDepthCm: 78,
			newSnow24hCm: 3,
			newSnow72hCm: 9,
			surfaceCondition: 'packed_powder'
		});
		expect(result.data?.sourceUpdatedAt).toBe('2026-02-20T08:30:00.000Z');
	});

	it('returns a fatal ParseResult when a numeric field is the wrong type', () => {
		const malformed = JSON.parse(
			readFileSync(
				resolve(here, '../../../../../tests/fixtures/resorts/levi/snow/malformed-response.json'),
				'utf8'
			)
		);
		const result = parseSnowResponse(malformed);
		expect(result.ok).toBe(false);
		expect(result.fatal).toBe(true);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});

describe('Levi lift parser', () => {
	it('parses the synthetic lifts fixture', () => {
		const result = parseLiftResponse(fixtures('lifts'));
		expect(result.ok).toBe(true);
		expect(result.fatal).toBe(false);
		expect(result.data?.lifts).toHaveLength(3);
		expect(result.data?.lifts.map((l) => l.status)).toEqual(['open', 'open', 'closed']);
		expect(result.data?.lifts[0]?.externalId).toBe('fixture-lift-a');
	});

	it('rejects an unknown lift status instead of treating it as closed', () => {
		const result = parseLiftResponse({
			_meta: { fetched_at: '2026-02-20T08:30:00.000Z' },
			lifts: [{ external_id: 'lift-a', name: 'Lift A', status: 'maintenance' }]
		});
		expect(result.ok).toBe(false);
		expect(result.errors.join(' ')).toMatch(/status/i);
	});
});

describe('Levi slope parser', () => {
	it('parses the synthetic slopes fixture', () => {
		const result = parseSlopeResponse(fixtures('slopes'));
		expect(result.ok).toBe(true);
		expect(result.fatal).toBe(false);
		expect(result.data?.slopes).toHaveLength(3);
		expect(result.data?.slopes.map((s) => s.difficulty)).toEqual(['green', 'blue', 'black']);
		expect(result.data?.slopes[0]?.lengthM).toBe(800);
	});

	it('rejects an unknown slope status instead of treating it as closed', () => {
		const result = parseSlopeResponse({
			_meta: { fetched_at: '2026-02-20T08:30:00.000Z' },
			slopes: [{ external_id: 'slope-a', name: 'Slope A', difficulty: 'blue', status: 'unknown' }]
		});
		expect(result.ok).toBe(false);
		expect(result.errors.join(' ')).toMatch(/status/i);
	});
});
