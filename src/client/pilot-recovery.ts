// SPDX-License-Identifier: GPL-3.0-or-later
/** Password inputs strip pasted newlines, so also accept the flattened export. */
export function parsePilotKey(input: string): string {
  let key = input.trim();
  const instruction = 'Keep this key private. Paste it into Restore pilot.';
  if (key.startsWith('Aclone pilot: ') && key.includes(instruction))
    key = key.slice(key.indexOf(instruction) + instruction.length).trim();
  // The server owns credential validity, including retained legacy device keys.
  if (!key || key.length > 100 || /\s/.test(key))
    throw Error('Paste your saved pilot key or the complete downloaded recovery file.');
  return key;
}
