import { json } from '@sveltejs/kit';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$app/env/private';
import { loadPilotProduct } from '#lib/server/resorts/product-handler.js';

export const GET = async () => {
	const result = await loadPilotProduct({
		supabaseUrl: SUPABASE_URL ?? '',
		publishableKey: SUPABASE_PUBLISHABLE_KEY ?? ''
	});

	return json(result.body, { status: result.status, headers: result.headers });
};
