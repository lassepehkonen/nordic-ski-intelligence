import { randomUUID } from 'node:crypto';
import type {
	Clock,
	Collector,
	ConfidenceScorer,
	ConflictDetector,
	Logger,
	NormalizedFactCandidate,
	Parser,
	PersistOutcome,
	Persister,
	PipelineSummary,
	RawResponse,
	SourceConfig,
	StageEvent,
	StageName,
	StageOutcome,
	ValidatedFact,
	Validator
} from './types.js';
import { factIdentity } from './persister.js';

export interface Approval {
	readonly approvalId: string;
	readonly status: 'approved' | 'pending' | 'rejected' | 'suspended';
	readonly collectionAllowed: boolean;
	readonly normalizedStorageAllowed: boolean;
	readonly rawStorageAllowed: boolean;
	readonly expiresAt: string;
	readonly normalizedRetentionMs: number;
	readonly rawRetentionMs?: number;
	readonly permittedFields: ReadonlyArray<string>;
	readonly sourceReferenceIdsByField: Readonly<Record<string, string>>;
}

export interface PipelineRunnerDeps<TRaw, TParsed> {
	readonly source: SourceConfig;
	readonly approval: Approval;
	/** Fields the server-side adapter intends to collect, declared before network access. */
	readonly fieldKeys: ReadonlyArray<string>;
	readonly collector: Collector;
	readonly parser: Parser<TRaw, TParsed>;
	readonly normalizer: {
		name: string;
		normalize: (parsed: TParsed) => ReadonlyArray<NormalizedFactCandidate>;
	};
	readonly validator: Validator;
	readonly scorer: ConfidenceScorer;
	readonly conflictDetector: ConflictDetector;
	readonly persister: Persister;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly existingValues?: ReadonlyMap<string, unknown>;
}

export interface PipelineSummaryResult extends PipelineSummary {
	readonly status: 'ok' | 'error';
}

function durationSince(start: number): number {
	return Math.max(0, Math.round(performance.now() - start));
}

function makeEvent(
	stage: StageName,
	outcome: StageOutcome,
	started: number,
	notes: ReadonlyArray<string> = []
): StageEvent {
	return { stage, outcome, durationMs: durationSince(started), notes };
}

function summarize(
	runId: string,
	sourceId: SourceConfig['sourceId'],
	startedAt: Date,
	clock: Clock,
	outcome: StageOutcome,
	status: 'ok' | 'error',
	events: ReadonlyArray<StageEvent>,
	counts: Partial<PipelineSummary> = {}
): PipelineSummaryResult {
	const endedAt = clock.now();
	return {
		runId,
		sourceId,
		startedAt: startedAt.toISOString(),
		endedAt: endedAt.toISOString(),
		outcome,
		latencyMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
		stages: [...events],
		providerRequests: counts.providerRequests ?? 0,
		parseFailures: counts.parseFailures ?? 0,
		validationFailures: counts.validationFailures ?? 0,
		collectionFailures: counts.collectionFailures ?? 0,
		staleSkipped: counts.staleSkipped ?? 0,
		conflictsDetected: counts.conflictsDetected ?? 0,
		factsPersisted: counts.factsPersisted ?? 0,
		status
	};
}

function approvalErrors(approval: Approval, fieldKeys: ReadonlyArray<string>, now: Date): string[] {
	const errors: string[] = [];
	if (approval.status !== 'approved') errors.push('source approval is not approved');
	if (!approval.collectionAllowed) errors.push('collection is not permitted');
	if (!approval.normalizedStorageAllowed) errors.push('normalized storage is not permitted');
	const expiresAt = Date.parse(approval.expiresAt);
	if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime())
		errors.push('source approval is expired or has no valid expiry');
	if (!Number.isFinite(approval.normalizedRetentionMs) || approval.normalizedRetentionMs <= 0) {
		errors.push('approved normalized-data retention must be positive');
	}
	if (fieldKeys.length === 0) errors.push('adapter has no declared field allowlist');
	for (const fieldKey of fieldKeys) {
		if (!approval.permittedFields.includes(fieldKey))
			errors.push(`field ${fieldKey} is not approved`);
		if (!approval.sourceReferenceIdsByField[fieldKey])
			errors.push(`field ${fieldKey} has no source reference`);
	}
	if (approval.rawStorageAllowed && (!approval.rawRetentionMs || approval.rawRetentionMs <= 0)) {
		errors.push('raw storage is permitted without a positive retention period');
	}
	return errors;
}

