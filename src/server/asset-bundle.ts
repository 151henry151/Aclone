// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { validateVisualAsset } from './asset-validation.ts';
import type { World } from '../shared/types.ts';
export const assetExtensions: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'audio/mpeg': '.mp3',
  'model/gltf-binary': '.glb',
  'model/obj': '.obj',
};
export const provenanceSchema = z.object({
  author: z.string().max(120).default(''),
  license: z.string().max(120).default('Unspecified'),
  source: z.string().max(300).default(''),
});
const entry = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().max(80),
  type: z.string().refine((s) => Object.hasOwn(assetExtensions, s)),
  provenance: provenanceSchema.optional(),
  data: z
    .string()
    .max(2800000)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
});
export function decodeBundle(input: unknown) {
  const list = z.array(entry).max(32).parse(input),
    ids = new Set<string>();
  let total = 0;
  return list.map((a) => {
    const bytes = Buffer.from(a.data, 'base64');
    total += bytes.length;
    if (!bytes.length || bytes.length > 2 * 1024 * 1024 || total > 8 * 1024 * 1024)
      throw Error('Bundle media budget: 2 MiB per asset, 8 MiB total');
    if (ids.has(a.id) || createHash('sha256').update(bytes).digest('hex') !== a.id)
      throw Error('Duplicate or mismatched asset hash');
    ids.add(a.id);
    validateVisualAsset(bytes, a.type);
    const { data, ...metadata } = a;
    return {
      asset: {
        ...metadata,
        url: '/world-assets/' + a.id + assetExtensions[a.type],
      } as World['assets'][number],
      bytes,
    };
  });
}
