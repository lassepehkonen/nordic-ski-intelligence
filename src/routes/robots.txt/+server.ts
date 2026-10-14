import type { RequestEvent } from '@sveltejs/kit';

/**
 * robots.txt is served from a route (not static/) so the sitemap URL always matches the origin
 * that is actually answering - the same build runs on preview and production domains.
 */
export const GET = ({ url }: RequestEvent) => {
	const body = [
		'# allow crawling everything by default',
		'User-agent: *',
		'Disallow: /api/',
		'',
		`Sitemap: ${new URL('/sitemap.xml', url.origin).toString()}`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
