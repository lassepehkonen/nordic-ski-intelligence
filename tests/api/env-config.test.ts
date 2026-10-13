import { describe, expect, it } from 'vitest';
import { variables } from '../../src/env.js';

describe('server environment variable contract', () => {
	it('keeps Supabase credentials private and runtime-configurable', () => {
		for (const config of [
			variables.SUPABASE_URL,
			variables.SUPABASE_PUBLISHABLE_KEY,
			variables.SUPABASE_SERVICE_ROLE_KEY
		]) {
			expect(config.public).toBe(false);
			expect(config.static).toBe(false);
		}
	});

	it('allows an unset optional value and normalizes configured strings', () => {
		expect(variables.SUPABASE_URL.schema?.['~standard'].validate(undefined)).toEqual({
			value: undefined
		});
		expect(
			variables.SUPABASE_PUBLISHABLE_KEY.schema?.['~standard'].validate('  key-value  ')
		).toEqual({ value: 'key-value' });
		expect(
			variables.SUPABASE_SERVICE_ROLE_KEY.schema?.['~standard'].validate('  service-secret  ')
		).toEqual({ value: 'service-secret' });
	});

	it('rejects a malformed Supabase URL before serving requests', () => {
		expect(variables.SUPABASE_URL.schema?.['~standard'].validate('not-a-url')).toMatchObject({
			issues: [{ message: 'SUPABASE_URL must be an absolute URL' }]
		});
	});
});
