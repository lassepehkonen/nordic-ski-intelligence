import {
	createPilotProductReader,
	type PilotProductReaderOptions,
	type PilotProductSnapshot
} from './product-repository.js';

export type PilotProductFailureReason =
	| 'configuration_missing'
	| 'upstream_configuration_rejected'
	| 'upstream_query_failed'
	| 'upstream_invalid_payload';

export type PilotProductFailure = {
	error: 'product_unavailable';
	/**
	 * Bounded, non-sensitive diagnostic. When the product is unavailable in production this is
	 * the difference between "the deployment has no credentials" and "the upstream rejected or
	 * broke the read", and it is safe to expose.
	 */
	reason: PilotProductFailureReason;
	/** Upstream HTTP status when the failure came back from Supabase. */
	upstreamStatus?: number;
};

export type PilotProductResponse =
	| {
			status: 200;
			body: PilotProductSnapshot;
			headers: Record<string, string>;
	  }
	| {
			status: 503;
			body: PilotProductFailure;
			headers: Record<string, string>;
	  };

function failure(reason: PilotProductFailureReason, upstreamStatus?: number): PilotProductFailure {
	return upstreamStatus === undefined
		? { error: 'product_unavailable', reason }
		: { error: 'product_unavailable', reason, upstreamStatus };
}

export async function loadPilotProduct(
	options: PilotProductReaderOptions
): Promise<PilotProductResponse> {
	if (!options.supabaseUrl || !options.publishableKey) {
		return {
			status: 503,
			body: failure('configuration_missing'),
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
	} catch (error) {
		const code = error instanceof Error ? error.message : '';
		const status = readUpstreamStatus(error);
		const reason: PilotProductFailureReason =
			code === 'pilot_product_configuration_missing'
				? 'configuration_missing'
				: code === 'pilot_product_invalid_payload'
					? 'upstream_invalid_payload'
					: status === 401 || status === 403
						? 'upstream_configuration_rejected'
						: 'upstream_query_failed';

		return {
			status: 503,
			body: failure(reason, status),
			headers: { 'cache-control': 'no-store' }
		};
	}
}

function readUpstreamStatus(error: unknown): number | undefined {
	if (error && typeof error === 'object' && 'status' in error) {
		const status = (error as { status?: unknown }).status;
		if (typeof status === 'number' && Number.isFinite(status)) return status;
	}
	return undefined;
}
