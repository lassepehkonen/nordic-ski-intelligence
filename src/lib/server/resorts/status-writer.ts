import { getStatusFreshness, isStatusDisplayApproved } from './pilot.js';
import type { PilotResort } from './pilot.js';

export interface PilotStatusWriterOptions {
	supabaseUrl: string;
	serviceRoleKey: string;
	fetchImpl?: typeof fetch;
	now?: () => Date;
}

function assertCount(value: number | null, total: number | null): void {
	if (value !== null && (!Number.isInteger(value) || value < 0)) {
		throw new Error('manual_status_count_invalid');
	}
	if (value !== null && (total === null || value > total)) {
		throw new Error('manual_status_count_invalid');
	}
}

function statusAttribution(resort: PilotResort): string {
	const values = [
		resort.status.lifts.open,
		resort.status.lifts.total,
		resort.status.pistes.open,
		resort.status.pistes.total
	];
	const available = values.filter((value) => value !== null).length;
	const label =
		available === 4 ? 'four numeric counts' : available === 0 ? 'numeric counts' : 'numeric counts';
	return `${resort.name} official count page; ${label} only`;
}

export function createPilotStatusWriter(options: PilotStatusWriterOptions) {
	const baseUrl = options.supabaseUrl.replace(/\/+$/, '');
	const fetchImpl = options.fetchImpl ?? fetch;
	const now = options.now ?? (() => new Date());

	return {
		async publishSnapshots(resorts: ReadonlyArray<PilotResort>): Promise<void> {
			if (!baseUrl || !options.serviceRoleKey) {
				throw new Error('pilot_writer_configuration_missing');
			}
			const checkedAt = now();
			for (const resort of resorts) {
				if (!isStatusDisplayApproved(resort.status)) {
					throw new Error('manual_status_display_not_approved');
				}
				const sourceDate = Date.parse(resort.status.fetchedAt);
				if (!Number.isFinite(sourceDate)) throw new Error('manual_status_timestamp_invalid');
				const freshness = getStatusFreshness(resort.status, checkedAt);
				if (resort.status.freshness === 'fresh' && freshness !== 'fresh') {
					throw new Error('manual_status_snapshot_stale');
				}
				assertCount(resort.status.lifts.open, resort.status.lifts.total);
				assertCount(resort.status.pistes.open, resort.status.pistes.total);

				const allCountsAvailable = [
					resort.status.lifts.open,
					resort.status.lifts.total,
					resort.status.pistes.open,
					resort.status.pistes.total
				].every((value) => value !== null);
				const anyCountAvailable = [
					resort.status.lifts.open,
					resort.status.lifts.total,
					resort.status.pistes.open,
					resort.status.pistes.total
				].some((value) => value !== null);
				const statusState =
					freshness === 'stale'
						? 'stale'
						: freshness === 'scheduled'
							? 'scheduled'
							: freshness === 'unavailable'
								? 'unavailable'
								: allCountsAvailable
									? 'fresh'
									: anyCountAvailable
										? 'partial'
										: 'unavailable';
				const body = {
					status_open_lifts: resort.status.lifts.open,
					status_total_lifts: resort.status.lifts.total,
					status_open_pistes: resort.status.pistes.open,
					status_total_pistes: resort.status.pistes.total,
					status_state: statusState,
					status_checked_at: resort.status.fetchedAt,
					status_source_url: resort.status.sourceUrl,
					status_attribution: statusAttribution(resort),
					updated_at: checkedAt.toISOString()
				};

				let response: Response;
				try {
					response = await fetchImpl(
						`${baseUrl}/rest/v1/pilot_resorts?slug=eq.${encodeURIComponent(resort.slug)}`,
						{
							method: 'PATCH',
							headers: {
								apikey: options.serviceRoleKey,
								Authorization: `Bearer ${options.serviceRoleKey}`,
								'Content-Type': 'application/json',
								Prefer: 'return=minimal'
							},
							body: JSON.stringify(body),
							cache: 'no-store',
							signal: AbortSignal.timeout(10_000)
						}
					);
				} catch {
					throw new Error('pilot_status_write_failed');
				}
				if (!response.ok) throw new Error('pilot_status_write_failed');
			}
		}
	};
}
