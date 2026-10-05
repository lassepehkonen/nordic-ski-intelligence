import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function findUnapprovedDestructiveDdl(sql) {
	const approved = /--\s*destructive-approved:\s*[A-Z0-9-]+/i.test(sql);
	const executableSql = sql
		.replace(/'(?:''|[^'])*'/g, "''")
		.replace(/--[^\n]*/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '');
	const destructive = [
		[/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
		[/\bDROP\s+SCHEMA\b/i, 'DROP SCHEMA'],
		[/\bDROP\s+DATABASE\b/i, 'DROP DATABASE'],
		[/\bDROP\s+ROLE\b/i, 'DROP ROLE'],
		[/\bDROP\s+EXTENSION\b/i, 'DROP EXTENSION'],
		[/\bDROP\s+(?:FUNCTION|PROCEDURE|TYPE)\b/i, 'DROP FUNCTION/PROCEDURE/TYPE'],
		[/\bTRUNCATE\b/i, 'TRUNCATE'],
		[/\bDELETE\s+FROM\b/i, 'DELETE FROM'],
		[/\bALTER\s+TABLE\b[^;]*\bDROP\s+(?:COLUMN|CONSTRAINT)\b/i, 'ALTER TABLE DROP']
	];

	if (approved) return [];
	return destructive.filter(([pattern]) => pattern.test(executableSql)).map(([, label]) => label);
}

export function findSchemaDdlOutsideMigrations(sql) {
	const executableSql = sql
		.replace(/'(?:''|[^'])*'/g, "''")
		.replace(/--[^\n]*/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '');
	const schemaDdl = [
		[/\bCREATE\s+(?:OR\s+REPLACE\s+)?SCHEMA\b/i, 'CREATE SCHEMA'],
		[/\bCREATE\s+(?:OR\s+REPLACE\s+)?TABLE\b/i, 'CREATE TABLE'],
		[/\bCREATE\s+(?:OR\s+REPLACE\s+)?INDEX\b/i, 'CREATE INDEX'],
		[/\bCREATE\s+(?:OR\s+REPLACE\s+)?TYPE\b/i, 'CREATE TYPE'],
		[/\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b/i, 'CREATE VIEW'],
		[/\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE|TRIGGER)\b/i, 'CREATE ROUTINE/TRIGGER'],
		[/\bALTER\s+TABLE\b/i, 'ALTER TABLE'],
		[/\bALTER\s+SCHEMA\b/i, 'ALTER SCHEMA'],
		[/\bALTER\s+TYPE\b/i, 'ALTER TYPE'],
		[
			/\bDROP\s+(?:TABLE|SCHEMA|INDEX|TYPE|VIEW|FUNCTION|PROCEDURE|TRIGGER)\b/i,
			'DROP SCHEMA OBJECT'
		]
	];
	return schemaDdl.filter(([pattern]) => pattern.test(executableSql)).map(([, label]) => label);
}

export function findUnsafeDatabaseCommands(text) {
	const violations = [];
	for (const line of text.split(/\r?\n/)) {
		const reset = line.match(/\bsupabase\s+db\s+reset\b[^\n]*/i);
		if (reset && /--local\b/.test(reset[0])) continue;
		if (
			reset ||
			/\bsupabase\s+db\s+(?:push|execute)\b/i.test(line) ||
			/\bsupabase\s+link\b/i.test(line) ||
			/\b(?:psql|pg_restore|dropdb|createdb)\b/i.test(line)
		) {
			violations.push(line.trim());
		}
	}
	return violations;
}

function walkSqlFiles(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? walkSqlFiles(file) : file.endsWith('.sql') ? [file] : [];
	});
}

export function auditDatabaseSafety(rootDirectory) {
	const violations = [];
	const workflowsDirectory = path.join(rootDirectory, '.github', 'workflows');
	if (existsSync(workflowsDirectory)) {
		for (const file of readdirSync(workflowsDirectory)) {
			if (!/\.ya?ml$/i.test(file)) continue;
			const text = readFileSync(path.join(workflowsDirectory, file), 'utf8');
			for (const command of findUnsafeDatabaseCommands(text)) {
				violations.push(`${file}: unsafe remote-capable database command: ${command}`);
			}
		}
	}

	const packagePath = path.join(rootDirectory, 'package.json');
	if (existsSync(packagePath)) {
		const scripts = JSON.parse(readFileSync(packagePath, 'utf8')).scripts ?? {};
		for (const [name, command] of Object.entries(scripts)) {
			for (const violation of findUnsafeDatabaseCommands(String(command))) {
				violations.push(
					`package.json script ${name}: unsafe remote-capable database command: ${violation}`
				);
			}
		}
	}

	const supabaseDirectory = path.join(rootDirectory, 'supabase');
	for (const file of walkSqlFiles(path.join(supabaseDirectory, 'migrations'))) {
		const labels = findUnapprovedDestructiveDdl(readFileSync(file, 'utf8'));
		for (const label of labels) {
			violations.push(
				`${path.relative(rootDirectory, file)}: ${label} requires a destructive-approved migration marker`
			);
		}
	}
	for (const file of walkSqlFiles(supabaseDirectory)) {
		const relative = path.relative(supabaseDirectory, file);
		if (relative.startsWith(`migrations${path.sep}`) || relative.startsWith(`tests${path.sep}`))
			continue;
		const labels = findSchemaDdlOutsideMigrations(readFileSync(file, 'utf8'));
		for (const label of labels) {
			violations.push(
				`${path.relative(rootDirectory, file)}: ${label} must be stored in supabase/migrations`
			);
		}
	}
	return violations;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
	const root = path.resolve(path.dirname(scriptPath), '..');
	const violations = auditDatabaseSafety(root);
	if (violations.length) {
		console.error(violations.join('\n'));
		process.exitCode = 1;
	} else {
		console.log(
			'Database safety checks passed: resets are local-only; remote pushes and unapproved destructive DDL are absent.'
		);
	}
}
