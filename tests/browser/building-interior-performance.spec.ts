// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const run = promisify(execFile);

test('all-open town interiors stay within the matched island frame-time budget', async () => {
  test.setTimeout(900000);
  // Run alone: other GPU/browser jobs invalidate a matched comparison.
  for (const quality of ['low', 'normal']) {
    const measurements: Record<string, any> = {};
    for (const mode of ['closed', 'open']) {
      const out = `output/building-interiors/performance-final-${quality}-${mode}`;
      mkdirSync(out, { recursive: true });
      const { stdout, stderr } = await run(
        process.execPath,
        ['--import', 'tsx', 'scripts/island-performance.ts'],
        {
          env: {
            ...process.env,
            PROFILE_WORLD: 'expanded',
            PROFILE_CASES: 'town',
            PROFILE_POPULATION: '32',
            PROFILE_SKIP_MAP: '1',
            PROFILE_QUALITY: quality,
            PROFILE_DOORS: mode,
            PROFILE_OUT: out,
          },
          maxBuffer: 8 * 1024 * 1024,
        },
      );
      writeFileSync(out + '/run.log', stdout + stderr);
      const result = JSON.parse(readFileSync(out + '/results.json', 'utf8'));
      expect(result.errors).toEqual([]);
      expect(result.results).toHaveLength(1);
      measurements[mode] = result.results[0];
      expect(measurements[mode].furnishedInteriors).toBeGreaterThan(0);
      if (mode === 'open')
        expect(measurements[mode].openInteriors).toBe(measurements[mode].furnishedInteriors);
      else expect(measurements[mode].openInteriors).toBe(0);
      expect(measurements[mode].frames).toBeGreaterThan(200);
      expect(measurements[mode].p50).toBeLessThanOrEqual(50);
      expect(measurements[mode].p95).toBeLessThanOrEqual(66.7);
      expect(measurements[mode].over100ms).toBe(0);
      console.log(
        quality,
        mode,
        JSON.stringify({
          p95: measurements[mode].p95,
          max: measurements[mode].max,
          draws: measurements[mode].draws,
        }),
      );
    }
    expect(measurements.open.p95).toBeLessThanOrEqual(measurements.closed.p95 * 1.1);
  }
});
