import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runCollectPipeline } from '$lib/server/collect/trigger.js';
import type { SourceConfig, SourceId } from '$lib/server/collect/types.js';
import type { PipelineKind } from '$lib/server/collect/trigger.js';

/**
 * Server-only collection trigger. The route exists to keep collection behind
 * a server route so that frontend clients cannot multiply provider costs.
 *
 * Only Levi is supported in this phase; the route accepts a JSON body with
 * `kind`, an optional `source` block, and returns a {@link PipelineSummary}
 * object. The default synthetic source is used when no source is provided.
 */
const ALLOWED_KINDS: ReadonlyArray<PipelineKind> = ['snow', 'lifts', 'slopes'];

const DEFAULT_SOURCE: SourceConfig = {
	sourceId: 'levi-synthetic' as SourceId,
	sourceKind: 'synthetic',
	endpoint: 'https://example.invalid/levi/snow',
	requestTimeoutMs: 1000,
	retry: { maxAttempts: 2, baseMs: 5, capMs: 20, jitterRatio: 0 },
	rateLimit: { requestsPerWindow: 2, windowMs: 1000 },
	cacheTtlMs: 5000,
	staleAfterMs: 60_000,
	permitRawStorage: false
};

const DEFAULT_APPROVAL = {
	approvalId: '00000000-0000-0000-0000-000000000010',
	sourceReferenceId: '00000000-0000-0000-0000-000000000020'
};

interface CollectRequestBody {
	readonly kind?: string;
	readonly source?: Partial<SourceConfig>;
	readonly approvalId?: string;
	readonly sourceReferenceId?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	let body: CollectRequestBody;
	try {
		body = (await request.json()) as CollectRequestBody;
	} catch {
		throw error(400, 'request body must be valid JSON');
	}

	const kind = body.kind;
	if (!kind || !ALLOWED_KINDS.includes(kind as PipelineKind)) {
		throw error(400, `kind must be one of ${ALLOWED_KINDS.join(', ')}`);
	}

	const source: SourceConfig = {
		...DEFAULT_SOURCE,
		...body.source,
		sourceId: ((body.source?.sourceId as SourceId | undefined) ?? DEFAULT_SOURCE.sourceId) as SourceId
	};

	const approval = {
		approvalId: body.approvalId ?? DEFAULT_APPROVAL.approvalId,
		sourceReferenceId: body.sourceReferenceId ?? DEFAULT_APPROVAL.sourceReferenceId
	};

	const summary = await runCollectPipeline({ source, approval }, { kind: kind as PipelineKind });
	return json(summary);
};

export const GET: RequestHandler = () => {
	return json({
		status: 'ok',
		allowed_kinds: ALLOWED_KINDS,
		note: 'collection is server-only; POST a request to start a run'
	});
};