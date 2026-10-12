import { siteOrigin } from '#lib/seo/meta.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const origin = siteOrigin(url.origin);
	const body = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /api/',
		'',
		`Sitemap: ${origin}/sitemap.xml`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