const MAX_FUTURE_OBSERVATION_SKEW_MS = 5 * 60 * 1000;

function isStale(candidate: NormalizedFactCandidate, source: SourceConfig, now: Date): boolean {
	if (!candidate.sourceObservedAt) return false;
	const observedAt = Date.parse(candidate.sourceObservedAt);
	return !Number.isFinite(observedAt) || now.getTime() - observedAt > source.staleAfterMs;
}

function valueRetentionTimes(
	candidate: NormalizedFactCandidate,
	source: SourceConfig,
	approval: Approval,
	fetchedAt: string
): { validUntil: string; retentionExpiresAt: string } {
	const observed = candidate.sourceObservedAt
		? Date.parse(candidate.sourceObservedAt)
		: Date.parse(fetchedAt);
	return {
		validUntil: new Date(observed + source.staleAfterMs).toISOString(),
		retentionExpiresAt: new Date(
			Date.parse(fetchedAt) + approval.normalizedRetentionMs
		).toISOString()
	};
}

function errorCode(error: unknown): string {
	const message =
		error instanceof Error
			? `${error.name} ${error.message}`
			: typeof error === 'string'
				? error
				: '';
	if (!message) return 'unknown_error';
	if (/payload_too_large/i.test(message)) return 'payload_too_large';
	if (/exhausted retries/i.test(message)) return 'provider_retry_exhausted';
	if (/rate limit/i.test(message)) return 'provider_rate_limited';
	const httpStatus = message.match(/\bHTTP\s+(\d{3})\b/i)?.[1];
	if (httpStatus) return `provider_http_${httpStatus}`;
	if (/timeout|abort/i.test(message)) return 'timeout';
	if (/invalid json|must be a json object|exceeds the 1 mib payload limit/i.test(message))
		return 'parser_rejected_payload';
	if (/network|fetch|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message)) return 'network_error';
	return 'stage_error';
}

