import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');

describe('Server boundary enforcement', () => {
	it('keeps collection modules under src/lib/server', () => {
		expect(existsSync(resolve(repo, 'src/lib/server/collect/runner.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/collector.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/parsers/levi/snow.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/normalizers/snow.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/validator.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/confidence.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/conflicts.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/persister.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/source-health.ts'))).toBe(true);
		expect(existsSync(resolve(repo, 'src/lib/server/collect/logger.ts'))).toBe(true);
	});

	it('exposes the trigger via src/lib/server/collect/trigger.ts', () => {
		expect(existsSync(resolve(repo, 'src/lib/server/collect/trigger.ts'))).toBe(true);
	});

	it('guards the collection endpoint under /api/collect/+server.ts', () => {
		expect(existsSync(resolve(repo, 'src/routes/api/collect/+server.ts'))).toBe(true);
	});

	it('does not import collector modules from shared client code', async () => {
		const clientFiles = [
			resolve(repo, 'src/lib/index.ts'),
			resolve(repo, 'src/routes/+page.svelte'),
			resolve(repo, 'src/routes/+layout.svelte')
		];
		for (const file of clientFiles) {
			if (!existsSync(file)) continue;
			const content = await import('node:fs').then((fs) => fs.promises.readFile(file, 'utf8'));
			expect(content).not.toMatch(/server\/collect\/(collector|parsers|persister|runtime)/);
		}
	});
});