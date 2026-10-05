// SPDX-License-Identifier: GPL-3.0-or-later

/** Store a pilot key carried in the URL hash, then return the hash with that secret removed. */
export function adoptCarriedPilot(
  hash: string,
  storage: { setItem(key: string, value: string): void },
): string {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const pilot = params.get('pilot');
  if (!pilot) return hash;
  storage.setItem('aclone.pilot', pilot);
  const world = params.get('world');
  if (world) storage.setItem('aclone.world', world);
  params.delete('pilot');
  params.delete('world');
  const next = params.toString();
  return next ? `#${next}` : '';
}
