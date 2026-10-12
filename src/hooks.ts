import type { Reroute } from '@sveltejs/kit/hooks';
import { deLocalizeUrl } from '#lib/paraglide/runtime.js';

/**
 * Locale-prefixed URLs (`/fi/resort/levi`) are rewritten to the canonical application route
 * (`/resort/levi`), so page components never contain locale segments (ADR-0007).
 */
export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname;
