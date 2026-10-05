export async function smokeDeployment(baseUrl, fetchImpl = globalThis.fetch) {
	if (!baseUrl) {
		throw new Error('deployment URL is required');
	}

	if (typeof fetchImpl !== 'function') {
		throw new Error('fetch implementation is required');
	}

	const healthUrl = new URL('/api/health', baseUrl).toString();
	const response = await fetchImpl(healthUrl, {
		method: 'GET',
		headers: { accept: 'application/json' },
		signal: AbortSignal.timeout(10_000)
	});

	if (!response.ok) {
		throw new Error(`deployment smoke check failed: HTTP ${response.status} at ${healthUrl}`);
	}

	if (!response.headers.get('content-type')?.includes('application/json')) {
		throw new Error(`deployment smoke check returned a non-JSON response at ${healthUrl}`);
	}

	const payload = await response.json();
	if (payload?.status !== 'ok') {
		throw new Error(`deployment smoke check returned an invalid health contract at ${healthUrl}`);
	}

	return { status: 'ok', url: healthUrl };
}
