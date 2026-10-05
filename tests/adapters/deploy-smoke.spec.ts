import { describe, expect, it, vi } from 'vitest';
import { smokeDeployment } from '../../scripts/netlify-smoke-plugin/smoke.js';

describe('Netlify deployment smoke check', () => {
	it('requests the exact deployment health endpoint', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ status: 'ok' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		await expect(smokeDeployment('https://preview.example.net', fetchImpl)).resolves.toEqual({
			status: 'ok',
			url: 'https://preview.example.net/api/health'
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			'https://preview.example.net/api/health',
			expect.objectContaining({ method: 'GET' })
		);
	});

	it('fails the smoke check for an unsuccessful response', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));

		await expect(smokeDeployment('https://preview.example.net', fetchImpl)).rejects.toThrow(
			'HTTP 404'
		);
	});

	it('rejects a missing deploy URL rather than silently skipping', async () => {
		await expect(smokeDeployment('', vi.fn())).rejects.toThrow('deployment URL is required');
	});
});
