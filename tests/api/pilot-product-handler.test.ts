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
		expect(response.body).toEqual({
			error: 'product_unavailable',
			reason: 'configuration_missing'
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('distinguishes a rejected credential from a failing read', async () => {
		const rejected = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response('{"message":"Invalid API key"}', { status: 401 }));
		const failing = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response('{"message":"boom"}', { status: 500 }));

		const unauthorized = await loadPilotProduct({
			supabaseUrl: 'https://example.supabase.co',
			publishableKey: 'publishable-test-key',
			fetchImpl: rejected
		});
		const broken = await loadPilotProduct({
			supabaseUrl: 'https://example.supabase.co',
			publishableKey: 'publishable-test-key',
			fetchImpl: failing
		});

		expect(unauthorized.body).toEqual({
			error: 'product_unavailable',
			reason: 'upstream_configuration_rejected',
			upstreamStatus: 401
		});
		expect(broken.body).toEqual({
			error: 'product_unavailable',
			reason: 'upstream_query_failed',
			upstreamStatus: 500
		});
	});

	it('reports an unusable payload separately from a failed request', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));

		const response = await loadPilotProduct({
			supabaseUrl: 'https://example.supabase.co',
			publishableKey: 'publishable-test-key',
			fetchImpl
		});

		expect(response.status).toBe(503);
		expect(response.body).toEqual({
			error: 'product_unavailable',
			reason: 'upstream_invalid_payload'
		});
	});
});
