import { describe, expect, it } from 'vitest';
import { healthPayload } from './health';

describe('health payload', () => {
	it('exposes only the non-sensitive service status', () => {
		expect(healthPayload()).toEqual({ status: 'ok' });
	});
});
