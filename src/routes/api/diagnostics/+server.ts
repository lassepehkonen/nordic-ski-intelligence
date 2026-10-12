import { json } from '@sveltejs/kit';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';

/**
 * TEMPORARY diagnostics endpoint (removed before this phase is finalised): reports which
 * deployment environment variables the running serverless function can actually see. Only
 * booleans, hosts and lengths are returned — never a value.
 */
export function GET() {
	const names = Object.keys(process.env)
		.filter((key) => key.startsWith('SUPABASE') || key === 'CONTEXT' || key === 'BRANCH')
		.sort();

	return json({
		resolved: {
			hasUrl: Boolean(SUPABASE_URL),
			urlHost: SUPABASE_URL ? safeHost(SUPABASE_URL) : null,
			hasKey: Boolean(SUPABASE_PUBLISHABLE_KEY),
			keyLength: SUPABASE_PUBLISHABLE_KEY?.length ?? 0
		},
		raw: names.map((key) => `${key}=${(process.env[key] ?? '').length}chars`),
		node: process.version
	});
}

function safeHost(value: string): string | null {
	try {
		return new URL(value).host;
	} catch {
		return null;
	}
}
