import { describe, expect, it } from 'vitest';
import * as scoring from '../../src/lib/server/scoring/index.js';

describe('scoring barrel', () => {
	it('exports the pure public API surface without UI/DB leakage', () => {
		const keys = Object.keys(scoring).sort();
		const required = [
			'CONDITIONS_COMPONENT_IDS',
			'CONDITIONS_SCORE_ACTIVE_VERSION_ID',
			'CONDITIONS_SCORE_VERSIONS',
			'RESORT_RATING_ACTIVE_VERSION_ID',
			'RESORT_RATING_CATEGORY_IDS',
			'RESORT_RATING_VERSIONS',
			'SNOW_QUALITY_VALUES',
			'ScoringConfigError',
			'computeConditionsScore',
			'computeResortRating',
			'forecastSnowfallCm',
			'listResortRatingCategories',
			'mapPilotResortToConditionsScoreInputs',
			'resolveConditionsScoreConfig',
			'resolveResortRatingConfig',
			'validateConfig',
			'validateConditionsScoreConfig',
			'validateResortRatingConfig'
		];

		for (const key of required) expect(keys).toContain(key);
		for (const key of keys) {
			expect(key).not.toMatch(/review|external|db|svelte|fetch/i);
		}
	});

	it('error class identity is stable through the barrel', () => {
		const thrown = new scoring.ScoringConfigError(['test_reason']);
		expect(thrown).toBeInstanceOf(scoring.ScoringConfigError);
		expect(thrown.reasonKeys).toEqual(['test_reason']);
	});
});