export function runPipeline<TRaw, TParsed>(deps: PipelineRunnerDeps<TRaw, TParsed>) {
	async function run(): Promise<PipelineSummaryResult> {
		const runId = randomUUID();
		const startedAt = deps.clock.now();
		const events: StageEvent[] = [];
		let providerRequests = 0;

		const recordAndReturn = async (
			outcome: StageOutcome,
			status: 'ok' | 'error',
			counts: Partial<PipelineSummary> = {},
			facts: ReadonlyArray<ValidatedFact> = [],
			conflicts: Parameters<Persister['persist']>[1] = [],
			raw: RawResponse | null = null
		): Promise<PipelineSummaryResult> => {
			const persistStarted = performance.now();
			const placeholder: StageEvent = { stage: 'persist', outcome: 'success', durationMs: 0 };
			const beforePersist = summarize(
				runId,
				deps.source.sourceId,
				startedAt,
				deps.clock,
				outcome,
				status,
				[...events, placeholder],
				{
					...counts,
					providerRequests,
					factsPersisted: facts.length,
					conflictsDetected: conflicts.length
				}
			);
			try {
				await deps.persister.persist(facts, conflicts, beforePersist, raw);
				events.push(makeEvent('persist', 'success', persistStarted));
			} catch (error) {
				const code = errorCode(error);
				events.push(makeEvent('persist', 'skipped', persistStarted, [code]));
				deps.logger.error({
					run_id: runId,
					source_id: deps.source.sourceId,
					stage: 'persist',
					error_code: code
				});
				return summarize(
					runId,
					deps.source.sourceId,
					startedAt,
					deps.clock,
					'persist_failure',
					'error',
					events,
					{
						...counts,
						providerRequests,
						factsPersisted: 0,
						conflictsDetected: conflicts.length
					}
				);
			}
			return summarize(
				runId,
				deps.source.sourceId,
				startedAt,
				deps.clock,
				outcome,
				status,
				events,
				{
					...counts,
					providerRequests,
					factsPersisted: facts.length,
					conflictsDetected: conflicts.length
				}
			);
		};

		// Rights are checked before the collector can make any provider request.
		const approvalStarted = performance.now();
		const rightsErrors = approvalErrors(deps.approval, deps.fieldKeys, startedAt);
		if (rightsErrors.length > 0) {
			events.push(makeEvent('approval', 'rights_blocked', approvalStarted, rightsErrors));
			deps.logger.warn({
				run_id: runId,
				source_id: deps.source.sourceId,
				stage: 'approval',
				outcome: 'rights_blocked',
				error_count: rightsErrors.length
			});
			return recordAndReturn('rights_blocked', 'error');
		}
		events.push(makeEvent('approval', 'success', approvalStarted));

		const collectStarted = performance.now();
		const collected = await deps.collector.collect(deps.source);
		providerRequests = collected.providerRequests ?? collected.data?.attempts ?? 0;
		if (!collected.ok || !collected.data) {
			events.push(makeEvent('collect', 'collection_failure', collectStarted, collected.errors));
			deps.logger.error({
				run_id: runId,
				source_id: deps.source.sourceId,
				stage: 'collect',
				outcome: 'collection_failure',
				provider_requests: providerRequests,
				error_codes: collected.errors.map(errorCode)
			});
			return recordAndReturn('collection_failure', 'error', { collectionFailures: 1 });
		}
		const raw = collected.data;
		events.push(
			makeEvent(
				'collect',
				raw.stale ? 'stale_skipped' : 'success',
				collectStarted,
				collected.warnings
			)
		);

		// A stale cache fallback is useful to diagnose but must never become a new observation.
		if (raw.stale) {
			const refreshFailed =
				collected.errors.length > 0 ||
				collected.warnings.some((warning) => /refresh failed/i.test(warning));
			events.push(
				makeEvent('parse', 'stale_skipped', performance.now(), [
					'stale response was not parsed or persisted'
				])
			);
			deps.logger.warn({
				run_id: runId,
				source_id: deps.source.sourceId,
				stage: 'collect',
				outcome: 'stale_skipped',
				provider_requests: providerRequests
			});
			return recordAndReturn('stale_skipped', 'error', {
				collectionFailures: refreshFailed ? 1 : 0,
				staleSkipped: 1
			});
		}

		const parseStarted = performance.now();
		let parsed: TParsed;
		try {
			const result = deps.parser.parse(raw.body as TRaw);
			if (!result.ok || result.data === undefined) {
				events.push(makeEvent('parse', 'parse_failure', parseStarted, result.errors));
				deps.logger.error({
					run_id: runId,
					source_id: deps.source.sourceId,
					stage: 'parse',
					outcome: 'parse_failure',
					error_codes: result.errors.map(errorCode)
				});
				return recordAndReturn('parse_failure', 'error', { parseFailures: 1 });
			}
			parsed = result.data;
			events.push(makeEvent('parse', 'success', parseStarted, result.warnings));
		} catch (error) {
			const code = errorCode(error);
			events.push(makeEvent('parse', 'parse_failure', parseStarted, [code]));
			deps.logger.error({
				run_id: runId,
				source_id: deps.source.sourceId,
				stage: 'parse',
				outcome: 'parse_failure',
				error_code: code
			});
			return recordAndReturn('parse_failure', 'error', { parseFailures: 1 });
		}

		const normalizeStarted = performance.now();
		let candidates: ReadonlyArray<NormalizedFactCandidate>;
		try {
			candidates = deps.normalizer.normalize(parsed);
		} catch (error) {
			const code = errorCode(error);
			events.push(makeEvent('normalize', 'parse_failure', normalizeStarted, [code]));
			return recordAndReturn('parse_failure', 'error', { parseFailures: 1 });
		}
		if (candidates.length === 0) {
			events.push(
				makeEvent('normalize', 'parse_failure', normalizeStarted, [
					'normalizer produced no candidates'
				])
			);
			return recordAndReturn('parse_failure', 'error', { parseFailures: 1 });
		}
		events.push(makeEvent('normalize', 'success', normalizeStarted));

		const now = deps.clock.now();
		const staleCandidates = candidates.filter((candidate) => isStale(candidate, deps.source, now));
		const freshCandidates = candidates.filter((candidate) => !isStale(candidate, deps.source, now));
		if (freshCandidates.length === 0) {
			events.push(
				makeEvent('validate', 'stale_skipped', performance.now(), [
					'all normalized facts are stale'
				])
			);
			return recordAndReturn('stale_skipped', 'error', { staleSkipped: staleCandidates.length });
		}

		const validateStarted = performance.now();
		const validation = deps.validator(freshCandidates, deps.source);
		const acceptedCandidates = validation.data ?? [];
		const rejectedCount = Math.max(0, freshCandidates.length - acceptedCandidates.length);
		events.push(
			makeEvent(
				'validate',
				validation.ok ? 'success' : 'validation_failure',
				validateStarted,
				validation.errors
			)
		);
		if (acceptedCandidates.length === 0) {
			deps.logger.error({
				run_id: runId,
				source_id: deps.source.sourceId,
				stage: 'validate',
				outcome: 'validation_failure',
				validation_failures: rejectedCount
			});
			return recordAndReturn('validation_failure', 'error', {
				validationFailures: rejectedCount || freshCandidates.length,
				staleSkipped: staleCandidates.length
			});
		}

		const confidenceStarted = performance.now();
		const validatedFacts: ValidatedFact[] = [];
		const validationErrors: string[] = [...validation.errors];
		for (const candidate of acceptedCandidates) {
			const fieldKey = candidate.fieldKey ?? candidate.key;
			if (
				!deps.approval.permittedFields.includes(fieldKey) ||
				!deps.approval.sourceReferenceIdsByField[fieldKey]
			) {
				validationErrors.push(`unapproved field ${fieldKey}`);
				continue;
			}
			if (!candidate.sourceObservedAt || !Number.isFinite(Date.parse(candidate.sourceObservedAt))) {
				validationErrors.push(`missing or invalid source observation time for ${fieldKey}`);
				continue;
			}
			if (Date.parse(candidate.sourceObservedAt) > now.getTime() + MAX_FUTURE_OBSERVATION_SKEW_MS) {
				validationErrors.push(`future source observation time for ${fieldKey}`);
				continue;
			}
			const { confidence, reasons } = deps.scorer.score(candidate, deps.source, () => now);
			const retention = valueRetentionTimes(candidate, deps.source, deps.approval, raw.fetchedAt);
			validatedFacts.push({
				candidate: { ...candidate, fieldKey },
				validation: 'validated',
				confidence,
				sourceId: deps.source.sourceId,
				approvalId: deps.approval.approvalId,
				sourceReferenceId: deps.approval.sourceReferenceIdsByField[fieldKey],
				fetchedAt: raw.fetchedAt,
				validUntil: retention.validUntil,
				retentionExpiresAt: retention.retentionExpiresAt,
				reasons
			});
		}
		events.push(makeEvent('confidence', 'success', confidenceStarted));
		const allValidationFailures = rejectedCount + validationErrors.length;
		if (validatedFacts.length === 0) {
			return recordAndReturn('validation_failure', 'error', {
				validationFailures: Math.max(1, allValidationFailures),
				staleSkipped: staleCandidates.length
			});
		}

		const conflictStarted = performance.now();
		let conflicts: ReturnType<ConflictDetector['detect']>;
		let factsToPersist: ReadonlyArray<ValidatedFact>;
		try {
			const existing =
				deps.existingValues ??
				(await deps.persister.getCurrentValues(validatedFacts.map((fact) => fact.candidate)));
			conflicts = deps.conflictDetector.detect(validatedFacts, existing);
			const conflictKeys = new Set(conflicts.map((conflict) => factIdentity(conflict.candidate)));
			factsToPersist = validatedFacts.filter(
				(fact) => !conflictKeys.has(factIdentity(fact.candidate))
			);
		} catch (error) {
			const code = errorCode(error);
			events.push(makeEvent('conflict', 'conflict_check_failure', conflictStarted, [code]));
			deps.logger.error({
				run_id: runId,
				source_id: deps.source.sourceId,
				stage: 'conflict',
				outcome: 'conflict_check_failure',
				error_code: code
			});
			return recordAndReturn('conflict_check_failure', 'error', {
				providerRequests,
				validationFailures: allValidationFailures,
				staleSkipped: staleCandidates.length
			});
		}
		events.push(
			makeEvent(
				'conflict',
				conflicts.length > 0 ? 'conflict_detected' : 'success',
				conflictStarted,
				conflicts.length > 0 ? [`${conflicts.length} conflict(s); existing values retained`] : []
			)
		);

		const finalOutcome: StageOutcome =
			conflicts.length > 0
				? 'conflict_detected'
				: allValidationFailures > 0
					? 'validation_failure'
					: 'success';
		const finalStatus = allValidationFailures > 0 ? 'error' : 'ok';
		const persistStarted = performance.now();
		const placeholder: StageEvent = { stage: 'persist', outcome: 'success', durationMs: 0 };
		const prePersistSummary = summarize(
			runId,
			deps.source.sourceId,
			startedAt,
			deps.clock,
			finalOutcome,
			finalStatus,
			[...events, placeholder],
			{
				providerRequests,
				validationFailures: allValidationFailures,
				staleSkipped: staleCandidates.length,
				conflictsDetected: conflicts.length,
				factsPersisted: factsToPersist.length
			}
		);
		let persisted: PersistOutcome;
		try {
			// Raw retention stays disabled until a persister can enforce purge_after.
			persisted = await deps.persister.persist(factsToPersist, conflicts, prePersistSummary, null);
		} catch (error) {
			const code = errorCode(error);
			events.push(makeEvent('persist', 'skipped', persistStarted, [code]));
			deps.logger.error({
				run_id: runId,
				source_id: deps.source.sourceId,
				stage: 'persist',
				error_code: code
			});
			return summarize(
				runId,
				deps.source.sourceId,
				startedAt,
				deps.clock,
				'persist_failure',
				'error',
				events,
				{
					providerRequests,
					validationFailures: allValidationFailures,
					staleSkipped: staleCandidates.length,
					conflictsDetected: conflicts.length
				}
			);
		}
		events.push(makeEvent('persist', 'success', persistStarted));
		const summary = summarize(
			runId,
			deps.source.sourceId,
			startedAt,
			deps.clock,
			finalOutcome,
			finalStatus,
			events,
			{
				providerRequests,
				validationFailures: allValidationFailures,
				staleSkipped: staleCandidates.length,
				conflictsDetected: persisted.conflicts.length,
				factsPersisted: persisted.accepted.length
			}
		);
		deps.logger.info({
			run_id: summary.runId,
			source_id: summary.sourceId,
			stage: 'persist',
			outcome: summary.outcome,
			latency_ms: summary.latencyMs,
			provider_requests: summary.providerRequests,
			parse_failures: summary.parseFailures,
			validation_failures: summary.validationFailures,
			stale_skipped: summary.staleSkipped,
			conflicts_detected: summary.conflictsDetected,
			facts_persisted: summary.factsPersisted
		});
		return summary;
	}

	return { run };
}
