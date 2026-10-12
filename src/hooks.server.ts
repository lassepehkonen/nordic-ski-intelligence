import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { getTextDirection, localizeUrl } from '#lib/paraglide/runtime.js';

/**
 * Paraglide middleware (ADR-0007).
 *
 * SvelteKit owns URL localization through the `reroute` hook in `src/hooks.ts`, so the original
 * event is passed to `resolve` (passing the middleware-localized request instead would double
 * de-localize and risk a redirect loop). The middleware still resolves the request locale, keeps
 * document requests canonical and provides the AsyncLocalStorage locale context used by `m.*`
 * during SSR. `%lang%`/`%dir%` in `src/app.html` are replaced with the resolved locale.
 */
const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ locale }) => {
		// The unprefixed root is a locale-detection entry point, never an indexable page:
		// it always redirects to the resolved locale's canonical URL (`/fi`, `/en`, ...).
		if (event.url.pathname === '/') {
			redirect(308, localizeUrl(event.url, { locale }));
		}

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale))
		});
	});

export const handle: Handle = paraglideHandle;
