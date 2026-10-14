import { describe, expect, it, vi } from 'vitest';
import { createPilotStatusWriter } from '../../src/lib/server/resorts/status-writer.js';
import { pilotResorts } from '../../src/lib/server/resorts/pilot.js';

describe('pilot status writer', () => {
	it('publishes only the four permitted count fields and local capture metadata', async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const fetchImpl: typeof fetch = async (input, init = {}) => {
			calls.push({ url: String(input), init });
			return new Response(null, { status: 204 });
		};
		const levi = pilotResorts.find((resort) => resort.slug === 'levi');
		expect(levi).toBeDefined();
		const writer = createPilotStatusWriter({
			supabaseUrl: 'https://ugeoxrfagumamxyhqnjw.supabase.co',
			serviceRoleKey: 'service-role-test',
			fetchImpl,
			now: () => new Date('2026-10-12T12:00:00Z')
		});

		await writer.publishSnapshots([levi!]);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toContain('pilot_resorts?slug=eq.levi');
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
			status_open_lifts: 3,
			status_total_lifts: 28,
			status_open_pistes: 3,
			status_total_pistes: 44,
			status_state: 'fresh',
			status_checked_at: '2026-10-12T11:29:27Z',
			status_source_url: 'https://www.levi.fi/en/ski/ski-resort-today/',
			status_attribution: 'Levi official count page; four numeric counts only',
			updated_at: '2026-10-12T12:00:00.000Z'
		});
		expect(calls[0]?.url).not.toMatch(/opendata|met\.no|smhi\.se/i);
	});

	it('refuses to republish an expired manual snapshot', async () => {
		const fetchImpl = vi.fn<typeof fetch>();
		const levi = pilotResorts.find((resort) => resort.slug === 'levi');
		const writer = createPilotStatusWriter({
			supabaseUrl: 'https://ugeoxrfagumamxyhqnjw.supabase.co',
			serviceRoleKey: 'service-role-test',
			fetchImpl,
			now: () => new Date('2026-10-13T12:00:00Z')
		});

		await expect(writer.publishSnapshots([levi!])).rejects.toThrow('manual_status_snapshot_stale');
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('preserves an explicitly stale status instead of publishing it as fresh', async () => {
		const calls: Array<{ init: RequestInit }> = [];
		const fetchImpl: typeof fetch = async (_input, init = {}) => {
			calls.push({ init });
			return new Response(null, { status: 204 });
		};
		const levi = pilotResorts.find((resort) => resort.slug === 'levi');
		const staleLevi = {
			...levi!,
			status: { ...levi!.status, freshness: 'stale' as const }
		};
		const writer = createPilotStatusWriter({
			supabaseUrl: 'https://ugeoxrfagumamxyhqnjw.supabase.co',
			serviceRoleKey: 'service-role-test',
			fetchImpl,
			now: () => new Date('2026-10-12T12:00:00Z')
		});

		await writer.publishSnapshots([staleLevi]);

		expect(JSON.parse(String(calls[0]?.init.body)).status_state).toBe('stale');
	});
});
