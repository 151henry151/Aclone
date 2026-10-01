// SPDX-License-Identifier: GPL-3.0-or-later
/** Shallow field replacement; explicit removals distinguish deletion from JSON null. */
export interface FieldPatch {
  set?: Record<string, unknown>;
  unset?: string[];
}
export type SerializedFields = Record<string, string>;
export function serializeFields(value: object): SerializedFields {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, JSON.stringify(v)]),
  );
}
export function diffFields(
  before: SerializedFields,
  after: SerializedFields,
): FieldPatch | undefined {
  const set: Record<string, unknown> = {};
  const unset = Object.keys(before).filter((key) => !(key in after));
  for (const [key, value] of Object.entries(after))
    if (before[key] !== value) set[key] = JSON.parse(value);
  if (!Object.keys(set).length && !unset.length) return;
  return { ...(Object.keys(set).length ? { set } : {}), ...(unset.length ? { unset } : {}) };
}
export function applyFields<T extends object>(before: T, patch: FieldPatch): T {
  const result = { ...before, ...patch.set };
  for (const key of patch.unset ?? []) delete (result as Record<string, unknown>)[key];
  return result;
}
