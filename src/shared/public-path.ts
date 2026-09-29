// SPDX-License-Identifier: GPL-3.0-or-later
/** Join a Vite `base` (for example `/` or `/aclone/`) with a root-absolute path. */
export function publicPath(base: string, path: string): string {
  if (!path.startsWith('/')) throw Error('Absolute path required');
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  if (prefix === '' || prefix === '/') return path;
  return prefix + path;
}
