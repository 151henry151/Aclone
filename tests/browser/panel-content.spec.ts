// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('live panel updates preserve controls, drafts, focus and disclosures while updating content', async ({
  page,
}) => {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, hmr: false },
    logLevel: 'silent',
  });
  await server.listen();
  const port = (server.httpServer!.address() as { port: number }).port;
  try {
    await page.route(`http://127.0.0.1:${port}/`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<main id="panel"></main>' }),
    );
    await page.goto(`http://127.0.0.1:${port}/`);
    const result = await page.evaluate(async () => {
      const { patchPanelContent } = await import('/src/client/panel-content.ts' as string);
      const root = document.querySelector('#panel')!;
      const markup = (updated: boolean) =>
        `<details><summary>Charters</summary><input name="fare" value="10" max="${updated ? 30 : 20}"><button data-player="alice">Invite Alice</button>${updated ? '<button data-player="bob">Invite Bob</button>' : ''}<p>${updated ? 'Two guests' : 'One guest'}</p></details>`;
      patchPanelContent(root, markup(false));
      const input = root.querySelector('input')!;
      const button = root.querySelector('button')!;
      const disclosure = root.querySelector('details')!;
      disclosure.open = true;
      input.value = '17';
      input.focus();
      patchPanelContent(root, markup(true));
      const updated = {
        sameInput: input === root.querySelector('input'),
        sameButton: button === root.querySelector('button'),
        value: input.value,
        max: input.max,
        focus: document.activeElement === input,
        open: disclosure.open,
        text: root.querySelector('p')!.textContent,
        buttons: root.querySelectorAll('button').length,
      };
      patchPanelContent(root, markup(false));
      return { ...updated, removed: root.querySelector('[data-player="bob"]') === null };
    });
    expect(result).toEqual({
      sameInput: true,
      sameButton: true,
      value: '17',
      max: '30',
      focus: true,
      open: true,
      text: 'Two guests',
      buttons: 2,
      removed: true,
    });
  } finally {
    await page.close();
    await server.close();
  }
});
