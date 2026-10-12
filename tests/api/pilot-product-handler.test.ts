import { describe, expect, it, vi } from 'vitest';
import { loadPilotProduct } from '../../src/lib/server/resorts/product-handler.js';

const payload = { resorts: [], lastCollectionRun: null };

describe('pilot product handler', () => {
	it('returns the database product and a short cache policy', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

		const response = await loadPilotProduct({
			supabaseUrl: 'https://example.supabase.co',
			publishableKey: 'publishable-test-key',
			fetchImpl
		});

		expect(response.status).toBe(200);
		expect(response.body).toEqual(payload);
		expect(response.headers['cache-control']).toContain('s-maxage=300');
	});

	it('returns a configuration error without calling Supabase when keys are missing', async () => {
		const fetchImpl = vi.fn<typeof fetch>();

		const response = await loadPilotProduct({ supabaseUrl: '', publishableKey: '', fetchImpl });

		expect(response.status).toBe(503);
		expect(response.body).toEqual({ error: 'product_unavailable' });
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});
