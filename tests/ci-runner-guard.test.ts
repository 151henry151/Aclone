// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const guard = resolve('scripts/ci/guard-job.sh');
const trusted = {
  GITHUB_REPOSITORY: '151henry151/Aclone',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_WORKFLOW_REF: '151henry151/Aclone/.github/workflows/ci.yml@refs/heads/main',
};
function job(overrides: Record<string, string | undefined>) {
  // A worker must not survive rejection and execute an `if: always()` step.
  return spawnSync(
    process.execPath,
    [
      '-e',
      `
    const {spawnSync}=require('node:child_process');
    spawnSync('/bin/bash', [process.argv[1]], {stdio:'inherit'});
    console.log('JOB_STEP_EXECUTED');
  `,
      guard,
    ],
    { env: { PATH: process.env.PATH, ...trusted, ...overrides }, encoding: 'utf8' },
  );
}
test('GPU host gate allows only the trusted main workflow', () => {
  const accepted = job({});
  assert.equal(accepted.status, 0);
  assert.match(accepted.stdout, /JOB_STEP_EXECUTED/);
  assert.match(accepted.stdout, /Trusted main job/);
});
for (const [name, overrides] of Object.entries({
  'pull request': { GITHUB_EVENT_NAME: 'pull_request' },
  'PR target': { GITHUB_EVENT_NAME: 'pull_request_target' },
  branch: { GITHUB_REF: 'refs/heads/untrusted' },
  repository: { GITHUB_REPOSITORY: 'someone/Aclone' },
  workflow: {
    GITHUB_WORKFLOW_REF: '151henry151/Aclone/.github/workflows/other.yml@refs/heads/main',
  },
  missing: { GITHUB_WORKFLOW_REF: '' },
})) {
  test(`GPU host gate terminates the worker for ${name}`, () => {
    const rejected = job(overrides);
    assert.equal(rejected.signal, 'SIGKILL');
    assert.doesNotMatch(rejected.stdout, /JOB_STEP_EXECUTED/);
    assert.match(rejected.stderr, /Rejecting untrusted GPU job/);
  });
}
