// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const run = promisify(execFile);
test('parked fleet stays within the matched active-fleet town frame budget', async () => {
  test.setTimeout(900000);
  for (const quality of ['low', 'normal']) {
    const measurements: Record<string, any> = {};
    for (const mode of ['active', 'parked']) {
      const out = `output/parked-vehicles/performance-${quality}-${mode}`;
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
            PROFILE_PARKED: mode === 'parked' ? '1' : '0',
            PROFILE_OUT: out,
          },
          maxBuffer: 8 * 1024 * 1024,
        },
      );
      writeFileSync(out + '/run.log', stdout + stderr);
      const result = JSON.parse(readFileSync(out + '/results.json', 'utf8'));
      expect(result.errors).toEqual([]);
      expect(result.results).toHaveLength(1);
      const row = (measurements[mode] = result.results[0]);
      expect(row.parkedVehicles).toBe(mode === 'parked' ? 21 : 0);
      expect(row.drawnParkedVehicles).toBe(mode === 'parked' ? 21 : 0);
      expect(row.frames).toBeGreaterThan(200);
      expect(row.p50).toBeLessThanOrEqual(50);
      expect(row.p95).toBeLessThanOrEqual(66.7);
      expect(row.over100ms).toBe(0);
      console.log(
        quality,
        mode,
        JSON.stringify({ p95: row.p95, max: row.max, draws: row.draws, triangles: row.triangles }),
      );
    }
    expect(measurements.parked.p95).toBeLessThanOrEqual(measurements.active.p95 * 1.1);
  }
});
