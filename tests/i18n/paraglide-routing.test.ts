import { describe, expect, it } from 'vitest';
import { deLocalizeUrl, localizeHref, locales } from '../../src/lib/paraglide/runtime.js';

describe('Paraglide localized routes', () => {
	it('publishes only the four launch locales with prefixed home routes', () => {
		expect(locales).toEqual(['en', 'fi', 'sv', 'no']);

		for (const locale of locales) {
			expect(localizeHref('/', { locale })).toBe(`/${locale}`);
			expect(deLocalizeUrl(new URL(`https://ski.example/${locale}`)).pathname).toBe('/');
		}
	});
});
