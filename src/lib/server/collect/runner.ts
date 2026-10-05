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

export interface Approval {
	readonly approvalId: string;
	readonly sourceReferenceId: string;
}

export interface PipelineRunnerDeps<TRaw, TParsed> {
	readonly source: SourceConfig;
	readonly approval: Approval;
	readonly collector: Collector;
	readonly parser: Parser<TRaw, TParsed>;
	readonly normalizer: { name: string; normalize: (parsed: TParsed) => ReadonlyArray<NormalizedFactCandidate> };
	readonly validator: Validator;
	readonly scorer: ConfidenceScorer;
	readonly conflictDetector: ConflictDetector;
	readonly persister: Persister;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly existingValues?: ReadonlyMap<string, unknown>;
	readonly retentionMs?: number;
	readonly validityMs?: number;
}

let runCounter = 0;

function newRunId(): string {
	runCounter += 1;
	return `run-${Date.now()}-${runCounter}`;
}

function makeStageEvent(stage: StageName, outcome: StageOutcome, startedAt: number, notes: ReadonlyArray<string> = []): StageEvent {
	return { stage, outcome, durationMs: Date.now() - startedAt, notes };
}

function computeRetentionTimes(
	clock: Clock,
	validityMs: number,
	retentionMs: number
): { fetchedAt: string; validUntil: string; retentionExpiresAt: string } {
	const now = clock.now();
	return {
		fetchedAt: now.toISOString(),
		validUntil: new Date(now.getTime() + validityMs).toISOString(),
		retentionExpiresAt: new Date(now.getTime() + retentionMs).toISOString()
	};
}

function makeRunSkeleton(sourceId: SourceConfig['sourceId'], clock: Clock, events: ReadonlyArray<StageEvent>): PipelineSummary {
	const now = clock.now();
	return {
		runId: newRunId(),
		sourceId,
		startedAt: now.toISOString(),
		endedAt: now.toISOString(),
		outcome: 'success',
		latencyMs: 0,
		stages: events.slice(),
		providerRequests: 0,
		parseFailures: 0,
		validationFailures: 0,
		collectionFailures: 0,
		staleSkipped: 0,
		conflictsDetected: 0,
		factsPersisted: 0
	};
}

export interface PipelineSummaryResult extends PipelineSummary {
	readonly status: 'ok' | 'error';
}

interface BuildSummaryInput {
	readonly runId: string;
	readonly sourceId: SourceConfig['sourceId'];
	readonly startedAt: Date;
	readonly endedAt: Date;
	readonly status: 'ok' | 'error';
	readonly outcome: StageOutcome;
	readonly events: ReadonlyArray<StageEvent>;
	readonly counts: Partial<PipelineSummary>;
	readonly factsPersisted: number;
	readonly conflictsDetected: number;
}

function buildSummary(input: BuildSummaryInput): PipelineSummaryResult {
	const latencyMs = input.endedAt.getTime() - input.startedAt.getTime();
	return {
		runId: input.runId,
		sourceId: input.sourceId,
		startedAt: input.startedAt.toISOString(),
		endedAt: input.endedAt.toISOString(),
		outcome: input.outcome,
		latencyMs,
		stages: input.events.slice(),
		providerRequests: input.counts.providerRequests ?? 0,
		parseFailures: input.counts.parseFailures ?? 0,
		validationFailures: input.counts.validationFailures ?? 0,
		collectionFailures: input.counts.collectionFailures ?? 0,
		staleSkipped: input.counts.staleSkipped ?? 0,
		conflictsDetected: input.conflictsDetected,
		factsPersisted: input.factsPersisted,
		status: input.status
	};
}

