import { describe, expect, it } from 'vitest';
import {
	getStatusFreshness,
	isStatusDisplayApproved,
	pilotResorts,
	validatePilotResort
} from '../../src/lib/server/resorts/pilot.js';

describe('Phase 5 resort adapter catalog', () => {
	it('covers the ten configured resorts across Finland, Sweden and Norway', () => {
		expect(pilotResorts).toHaveLength(10);
		expect(pilotResorts.filter((resort) => resort.countryCode === 'FI')).toHaveLength(6);
		expect(pilotResorts.filter((resort) => resort.countryCode === 'SE')).toHaveLength(2);
		expect(pilotResorts.filter((resort) => resort.countryCode === 'NO')).toHaveLength(2);
	});

	it('uses one country weather adapter contract and source record per resort', () => {
		for (const resort of pilotResorts) {
			expect(resort.weather.provider).toBe(
				resort.countryCode === 'FI' ? 'fmi' : resort.countryCode === 'SE' ? 'smhi' : 'met-no'
			);
			expect(resort.weather.sourceUrl).toMatch(/^https:\/\//);
			expect(resort.status.sourceUrl).toMatch(/^https:\/\//);
		}
	});

	it('accepts resort eleven as config plus an existing source adapter', () => {
		const eleventh = {
			...pilotResorts[0],
			slug: 'pallas',
			name: 'Pallas'
		};

		expect(() => validatePilotResort(eleventh)).not.toThrow();
	});

	it('keeps missing and stale reports distinct from a confirmed zero', () => {
		const riksgransen = pilotResorts.find((resort) => resort.slug === 'riksgransen');

		expect(riksgransen).toBeDefined();
		expect(riksgransen?.status.freshness).toBe('unavailable');
		expect(riksgransen?.status.pistes.open).toBeNull();
		expect(riksgransen?.status.lifts.open).toBeNull();
	});

	it('expires manual status after six hours and uses the product-owner count authorization', () => {
		const levi = pilotResorts.find((resort) => resort.slug === 'levi');

		expect(levi).toBeDefined();
		expect(getStatusFreshness(levi!.status, new Date('2026-10-12T17:29:26Z'))).toBe('fresh');
		expect(getStatusFreshness(levi!.status, new Date('2026-10-12T17:29:27Z'))).toBe('stale');
		expect(isStatusDisplayApproved(levi!.status)).toBe(true);
	});

	it('stores only the four authorized count values from operator pages', () => {
		for (const resort of pilotResorts) {
			expect(Object.keys(resort.status).sort()).toEqual(
				['displayApproval', 'fetchedAt', 'freshness', 'lifts', 'pistes', 'sourceUrl'].sort()
			);
			expect(Object.keys(resort.inventory).sort()).toEqual(['lifts', 'pistes', 'sourceUrl'].sort());
		}
		const yllas = pilotResorts.find((resort) => resort.slug === 'yllas');
		expect(yllas?.status.lifts.total).toBeNull();
		expect(yllas?.status.pistes.total).toBeNull();
		expect(yllas?.status.pistes.open).toBeNull();
		expect(
			pilotResorts.find((resort) => resort.slug === 'iso-syote')?.status.lifts.open
		).toBeNull();
		const are = pilotResorts.find((resort) => resort.slug === 'are');
		expect(are?.inventory.lifts).toBe(47);
		expect(are?.inventory.pistes).toBe(89);
	});
});
