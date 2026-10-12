export default {
	outdir: './src/lib/paraglide',
	emitTsDeclarations: true,
	strategy: ['url', 'baseLocale'],
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
	routeStrategies: [{ match: '/api/:path(.*)?', exclude: true }],
	trailingSlash: 'never'
};
