import { describe, expect, it } from 'vitest';
import { buildSeo } from '../../src/lib/seo.js';

describe('buildSeo', () => {
	it('builds canonical URLs with the locale prefix and hreflang alternates for every locale plus x-default', () => {
		const seo = buildSeo({
			path: '/resort/levi',
			title: 'Levi conditions',
			description: 'Current conditions in Levi.',
			locale: 'fi',
			origin: 'https://example.com'
		});

		expect(seo.canonical).toBe('https://example.com/fi/resort/levi');
		const alternates = Object.fromEntries(seo.alternates.map((a) => [a.hrefLang, a.href]));
		expect(alternates).toEqual({
			en: 'https://example.com/en/resort/levi',
			fi: 'https://example.com/fi/resort/levi',
			sv: 'https://example.com/sv/resort/levi',
			no: 'https://example.com/no/resort/levi',
			'x-default': 'https://example.com/en/resort/levi'
		});
		expect(seo.defaultHref).toBe('https://example.com/en/resort/levi');
		expect(seo.robots).toBe('index,follow');
		expect(seo.type).toBe('website');
		expect(seo.jsonLd).toBeNull();
		expect(seo.jsonLdTag).toBeNull();
	});

	it('preserves a validated query string on canonical and alternate links', () => {
		const seo = buildSeo({
			path: '/compare',
			title: 'Compare resorts',
			description: 'Compare conditions.',
			locale: 'en',
			origin: 'https://example.com',
			search: '?compare=levi,ruka'
		});

		expect(seo.canonical).toBe('https://example.com/en/compare?compare=levi,ruka');
		const fi = seo.alternates.find((a) => a.hrefLang === 'fi');
		expect(fi?.href).toBe('https://example.com/fi/compare?compare=levi,ruka');
	});

	it('escapes ` < ` in JSON-LD data so a data value can never close the script tag', () => {
		const seo = buildSeo({
			path: '/resort/levi',
			title: 'Levi conditions',
			description: 'Current conditions in Levi.',
			locale: 'en',
			origin: 'https://example.com',
			jsonLd: [{ '@type': 'TouristAttraction', name: 'Levi </script><script>alert(1)</script>' }]
		});

		expect(seo.jsonLd).not.toContain('</script>');
		expect(seo.jsonLd).toContain('\\u003c/script>');
		expect(seo.jsonLdTag).toContain('application/ld+json');
	});

	it('emits a noindex robots directive for transient failure pages', () => {
		const seo = buildSeo({
			path: '/resort/levi',
			title: 'Unavailable',
			description: 'Data temporarily unavailable.',
			locale: 'en',
			origin: 'https://example.com',
			robots: 'noindex,follow'
		});

		expect(seo.robots).toBe('noindex,follow');
	});
});
