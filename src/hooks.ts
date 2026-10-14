import { deLocalizeUrl } from '#lib/paraglide/runtime.js';

export const reroute = (request: { url: URL; fetch: typeof fetch }): string =>
	deLocalizeUrl(request.url).pathname;
