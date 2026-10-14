import type {
	Conflict,
	NormalizedFactCandidate,
	PersistOutcome,
	PipelineSummary,
	RawResponse,
	ValidatedFact
} from './types.js';

export interface InMemoryPersisterOptions {
	readonly approvalId?: string;
	readonly sourceReferenceId?: string;
	readonly initialValues?: ReadonlyMap<string, unknown>;
}

export interface PersistedRecord {
	readonly id: string;
	readonly kind: 'raw' | 'normalized' | 'conflict' | 'failure' | 'run';
	readonly payload: unknown;
	readonly insertedAt: string;
}

let counter = 0;
function nextId(): string {
	counter += 1;
	return `persisted-${counter.toString().padStart(6, '0')}`;
}

export function factIdentity(candidate: NormalizedFactCandidate): string {
	return `${candidate.category}.${candidate.key}`;
}

export function createInMemoryPersister(options: InMemoryPersisterOptions = {}) {
	const records: PersistedRecord[] = [];
	const initialValues = new Map(options.initialValues ?? []);
	const latestValues = new Map(initialValues);
	let lastOutcome: PersistOutcome | null = null;

	async function persist(
		facts: ReadonlyArray<ValidatedFact>,
		conflicts: ReadonlyArray<Conflict>,
		summary: PipelineSummary,
		raw: RawResponse | null
	): Promise<PersistOutcome> {
		const accepted: ValidatedFact[] = [];
		const rejected: { fact: ValidatedFact; reason: string }[] = [];
		const insertedAt = summary.endedAt;

		for (const fact of facts) {
			if (fact.validation !== 'validated') {
				rejected.push({ fact, reason: `validation state is ${fact.validation}` });
				continue;
			}
			records.push({
				id: nextId(),
				kind: 'normalized',
				payload: {
					...fact,
					approvalId: fact.approvalId ?? options.approvalId ?? null,
					sourceReferenceId: fact.sourceReferenceId ?? options.sourceReferenceId ?? null
				},
				insertedAt
			});
			const value = fact.candidate.valueNumeric ?? fact.candidate.valueText;
			if (value !== undefined) {
				latestValues.set(factIdentity(fact.candidate), {
					value,
					sourceId: fact.sourceId,
					sourceObservedAt: fact.candidate.sourceObservedAt
				});
			}
			accepted.push(fact);
		}

		for (const conflict of conflicts) {
			records.push({ id: nextId(), kind: 'conflict', payload: conflict, insertedAt });
		}

		// Raw bodies are never inferred as persistable. The caller passes one only
		// after a source-specific approval explicitly permits raw retention.
		if (raw && raw.status >= 200 && raw.status < 300) {
			records.push({ id: nextId(), kind: 'raw', payload: raw, insertedAt });
		}

		records.push({ id: nextId(), kind: 'run', payload: summary, insertedAt });
		const outcome: PersistOutcome = { accepted, rejected, conflicts };
		lastOutcome = outcome;
		return outcome;
	}

	return {
		persist,
		getCurrentValues: async () => new Map(latestValues),
		records,
		lastOutcome: () => lastOutcome,
		recordsSnapshot: () => records.slice(),
		currentValues: () => new Map(latestValues),
		reset: () => {
			records.length = 0;
			latestValues.clear();
			for (const [key, value] of initialValues) latestValues.set(key, value);
			lastOutcome = null;
		}
	};
}

export type InMemoryPersister = ReturnType<typeof createInMemoryPersister>;
