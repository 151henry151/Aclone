// SPDX-License-Identifier: GPL-3.0-or-later
import { parentPort } from 'node:worker_threads';
import { register } from 'tsx/esm/api';
register();
const { adaptiveChoices } = await import('./adaptive.ts');
const { economicMenu } = await import('./enterprise.ts');
const { preferChoices } = await import('./preferences.ts');
const { focusCommitments } = await import('./commitments.ts');
const { learnedChoices } = await import('./agenda.ts');
const { planQuotes } = await import('./execution.ts');
const { savingChoices } = await import('./ambitions.ts');
const { supplyChoices } = await import('./survival.ts');
const { observe } = await import('./observation.ts');
parentPort.on(
  'message',
  ({ world, player, state, context, id, journal, conversation, observation }) => {
    try {
      if (observation) {
        parentPort.postMessage({
          observation: observe(
            world,
            player,
            state,
            {
              recent: () => journal,
              conversation: () => conversation,
            },
            id,
          ),
        });
        return;
      }
      const choices = [
        ...(context.includeGoals
          ? [...savingChoices(world, player, state), ...supplyChoices(world, player, state)]
          : []),
        ...context.before,
        ...adaptiveChoices(world, player, state),
        ...context.after,
      ];
      const menu = learnedChoices(
        state,
        economicMenu(
          world,
          player,
          preferChoices(
            focusCommitments(world, player, state, choices),
            context.preference,
            player.job,
          ),
          context.preference,
          context.busyVisit,
          state,
        ),
      );
      parentPort.postMessage({
        choices: menu.map((c) => ({ ...c, tradeQuotes: planQuotes(world, c.plan) })),
      });
    } catch (error) {
      parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
  },
);
