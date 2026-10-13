import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createStructuredLogger } from '../../src/lib/server/collect/logger.js';
import { pilotResorts } from '../../src/lib/server/resorts/pilot.js';
import { runPilotWeather } from '../../src/lib/server/weather/runner.js';

describe('live weather snow', () => {
  it('collects and inspects snow fields', async () => {
    const run = await runPilotWeather({ resorts: pilotResorts, logger: createStructuredLogger('snow-run') });
    const summary = run.results.map((r) => ({
      slug: r.slug, provider: r.provider, ok: r.ok,
      points: r.data?.forecast.points.length ?? 0,
      withSnowDepth: r.data?.forecast.points.filter((p) => p.snowDepthCm !== null && p.snowDepthCm > 0).length ?? 0,
      withSnowfall: r.data?.forecast.points.filter((p) => (p.snowfallMm ?? 0) > 0).length ?? 0,
      errors: r.errors
    }));
    writeFileSync('/tmp/snow-summary.json', JSON.stringify({ success: run.successCount, failure: run.failureCount, summary }, null, 2));
    expect(true).toBe(true);
  });
}, 180000);
