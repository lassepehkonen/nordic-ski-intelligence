import { describe, expect, it } from 'vitest';
import {
	findUnsafeDatabaseCommands,
	findSchemaDdlOutsideMigrations,
	findUnapprovedDestructiveDdl
} from '../../scripts/check-database-safety.js';

describe('database safety checks', () => {
	it('ignores destructive words in comments and string literals', () => {
		expect(
			findUnapprovedDestructiveDdl("-- DROP TABLE app.resorts;\nSELECT 'DROP TABLE app.resorts';")
		).toEqual([]);
	});

	it('requires explicit approval for destructive DDL', () => {
		expect(findUnapprovedDestructiveDdl('DROP TABLE app.resorts;')).toEqual(['DROP TABLE']);
	});

	it('accepts destructive DDL only when a migration carries an approval marker', () => {
		expect(
			findUnapprovedDestructiveDdl('-- destructive-approved: ADR-0099\nDROP TABLE app.resorts;')
		).toEqual([]);
	});

	it('allows only local database resets and rejects remote/direct database commands', () => {
		expect(findUnsafeDatabaseCommands('run: supabase db reset --local')).toEqual([]);
		expect(findUnsafeDatabaseCommands('run: supabase db reset --linked')).toHaveLength(1);
		expect(findUnsafeDatabaseCommands('run: supabase db push --linked')).toHaveLength(1);
		expect(findUnsafeDatabaseCommands('run: supabase db execute --file schema.sql')).toHaveLength(
			1
		);
		expect(
			findUnsafeDatabaseCommands('run: psql $PRODUCTION_DATABASE_URL -f schema.sql')
		).toHaveLength(1);
	});

	it('requires schema DDL to live in versioned migrations', () => {
		expect(findSchemaDdlOutsideMigrations('CREATE TABLE app.resorts (id uuid);')).toEqual([
			'CREATE TABLE'
		]);
	});
});
