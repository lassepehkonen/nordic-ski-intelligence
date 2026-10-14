export default {
	outdir: './src/lib/paraglide',
	emitTsDeclarations: true,
	strategy: ['url', 'preferredLanguage', 'baseLocale'],
	urlPatterns: [
		{
			pattern: '/',
			localized: [
				['en', '/en'],
				['fi', '/fi'],
				['sv', '/sv'],
				['no', '/no']
			]
		},
		{
			pattern: '/:path(.*)?',
			localized: [
				['en', '/en/:path(.*)?'],
				['fi', '/fi/:path(.*)?'],
				['sv', '/sv/:path(.*)?'],
				['no', '/no/:path(.*)?']
			]
		}
	],
	routeStrategies: [
		{ match: '/api/:path(.*)?', exclude: true },
		{ match: '/sitemap.xml', exclude: true },
		{ match: '/robots.txt', exclude: true }
	],
	trailingSlash: 'never'
};
