// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
test('public quay gallery shows a fixed design with working rotation, zoom and close', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    for (const file of ['gallery.js', 'gallery.css'])
      await page.route('**/buildings/' + file, (r) =>
        r.fulfill({
          contentType: file.endsWith('.js') ? 'text/javascript' : 'text/css',
          body: readFileSync('website/buildings/' + file, 'utf8'),
        }),
      );
    await page.route('**/assets/building-viewer/viewer.js', (r) =>
      r.fulfill({
        contentType: 'text/javascript',
        body: "export {mount} from '/src/client/building-gallery-viewer.ts';",
      }),
    );
    await page.route('**/assets/buildings/quay.webp', (r) =>
      existsSync('website/assets/buildings/quay.webp')
        ? r.fulfill({
            contentType: 'image/webp',
            body: readFileSync('website/assets/buildings/quay.webp'),
          })
        : r.fulfill({ status: 404, body: '' }),
    );
    await page.route('**/__quay-gallery', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: readFileSync('website/buildings/index.html', 'utf8')
          .replace(
            '__BUILDING_CARDS__',
            '<article data-search="freight quay"><a href="/assets/buildings/quay.webp" data-preview="quay" data-name="Freight quay">Explore Freight quay in 3D</a></article>',
          )
          .replace('</head>', "<script>globalThis.__ACLONE_BASE__='/'</script></head>"),
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__quay-gallery');
    await page.getByRole('link', { name: 'Explore Freight quay in 3D' }).click();
    await expect(page.locator('#building-preview')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#preview-model')).toBeDisabled();
    await expect(page.locator('#preview-finish')).toBeDisabled();
    await expect(page.locator('#preview-model')).toContainText('Fixed design');
    await page.getByRole('button', { name: 'Rotate right', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.locator('#building-preview canvas')).toBeVisible();
    await page.screenshot({ path: 'output/cargo-boat/quay-gallery.png' });
    await page.getByRole('button', { name: 'Close building preview' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
