// SPDX-License-Identifier: GPL-3.0-or-later
/** Client address for rate limits. Trust X-Real-IP only from a loopback peer. */
export function clientAddress(remote: string | undefined, forwarded: string | undefined): string {
  const address = remote ?? '';
  const loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  const header = forwarded?.trim() ?? '';
  if (loopback && header.length > 0 && header.length < 80 && !header.includes(',')) return header;
  return address || 'unknown';
}
