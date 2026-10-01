// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { npcConfigSchema } from '../../src/server/npc/config.ts';
import type { BrainRequest } from '../../src/server/npc/decision.ts';

test('AI identity, memory notice and private NPC chat work through real sockets', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-npc-browser-'));
  let humanId = '',
    seen: BrainRequest[] = [];
  const app = await createApp({
    dataDir: dir,
    port: 0,
    dev: true,
    npc: {
      residents: [
        {
          config: npcConfigSchema.parse({ intervalMs: 5000 }),
          brain: {
            async decide(request) {
              seen.push(request);
              const context = JSON.stringify(request.observation);
              const invited = context.includes('blue tractors');
              const help = context.includes('which key opens the full parish map');
              if (help) expect(context).toContain('Parish map');
              return {
                decision: {
                  intent: 'Meet the neighbour',
                  notebook: invited ? 'Robin likes blue tractors.' : '',
                  speech: help
                    ? { text: 'Press M for the parish map; L for headlights.', to: humanId }
                    : invited
                      ? { text: 'Robin, I will remember your blue tractors.', to: humanId }
                      : null,
                  plan: [{ kind: 'wait' as const, seconds: 600 }],
                  repeat: 1,
                  reconsiderSeconds: 600,
                },
                inputTokens: 200,
                outputTokens: 50,
              };
            },
          },
        },
      ],
    },
  });
  try {
    const { account, token } = app.universe.register('Robin');
    humanId = account.id;
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#players')).toContainText('Mabel Reed');
    await expect(page.locator('#players .ai-tag')).toHaveText('AI');
    await page.getByRole('button', { name: 'AI resident · chat & memory info' }).click();
    await expect(page.getByRole('dialog', { name: 'AI neighbours.' })).toBeVisible();
    await expect(
      page.getByText('Relevant excerpts and game observations are sent to OpenAI', {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Chat with Mabel Reed' }).click();
    await expect(page.locator('#chat-recipient')).toContainText('Private message to Mabel Reed');
    await page
      .getByRole('textbox', { name: 'Chat message' })
      .fill('I collect blue tractors. Please remember that, Mabel.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.locator('#chat-log')).toContainText(
      'Robin, I will remember your blue tractors.',
      { timeout: 20000 },
    );
    const w = app.worlds.get('puddlewick')!;
    const reply = w.messages.find((m) => m.text === 'Robin, I will remember your blue tractors.')!;
    expect(reply.npc).toBe(true);
    expect(reply.to).toBe(humanId);
    expect(app.residents!.memory.load('mabel')!.notebook).toContain('blue tractors');
    await page
      .getByRole('textbox', { name: 'Chat message' })
      .fill('Mabel, which key opens the full parish map and which switches headlights?');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.locator('#chat-log')).toContainText(
      'Press M for the parish map; L for headlights.',
      { timeout: 20000 },
    );
    await page.screenshot({ path: 'test-results/npc-chat.png' });
    await page.getByRole('button', { name: 'Back to parish chat' }).click();
    await expect(page.locator('#chat-recipient')).toBeHidden();
    expect(seen.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
