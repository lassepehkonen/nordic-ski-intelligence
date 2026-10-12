/**
 * Paraglide compiler configuration (ADR-0007).
 *
 * This file lives inside the inlang project directory and is picked up by both the Vite plugin
 * and the `paraglide-js compile` CLI, so there is one source of truth for locale routing and
 * message compilation. `outdir` is relative to the working directory of the integration (the
 * repository root for both).
 *
 * URL strategy: every locale is prefixed (`/fi/`, `/en/`, `/sv/`, `/no/`) so that each localized
 * page has its own indexable URL (ADR-0007, canonical + hreflang). Unprefixed routes (`/api/*`,
 * `/robots.txt`, `/sitemap.xml`) are excluded from the i18n middleware so they never receive a
 * locale redirect.
 */

/** @type {import('@inlang/paraglide-js').ParaglideConfig} */
const config = {
	outdir: './src/lib/paraglide',
	strategy: ['url', 'preferredLanguage', 'baseLocale'],
	trailingSlash: 'never',
	emitTsDeclarations: true,
	urlPatterns: [
		{
			// Exact root rule: generates `/fi`, `/en`, `/sv`, `/no` (no trailing slash). It must be
			// listed before the wildcard pattern, which is matched first-wins.
			pattern: '/',
			localized: [
				['fi', '/fi'],
				['en', '/en'],
				['sv', '/sv'],
				['no', '/no']
			]
		},
		{
			pattern: '/:path(.*)?',
			localized: [
				['fi', '/fi/:path(.*)?'],
				['en', '/en/:path(.*)?'],
				['sv', '/sv/:path(.*)?'],
				['no', '/no/:path(.*)?']
			]
		}
	],
	routeStrategies: [
		{ match: '/api/:path(.*)?', exclude: true },
		{ match: '/robots.txt', exclude: true },
		{ match: '/sitemap.xml', exclude: true }
	]
};

export default config;
