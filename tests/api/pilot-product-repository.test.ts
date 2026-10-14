import { describe, expect, it, vi } from 'vitest';
import { createPilotProductReader } from '../../src/lib/server/resorts/product-repository.js';

const responsePayload = {
	resorts: [
		{
			slug: 'levi',
			name: 'Levi',
			countryCode: 'FI',
			region: 'Kittilä',
			size: 'large',
			location: {
				latitude: 67.8038,
				longitude: 24.8088,
				sourceUrl: 'https://example.test/map',
				attribution: 'LIPAS'
			},
			inventory: {
				lifts: 28,
				pistes: 44,
				sourceUrl: 'https://example.test/counts',
				attribution: 'Resort, counts only'
			},
			status: {
				lifts: { open: 3, total: 28 },
				pistes: { open: 3, total: 44 },
				freshness: 'fresh',
				checkedAt: '2026-10-12T11:29:27Z',
				sourceUrl: 'https://example.test/counts',
				attribution: 'Resort, counts only'
			},
			weather: {
				provider: 'fmi',
				sourceUrl: 'https://example.test/weather-api',
				attribution: 'FMI',
				freshness: 'fresh',
				fetchedAt: '2026-10-12T12:00:00Z',
				sourceUpdatedAt: null,
				current: { validAt: '2026-10-12T12:00:00Z', airTemperatureC: -2.5 },
				forecast: [],
				snow: { depthCm: null, recentSnowfall24hCm: null, observedAt: null, sourceUrl: null }
			}
		}
	],
	lastCollectionRun: {
		completedAt: '2026-10-12T12:00:00Z',
		outcome: 'success',
		totalProviderRequests: 10,
		providerRequestsByProvider: { fmi: 6, smhi: 2, 'met-no': 2 },
		resortsAttempted: 10,
		resortsSucceeded: 10,
		resortsFailed: 0,
		resortsStale: 0
	}
};

describe('pilot product reader', () => {
	it('reads the database RPC with the publishable key and returns its product payload', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(JSON.stringify(responsePayload), { status: 200 }));
		const reader = createPilotProductReader({
			supabaseUrl: 'https://ugeoxrfagumamxyhqnjw.supabase.co',
			publishableKey: 'publishable-test-key',
			fetchImpl
		});

		const product = await reader.getProduct();
		const [input, init] = fetchImpl.mock.calls[0] ?? [];
		const headers = new Headers(init?.headers);

		expect(product.resorts).toHaveLength(1);
		expect(product.resorts[0]?.status.lifts).toEqual({ open: 3, total: 28 });
		expect(product.lastCollectionRun?.providerRequestsByProvider).toEqual({
			fmi: 6,
			smhi: 2,
			'met-no': 2
		});
		expect(String(input)).toBe(
			'https://ugeoxrfagumamxyhqnjw.supabase.co/rest/v1/rpc/get_pilot_product'
		);
		expect(init?.method).toBe('POST');
		expect(JSON.parse(String(init?.body))).toEqual({});
		expect(headers.get('apikey')).toBe('publishable-test-key');
		expect(headers.get('authorization')).toBe('Bearer publishable-test-key');
	});

	it('does not expose the upstream response body when the database request fails', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response('sensitive upstream detail', { status: 503 }));
		const reader = createPilotProductReader({
			supabaseUrl: 'https://ugeoxrfagumamxyhqnjw.supabase.co',
			publishableKey: 'publishable-test-key',
			fetchImpl
		});

		await expect(reader.getProduct()).rejects.toThrow('pilot_product_query_failed');
	});
});
