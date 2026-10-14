/**
 * Phase 4 — Reusable Nordic Ski data collection pipeline contracts.
 *
 * Server-only. The pipeline runs:
 *
 *   External Source → Collector → Raw Response → Parser → Normalizer
 *                  → Validator → Confidence → Conflict → Persistence
 *
 * Stages are pure typed functions wired together by {@link runPipeline}.
 * Every stage is injectable so tests can substitute deterministic doubles.
 */

/** A normalised, qualitative confidence value matching `app.confidence_level`. */
export type ConfidenceLevel = 'unknown' | 'low' | 'medium' | 'high';

/** A normalised validation state matching `app.validation_state`. */
export type ValidationState = 'pending' | 'validated' | 'rejected' | 'needs_review';

/** A pipeline-stage outcome recorded for observability. */
export type StageName =
	| 'approval'
	| 'collect'
	| 'parse'
	| 'normalize'
	| 'validate'
	| 'confidence'
	| 'conflict'
	| 'persist';

export type StageOutcome =
	| 'success'
	| 'rights_blocked'
	| 'persist_failure'
	| 'parse_failure'
	| 'validation_failure'
	| 'collection_failure'
	| 'stale_skipped'
	| 'conflict_detected'
	| 'conflict_check_failure'
	| 'skipped';

export interface StageEvent {
	readonly stage: StageName;
	readonly outcome: StageOutcome;
	readonly durationMs: number;
	readonly notes?: ReadonlyArray<string>;
}

/** Source identifier (mirrors `app.sources.slug`). */
export type SourceId = string;

/** Field key used inside a source reference / fact (mirrors `app.field_key`). */
export type FieldKey = string;

export interface RetryPolicy {
	readonly maxAttempts: number;
	readonly baseMs: number;
	readonly capMs: number;
	readonly jitterRatio: number;
}

export interface RateLimitPolicy {
	readonly requestsPerWindow: number;
	readonly windowMs: number;
}

export interface SourceConfig {
	readonly sourceId: SourceId;
	readonly sourceKind:
		'synthetic' | 'resort_website' | 'national_api' | 'licensed_feed' | 'open_dataset' | 'manual';
	readonly endpoint: string;
	/** Non-secret protocol metadata required by a provider, such as XML Accept or an identifying User-Agent. */
	readonly requestAccept?: string;
	readonly requestUserAgent?: string;
	readonly requestTimeoutMs: number;
	readonly retry: RetryPolicy;
	readonly rateLimit: RateLimitPolicy;
	readonly cacheTtlMs: number;
	readonly staleAfterMs: number;
}

/** Provider request envelope — the wire-level response from a Collector. */
export interface RawResponse<TBody = unknown> {
	readonly body: TBody;
	readonly headers: Readonly<Record<string, string>>;
	readonly status: number;
	readonly fetchedAt: string;
	readonly durationMs: number;
	readonly sourceId: SourceId;
	readonly endpoint: string;
	readonly bytes: number;
}

/** Result envelope returned by each pipeline stage. */
export interface StageResult<T> {
	readonly ok: boolean;
	readonly data?: T;
	readonly errors: ReadonlyArray<string>;
	readonly warnings: ReadonlyArray<string>;
	/** Actual outbound provider requests; zero for cache hits and rate-limit rejections. */
	readonly providerRequests?: number;
}

export interface ParseResult<T> extends StageResult<T> {
	readonly fatal: boolean;
}

export interface NormalizedFactCandidate {
	readonly category: 'snow' | 'lift' | 'slope';
	/** Canonical domain key, unique within category. */
	readonly key: string;
	/** Database source-reference field key; does not contain punctuation. */
	readonly fieldKey?: string;
	readonly valueNumeric?: number;
	readonly valueText?: string;
	readonly unit?: string;
	readonly sourceObservedAt?: string;
}

