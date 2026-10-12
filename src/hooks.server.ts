import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

export const handle: Handle = ({ event, resolve }) => {
	if (event.url.pathname === '/') redirect(308, '/en');
	if (event.url.pathname.startsWith('/api/')) return resolve(event);

	return paraglideMiddleware(event.request, ({ locale }) => {
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale))
		});
	});
};
