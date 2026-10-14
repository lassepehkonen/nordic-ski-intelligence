import { defineEnvVars } from '@sveltejs/kit/env';

function optionalString(value: string | undefined): string | undefined {
	return value?.trim() || undefined;
}

function optionalSupabaseUrl(value: string | undefined): string | undefined {
	const normalized = optionalString(value);
	if (!normalized) return undefined;

	try {
		const url = new URL(normalized);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
	} catch {
		throw new Error('SUPABASE_URL must be an absolute URL');
	}

	return normalized.replace(/\/+$/, '');
}

export const variables = defineEnvVars({
	SUPABASE_URL: {
		public: false,
		static: false,
		schema: optionalSupabaseUrl,
		description: 'Supabase project URL. Used by server-side product and collection code.'
	},
	SUPABASE_PUBLISHABLE_KEY: {
		public: false,
		static: false,
		schema: optionalString,
		description: 'Publishable key used server-side to read the public product RPC.'
	},
	SUPABASE_SERVICE_ROLE_KEY: {
		public: false,
		static: false,
		schema: optionalString,
		description: 'Server-only key used to write pilot snapshots and collection runs.'
	}
});