export function runPipeline<TRaw, TParsed>(deps: PipelineRunnerDeps<TRaw, TParsed>) {
	const events: StageEvent[] = [];
	const startedAt = deps.clock.now();

	async function run(): Promise<PipelineSummaryResult> {
		const runId = newRunId();

		// Stage: collect
		const collectStart = Date.now();
		const collected = await deps.collector.collect(deps.source);
		events.push(
			makeStageEvent(
				'collect',
				collected.ok ? 'success' : 'collection_failure',
				collectStart,
				collected.errors
			)
		);
		if (!collected.ok || !collected.data) {
			const summary = buildSummary({
				runId,
				sourceId: deps.source.sourceId,
				startedAt,
				endedAt: deps.clock.now(),
				status: 'error',
				outcome: 'collection_failure',
				events,
				counts: { collectionFailures: 1, providerRequests: 0 },
				factsPersisted: 0,
				conflictsDetected: 0
			});
			deps.logger.error({
				run_id: summary.runId,
				source_id: summary.sourceId,
				stage: 'collect',
				outcome: 'collection_failure',
				duration_ms: 0,
				errors: collected.errors
			});
			return summary;
		}

		const raw = collected.data;
		const staleSkipped = raw.stale ? 1 : 0;

		// Stage: parse
		const parseStart = Date.now();
		let parsed: TParsed;
		let parseOk = true;
		const parseErrors: string[] = [];
		let parseFatal = false;
		try {
			const result = deps.parser.parse(raw.body as TRaw);
			parseOk = result.ok;
			parseFatal = result.fatal;
			parseErrors.push(...result.errors);
			if (!result.ok || !result.data) {
				parseOk = false;
			} else {
				parsed = result.data;
			}
		} catch (err) {
			parseOk = false;
			parseFatal = true;
			parseErrors.push(err instanceof Error ? err.message : String(err));
		}
		events.push(
			makeStageEvent('parse', parseOk ? 'success' : 'parse_failure', parseStart, parseErrors)
		);
		if (!parseOk) {
			const summary = buildSummary({
				runId,
				sourceId: deps.source.sourceId,
				startedAt,
				endedAt: deps.clock.now(),
				status: 'error',
				outcome: 'parse_failure',
				events,
				counts: { parseFailures: 1, providerRequests: 1, staleSkipped },
				factsPersisted: 0,
				conflictsDetected: 0
			});
			deps.logger.error({
				run_id: summary.runId,
				source_id: summary.sourceId,
				stage: 'parse',
				outcome: 'parse_failure',
				duration_ms: 0,
				fatal: parseFatal,
				errors: parseErrors
			});
			return summary;
		}

		// Stage: normalize
		const normalizeStart = Date.now();
		const candidates = deps.normalizer.normalize(parsed!);
		events.push(
			makeStageEvent(
				'normalize',
				candidates.length > 0 ? 'success' : 'parse_failure',
				normalizeStart,
				candidates.length === 0 ? ['no candidates from normalizer'] : []
			)
		);
		if (candidates.length === 0) {
			const summary = buildSummary({
				runId,
				sourceId: deps.source.sourceId,
				startedAt,
				endedAt: deps.clock.now(),
				status: 'error',
				outcome: 'parse_failure',
				events,
				counts: { parseFailures: 1, providerRequests: 1, staleSkipped },
				factsPersisted: 0,
				conflictsDetected: 0
			});
			deps.logger.error({
				run_id: summary.runId,
				source_id: summary.sourceId,
				stage: 'normalize',
				outcome: 'parse_failure',
				duration_ms: 0
			});
			return summary;
		}

		// Stage: validate
		const validateStart = Date.now();
		const validation = deps.validator.validate(candidates, deps.source);
		const validatedCandidates = validation.ok ? (validation.data ?? []) : [];
		events.push(
			makeStageEvent(
				'validate',
				validation.ok ? 'success' : 'validation_failure',
				validateStart,
				validation.errors
			)
		);
		if (!validation.ok || validatedCandidates.length === 0) {
			const summary = buildSummary({
				runId,
				sourceId: deps.source.sourceId,
				startedAt,
				endedAt: deps.clock.now(),
				status: 'error',
				outcome: 'validation_failure',
				events,
				counts: {
					parseFailures: 0,
					validationFailures: candidates.length,
					providerRequests: 1,
					staleSkipped
				},
				factsPersisted: 0,
				conflictsDetected: 0
			});
			deps.logger.error({
				run_id: summary.runId,
				source_id: summary.sourceId,
				stage: 'validate',
				outcome: 'validation_failure',
				duration_ms: 0,
				errors: validation.errors
			});
			return summary;
		}

		// Stage: confidence + assemble validated facts
		const confidenceStart = Date.now();
		const validityMs = deps.validityMs ?? 6 * 60 * 60 * 1000;
		const retentionMs = deps.retentionMs ?? 7 * 24 * 60 * 60 * 1000;
		const times = computeRetentionTimes(deps.clock, validityMs, retentionMs);
		const validatedFacts: ValidatedFact[] = validatedCandidates.map((candidate) => {
			const { confidence, reasons } = deps.scorer.score(candidate, deps.source);
			return {
				candidate,
				validation: 'validated',
				confidence,
				sourceId: deps.source.sourceId,
				approvalId: deps.approval.approvalId,
				sourceReferenceId: deps.approval.sourceReferenceId,
				fetchedAt: times.fetchedAt,
				validUntil: times.validUntil,
				retentionExpiresAt: times.retentionExpiresAt,
				reasons
			};
		});
		events.push(makeStageEvent('confidence', 'success', confidenceStart));

		// Stage: conflict detection
		const conflictStart = Date.now();
		const existing = deps.existingValues ?? new Map<string, unknown>();
		const conflicts = deps.conflictDetector.detect(validatedFacts, existing);
		events.push(
			makeStageEvent(
				'conflict',
				conflicts.length > 0 ? 'conflict_detected' : 'success',
				conflictStart,
				conflicts.length > 0 ? [`detected ${conflicts.length} conflict(s)`] : []
			)
		);

		// Stage: persist
		const persistStart = Date.now();
		const outcome = await deps.persister.persist(
			validatedFacts,
			conflicts,
			makeRunSkeleton(deps.source.sourceId, deps.clock, events),
			raw
		);
		events.push(makeStageEvent('persist', 'success', persistStart));

		const summary = buildSummary({
			runId,
			sourceId: deps.source.sourceId,
			startedAt,
			endedAt: deps.clock.now(),
			status: 'ok',
			outcome: conflicts.length > 0 ? 'conflict_detected' : 'success',
			events,
			counts: { providerRequests: 1, staleSkipped },
			factsPersisted: outcome.accepted.length,
			conflictsDetected: outcome.conflicts.length
		});
		deps.logger.info({
			run_id: summary.runId,
			source_id: summary.sourceId,
			stage: 'persist',
			outcome: summary.outcome,
			duration_ms: summary.latencyMs,
			facts_persisted: summary.factsPersisted,
			conflicts_detected: summary.conflictsDetected
		});
		return summary;
	}

	return { run, events: () => events.slice() };
}

export const __pipelineInternals = { computeRetentionTimes, newRunId, buildSummary };