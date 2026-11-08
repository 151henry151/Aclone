// SPDX-License-Identifier: GPL-3.0-or-later
import { Worker } from 'node:worker_threads';
import type { World, Player } from '../../shared/types';
import type { ResidentState, NpcMemory } from './memory';
import type { FarmerChoice } from './farmer';
import type { Preference } from './population';
import type { observe } from './observation';
export interface ChoiceContext {
  before: FarmerChoice[];
  includeGoals?: boolean;
  after: FarmerChoice[];
  preference: Preference;
  busyVisit: boolean;
}

/** One isolated dry-run at a time, with no pending snapshot queue. The resident
 * scheduler owns admission. Only returned choices and observations cross back into the live world. */
export class ChoicePreparation {
  private worker?: Worker;
  private cancel?: (reason: Error) => void;
  private closed = false;
  private stopping?: Promise<number>;
  run(
    world: World,
    player: Player,
    state: ResidentState,
    signal: AbortSignal,
    context: ChoiceContext,
  ): Promise<FarmerChoice[]> {
    return this.submit({ world, player, state, context }, signal, 'choices');
  }
  observe(
    world: World,
    player: Player,
    state: ResidentState,
    memory: NpcMemory,
    id: string,
    signal: AbortSignal,
  ): Promise<ReturnType<typeof observe>> {
    // Read only this resident's journal and selected conversation on the owning
    // thread. The worker has neither a database connection nor other journals.
    const journal = memory.recent(id, 12);
    const conversation =
      state.helpQuestion && state.questionFrom
        ? memory.conversation(id, state.questionFrom, state.playerId, !!state.replyTo)
        : [];
    return this.submit(
      { world, player, state, id, journal, conversation, observation: true },
      signal,
      'observation',
    );
  }
  private submit<Result>(
    payload: unknown,
    signal: AbortSignal,
    key: 'choices' | 'observation',
  ): Promise<Result> {
    if (this.closed || signal.aborted) return Promise.reject(Error('Choice preparation cancelled'));
    if (this.cancel) return Promise.reject(Error('Choice preparation already busy'));
    if (!this.worker) {
      const worker = new Worker(new URL('./choice-worker.mjs', import.meta.url), { execArgv: [] });
      worker.on('error', () => {});
      worker.once('exit', () => {
        if (this.worker === worker) this.worker = undefined;
      });
      this.worker = worker;
    }
    const worker = this.worker;
    return new Promise<Result>((resolve, reject) => {
      const clear = () => {
        signal.removeEventListener('abort', abort);
        worker.off('message', message);
        worker.off('error', failed);
        worker.off('exit', exited);
        this.cancel = undefined;
      };
      const failed = (error: Error) => {
        clear();
        if (this.worker === worker) this.worker = undefined;
        // Retain admission until the cancelled worker has actually stopped.
        this.cancel = () => {};
        this.stopping = worker.terminate();
        void this.stopping.then(() => {
          this.cancel = undefined;
          reject(error);
        });
      };
      const abort = () => failed(Error('Choice preparation cancelled'));
      const exited = () => failed(Error('Choice preparation worker exited'));
      const message = (result: { choices?: Result; observation?: Result; error?: string }) => {
        clear();
        result[key]
          ? resolve(result[key])
          : reject(Error(result.error ?? 'Missing prepared choices'));
      };
      worker.once('message', message);
      worker.once('error', failed);
      worker.once('exit', exited);
      signal.addEventListener('abort', abort, { once: true });
      this.cancel = failed;
      try {
        worker.postMessage(payload);
      } catch (error) {
        failed(error as Error);
      }
    });
  }
  close() {
    this.closed = true;
    this.cancel?.(Error('Choice preparation closed'));
    const worker = this.worker;
    this.worker = undefined;
    if (worker) this.stopping = worker.terminate();
    return this.stopping;
  }
}