/** A validated fact ready to be persisted. */
export interface ValidatedFact {
	readonly candidate: NormalizedFactCandidate;
	readonly validation: ValidationState;
	readonly confidence: ConfidenceLevel;
	readonly sourceId: SourceId;
	readonly approvalId: string;
	readonly sourceReferenceId: string;
	readonly fetchedAt: string;
	readonly validUntil: string;
	readonly retentionExpiresAt: string;
	readonly reasons: ReadonlyArray<string>;
}

export interface Conflict {
	readonly candidate: NormalizedFactCandidate;
	readonly existingValue: unknown;
	readonly resolution: 'keep_existing' | 'queue_for_review';
	readonly reason: string;
}

export interface PersistOutcome {
	readonly accepted: ReadonlyArray<ValidatedFact>;
	readonly rejected: ReadonlyArray<{ readonly fact: ValidatedFact; readonly reason: string }>;
	readonly conflicts: ReadonlyArray<Conflict>;
}

export interface PipelineSummary {
	readonly runId: string;
	readonly sourceId: SourceId;
	readonly startedAt: string;
	readonly endedAt: string;
	readonly outcome: StageOutcome;
	readonly latencyMs: number;
	readonly stages: ReadonlyArray<StageEvent>;
	readonly providerRequests: number;
	readonly parseFailures: number;
	readonly validationFailures: number;
	readonly collectionFailures: number;
	readonly staleSkipped: number;
	readonly conflictsDetected: number;
	readonly factsPersisted: number;
}

/** A Collector performs an HTTP fetch with bounded retries and timeout. */
export interface Collector {
	collect(config: SourceConfig): Promise<
		StageResult<
			RawResponse & {
				readonly attempts: number;
				readonly cacheHit: boolean;
				readonly stale: boolean;
			}
		>
	>;
}

export interface CollectOptions {
	readonly now?: () => Date;
	readonly sleep?: (ms: number) => Promise<void>;
}

/** A Parser maps raw bytes/JSON into a typed parsed structure. */
export interface Parser<TRaw, TParsed> {
	readonly name: string;
	parse(input: TRaw): ParseResult<TParsed>;
}

/** Normalizer maps parsed records to canonical fact candidates. */
export interface Normalizer<TParsed> {
	readonly name: string;
	normalize(input: TParsed): ReadonlyArray<NormalizedFactCandidate>;
}

/** Validator applies source approval + range/type rules to candidates. */
export type Validator = (
	candidates: ReadonlyArray<NormalizedFactCandidate>,
	source: SourceConfig
) => StageResult<ReadonlyArray<NormalizedFactCandidate>>;

/** ConfidenceScorer assigns the qualitative confidence enum per ADR-0009. */
export interface ConfidenceScorer {
	readonly name: string;
	score(
		candidate: NormalizedFactCandidate,
		source: SourceConfig,
		now?: () => Date
	): { confidence: ConfidenceLevel; reasons: ReadonlyArray<string> };
}

/** ConflictDetector decides whether to keep the existing fact or queue for review. */
export interface ConflictDetector {
	detect(
		candidates: ReadonlyArray<ValidatedFact>,
		existing: ReadonlyMap<string, unknown>
	): ReadonlyArray<Conflict>;
}

/** Persister writes raw/normalized/conflict records inside one transaction. */
export interface Persister {
	getCurrentValues(
		candidates: ReadonlyArray<NormalizedFactCandidate>
	): Promise<ReadonlyMap<string, unknown>>;
	persist(
		facts: ReadonlyArray<ValidatedFact>,
		conflicts: ReadonlyArray<Conflict>,
		summary: PipelineSummary,
		raw: RawResponse | null
	): Promise<PersistOutcome>;
}

/** Logger interface; structured, server-side only. */
export interface Logger {
	info(event: Record<string, unknown>): void;
	warn(event: Record<string, unknown>): void;
	error(event: Record<string, unknown>): void;
}

/** Clock used to keep time deterministic in unit tests. */
export interface Clock {
	now(): Date;
}

export const SYSTEM_CLOCK: Clock = { now: () => new Date() };
