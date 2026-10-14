import { describe, expect, it } from 'vitest';
import { pilotResorts } from '../../src/lib/server/resorts/pilot.js';
import { createPilotProductReader } from '../../src/lib/server/resorts/product-repository.js';
import { createPilotStatusWriter } from '../../src/lib/server/resorts/status-writer.js';

const publishEnabled = process.env.PUBLISH_PILOT_STATUS === '1';

describe.skipIf(!publishEnabled)('live pilot status publisher', () => {
	it('writes only manual count snapshots, then reads the product RPC back', async () => {
		const supabaseUrl = process.env.SUPABASE_URL;
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
		if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
			throw new Error('pilot_persistence_environment_missing');
		}
		const requests: Array<{ url: string; method: string }> = [];
		const fetchImpl: typeof fetch = async (input, init = {}) => {
			const url = String(input);
			const method = init.method ?? 'GET';
			requests.push({ url, method });
			if (!url.startsWith(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`)) {
				throw new Error('status_publisher_must_not_fetch_resort_pages');
			}
			return fetch(url, init);
		};

		await createPilotStatusWriter({ supabaseUrl, serviceRoleKey, fetchImpl }).publishSnapshots(
			pilotResorts
		);
		const product = await createPilotProductReader({
			supabaseUrl,
			publishableKey,
			fetchImpl
		}).getProduct();

		expect(requests).toHaveLength(11);
		expect(requests.slice(0, 10).every((request) => request.method === 'PATCH')).toBe(true);
		expect(requests[10]?.url).toContain('/rpc/get_pilot_product');
		expect(product.resorts).toHaveLength(10);
		for (const resort of pilotResorts) {
			const published = product.resorts.find((item) => item.slug === resort.slug);
			expect(published?.status.lifts).toEqual(resort.status.lifts);
			expect(published?.status.pistes).toEqual(resort.status.pistes);
		}
	});
});
