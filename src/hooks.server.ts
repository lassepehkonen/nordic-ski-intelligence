import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getTextDirection, localizeHref } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

/**
 * Routes that never carry a locale prefix and must stay untouched by the i18n middleware:
 * the JSON product API, the generated sitemap and robots.txt. The same paths are excluded
 * from the URL strategy in project.inlang/paraglide.config.js.
 */
const nonLocalizedPaths = ['/api/', '/sitemap.xml', '/robots.txt'];

export const handle: Handle = ({ event, resolve }) => {
	const { pathname } = event.url;
	if (nonLocalizedPaths.some((path) => pathname === path || pathname.startsWith(path))) {
		return resolve(event);
	}

	return paraglideMiddleware(event.request, ({ locale }) => {
		// Every locale owns a prefixed home route, so `/` is not a canonical URL. The target
		// follows the resolved locale (Accept-Language via the preferredLanguage strategy),
		// which keeps one shareable, indexable URL per language.
		if (pathname === '/') redirect(308, localizeHref('/', { locale }));

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale))
		});
	});
};
