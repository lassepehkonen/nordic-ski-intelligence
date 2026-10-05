import type {
	Conflict,
	PersistOutcome,
	PipelineSummary,
	RawResponse,
	ValidatedFact
} from './types.js';

export interface InMemoryPersisterOptions {
	readonly approvalId?: string;
	readonly sourceReferenceId?: string;
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

export function createInMemoryPersister(options: InMemoryPersisterOptions = {}) {
	const records: PersistedRecord[] = [];
	let lastOutcome: PersistOutcome | null = null;

	function persist(
		facts: ReadonlyArray<ValidatedFact>,
		conflicts: ReadonlyArray<Conflict>,
		summary: PipelineSummary,
		raw: RawResponse | null
	): Promise<PersistOutcome> {
		const accepted: ValidatedFact[] = [];
		const rejected: { fact: ValidatedFact; reason: string }[] = [];

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
				insertedAt: new Date().toISOString()
			});
			accepted.push(fact);
		}

		for (const conflict of conflicts) {
			records.push({
				id: nextId(),
				kind: 'conflict',
				payload: conflict,
				insertedAt: new Date().toISOString()
			});
		}

		if (raw && raw.status >= 200 && raw.status < 300) {
			records.push({
				id: nextId(),
				kind: 'raw',
				payload: raw,
				insertedAt: new Date().toISOString()
			});
		}

		records.push({
			id: nextId(),
			kind: 'run',
			payload: summary,
			insertedAt: new Date().toISOString()
		});

		const outcome: PersistOutcome = {
			accepted,
			rejected,
			conflicts
		};
		lastOutcome = outcome;
		return Promise.resolve(outcome);
	}

	return {
		persist,
		records,
		lastOutcome: () => lastOutcome,
		recordsSnapshot: () => records.slice(),
		reset: () => {
			records.length = 0;
			lastOutcome = null;
		}
	};
}

export type InMemoryPersister = ReturnType<typeof createInMemoryPersister>;