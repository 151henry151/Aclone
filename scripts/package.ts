// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const dir = mkdtempSync(join(tmpdir(), 'aclone-release-')),
  name = `aclone-${version}`,
  root = join(dir, name);
mkdirSync(root);
const files = [
  'src',
  'data',
  'public',
  'docs',
  'tests',
  '.github',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'playwright.config.ts',
  'index.html',
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'LICENSE',
  'COPYRIGHT',
  'THIRD_PARTY_NOTICES.md',
  'Dockerfile',
  'compose.yaml',
  '.dockerignore',
  '.prettierignore',
  '.prettierrc.json',
];
try {
  for (const file of files) cpSync(file, join(root, file), { recursive: true });
  mkdirSync(join(root, 'scripts'));
  for (const file of ['backup.ts', 'package.ts', 'screenshots.ts'])
    cpSync(join('scripts', file), join(root, 'scripts', file));
  mkdirSync('release', { recursive: true });
  const output = resolve('release', name + '.tar.gz');
  execFileSync('tar', ['-czf', output, '-C', dir, name]);
  console.log(output);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
