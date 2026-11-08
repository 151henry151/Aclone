// SPDX-License-Identifier: GPL-3.0-or-later
/** Resolve a small rule subset without reallocating it on every environment query.
 * Compare live values on each read: world builders can edit settings in place.
 * Weak keys avoid retaining worlds; frozen results cannot poison another caller. */
export function cachedRuleValues<R extends object, K extends keyof R>(
  defaults: R,
  fields: Record<K, unknown>,
) {
  type Values = Pick<R, K>;
  const keys = Object.keys(fields) as K[];
  const cache = new WeakMap<object, Readonly<Values>>();
  const resolve = (settings: Partial<Values>) => {
    const values = {} as Values;
    for (const key of keys) values[key] = settings[key] ?? defaults[key];
    const result = Object.freeze(values);
    cache.set(settings, result);
    cache.set(result, result);
    return result;
  };
  const fallback = resolve({});
  return (settings?: Partial<Values>): Readonly<Values> => {
    if (!settings) return fallback;
    const old = cache.get(settings);
    // Already-resolved immutable rules are passed between calendar helpers.
    if (old === settings) return old;
    if (old) {
      let unchanged = true;
      for (const key of keys)
        if (old[key] !== (settings[key] ?? defaults[key])) {
          unchanged = false;
          break;
        }
      if (unchanged) return old;
    }
    return resolve(settings);
  };
}
