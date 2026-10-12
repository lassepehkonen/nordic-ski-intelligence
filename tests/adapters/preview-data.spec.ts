import { describe, expect, it } from 'vitest';
import { buildSampleConditions, listSampleResortIds } from '../../src/lib/data/conditions.js';
import { createPreviewRepositories } from '../../src/lib/data/repository.js';
import { RESORTS } from '../../src/lib/data/resorts.js';
import { SAMPLE_CONDITIONS_SOURCE } from '../../src/lib/data/sources.js';
import { freshnessOf } from '../../src/lib/domain/freshness.js';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const repositories = createPreviewRepositories();

describe('sample conditions adapter', () => {
	it('produces a labelled snapshot for every curated resort', () => {
		expect(listSampleResortIds()).toHaveLength(RESORTS.length);
		for (const resort of RESORTS) {
			const conditions = buildSampleConditions(resort.id, NOW);
			expect(conditions, resort.id).not.toBeNull();
			expect(conditions?.dataState).toBe('illustrative');
			expect(conditions?.station).not.toBeNull();
			expect(conditions?.forecast.points).toHaveLength(5);
		}
	});

	it('marks every observation as illustrative and traceable to the sample source', () => {
		const conditions = buildSampleConditions('levi', NOW);
		const observations = [...(conditions?.observations ?? []), ...(conditions?.weather ?? [])];
		expect(observations.length).toBeGreaterThan(5);
		for (const observation of observations) {
			expect(observation.dataState).toBe('illustrative');
			expect(observation.sourceId).toBe(SAMPLE_CONDITIONS_SOURCE.id);
			expect(observation.confidence).toBe('low');
		}
	});

	it('is deterministic for a fixed clock, so the UI and tests see the same numbers', () => {
		expect(buildSampleConditions('trysil', NOW)).toEqual(buildSampleConditions('trysil', NOW));
	});

	it('derives freshness windows from the clock instead of storing a stale boolean', () => {
		const conditions = buildSampleConditions('levi', NOW);
		const first = conditions?.observations[0];
		expect(first && freshnessOf(first, NOW)).toBe('fresh');

		// The same snapshot read a week later must report itself as stale.
		const later = new Date(NOW.getTime() + 7 * 86_400_000);
		expect(first && freshnessOf(first, later)).toBe('stale');
	});

	it('includes one deliberately stale resort so the stale state is visible in the product', () => {
		const tahko = buildSampleConditions('tahko', NOW);
		const freshnesses = (tahko?.observations ?? []).map((observation) =>
			freshnessOf(observation, NOW)
		);
		expect(freshnesses.every((state) => state === 'stale')).toBe(true);
	});

	it('keeps piste and lift observations out when the resort has no sourced totals', () => {
		const hafjell = buildSampleConditions('hafjell', NOW);
		const metrics = (hafjell?.observations ?? []).map((observation) => observation.metric);
		expect(metrics).not.toContain('total_pistes');
		expect(metrics).not.toContain('open_pistes');
	});

	it('returns null for an unknown resort rather than inventing a snapshot', () => {
		expect(buildSampleConditions('nowhere', NOW)).toBeNull();
	});
});

describe('preview repositories', () => {
	it('reads a resort by slug and reports a not-found result otherwise', () => {
		const found = repositories.resorts.getBySlug('are');
		expect(found.ok && found.value.country).toBe('SE');

		const missing = repositories.resorts.getBySlug('nowhere');
		expect(missing).toEqual({ ok: false, reason: 'not_found' });
	});

	it('exposes the score and rating through their own read contracts', () => {
		const score = repositories.scores.getCurrent('hemsedal', NOW);
		const rating = repositories.ratings.getPublished('hemsedal');

		expect(score.ok && score.value.score).toBeGreaterThan(0);
		expect(score.ok && score.value.version).toBe('v1');
		expect(rating.ok && (rating.value.overall ?? 0)).toBeGreaterThan(0);
		expect(repositories.scores.getCurrent('nowhere', NOW)).toEqual({
			ok: false,
			reason: 'not_found'
		});
	});

	it('lists each resort once with a localized translation', () => {
		const finnish = repositories.listItems('fi', NOW);
		const english = repositories.listItems('en', NOW);
		expect(new Set(finnish.map((item) => item.resort.id)).size).toBe(RESORTS.length);
		const yllasFi = finnish.find((item) => item.resort.id === 'yllas');
		const yllasEn = english.find((item) => item.resort.id === 'yllas');
		expect(yllasFi?.translation.locale).toBe('fi');
		expect(yllasFi?.translation.summary).not.toBe(yllasEn?.translation.summary);
	});

	it('collects unique sources and adds the sample source only for illustrative data', () => {
		const resort = repositories.resorts.getBySlug('levi');
		const conditions = repositories.conditions.getLatestForResort('levi', NOW);
		if (!resort.ok || !conditions.ok) throw new Error('levi must exist in the preview dataset');

		const sources = repositories.sourcesFor(resort.value, conditions.value);
		expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length);
		expect(sources.map((source) => source.id)).toContain(SAMPLE_CONDITIONS_SOURCE.id);
		expect(sources.map((source) => source.id)).toContain('site-levi');
		expect(sources.every((source) => source.status !== 'approved')).toBe(true);
	});
});
