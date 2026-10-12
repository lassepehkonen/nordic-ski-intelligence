import {
	createPilotProductReader,
	type PilotProductReaderOptions,
	type PilotProductSnapshot
} from './product-repository.js';

export type PilotProductResponse =
	| {
			status: 200;
			body: PilotProductSnapshot;
			headers: Record<string, string>;
	  }
	| {
			status: 503;
			body: { error: 'product_unavailable' };
			headers: Record<string, string>;
	  };

export async function loadPilotProduct(
	options: PilotProductReaderOptions
): Promise<PilotProductResponse> {
	if (!options.supabaseUrl || !options.publishableKey) {
		return {
			status: 503,
			body: { error: 'product_unavailable' },
			headers: { 'cache-control': 'no-store' }
		};
	}

	try {
		const body = await createPilotProductReader(options).getProduct();
		return {
			status: 200,
			body,
			headers: {
				'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
			}
		};
	} catch {
		return {
			status: 503,
			body: { error: 'product_unavailable' },
			headers: { 'cache-control': 'no-store' }
		};
	}
}
