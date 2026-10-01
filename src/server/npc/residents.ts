// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from '../../shared/types.ts';
import { act, addPlayer, move } from '../../shared/simulation.ts';
import { resourceNodes } from '../../shared/resources.ts';
import type { Store } from '../store.ts';
import type { Universe } from '../universe.ts';
import { NpcMemory, type ResidentState } from './memory.ts';
import { NpcBudget, budgetSchema, type TokenRates, type BudgetConfig } from './budget.ts';
import { decisionSchema, type Brain, type BrainResult, type Step } from './decision.ts';
import type { NpcConfig } from './config.ts';
import { failStep, blockedStep, madeProgress, allowSpeech } from './recovery.ts';
import { distance } from '../../shared/simulation.ts';
import { Navigator } from './navigation.ts';
import { instructions, observe } from './observation.ts';
import { jevInstructions } from './jev.ts';
import { farmerChoices, farmerSituation } from './farmer.ts';
import { outputLimit, turnTool } from './turn-tool.ts';
export interface ResidentOptions {
  config: NpcConfig;
  brain: Brain;
  rates?: TokenRates;
  dialogue?: { brain: Brain; rates: TokenRates };
}
interface Resident extends ResidentOptions {
  state: ResidentState;
  nav?: Navigator;
  navOrigin?: { x: number; z: number };
  busy?: AbortController;
  pending?: Promise<void>;
  wake: boolean;
  lastCall: number;
  cooldown: number;
  active: boolean;
}
export class Residents {
  readonly memory: NpcMemory;
  readonly budget: NpcBudget;
  private residents: Resident[] = [];
  onTask?: (w: World, id: string) => void;
  private closed = false;
  private pollAt = 0;
  constructor(
    private store: Store,
    private universe: Universe,
    private worlds: Map<string, World>,
    options: ResidentOptions[],
    budget: Partial<BudgetConfig> = {},
  ) {
    this.memory = new NpcMemory(store);
    this.budget = new NpcBudget(this.memory, budgetSchema.parse(budget));
    store.db
      .prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')
      .run('npc-budget-config', JSON.stringify(this.budget.config));
    if (options.length > 50 || new Set(options.map((o) => o.config.id)).size !== options.length)
      throw Error('Choose at most 50 unique resident IDs');
    for (const option of options) {
      const c = option.config,
        w = worlds.get(c.world);
      if (!w || w.template !== 'economy')
        throw Error('NPC world must be an existing economy parish');
      w.messageSeq = Math.max(w.messageSeq ?? 0, ...w.messages.map((m) => m.id ?? 0));
      // Old saves lack sequence IDs; migrate the entire retained ring in order.
      if (w.messages.some((m) => !m.id))
        for (const message of w.messages) message.id = ++w.messageSeq;
      let state = this.memory.load(c.id);
      if (state && state.world !== w.id)
        throw Error('An existing NPC cannot be moved to another world by configuration');
      if (!state)
        this.store.transaction(() => {
          const { account } = this.universe.register(c.name);
          account.npc = true;
          this.universe.save(account);
          state = {
            playerId: account.id,
            world: w.id,
            name: account.name,
            personality: c.personality,
            notebook: '',
            intent: c.initialGoal,
            cursor: w.messageSeq ?? 0,
            nextAt: 0,
            plan: [],
            index: 0,
            repeats: 0,
            until: 0,
            waitUntil: 0,
            status: 'Ready',
            errors: 0,
          };
          this.memory.save(c.id, state);
        });
      state = state!;
      if (state.personality !== c.personality) {
        this.memory.append(c.id, w.time, 'personality', {
          previous: state.personality,
          current: c.personality,
        });
        state.personality = c.personality;
      }
      const p = addPlayer(w, state.playerId, state.name);
      p.npc = true;
      p.authority = 0;
      p.online = false;
      p.speed = 0;
      const r: Resident = {
        ...option,
        state,
        wake: !!state.needsDecision || !!state.pending || state.plan.length === 0,
        lastCall: 0,
        cooldown: 0,
        active: false,
      };
      this.residents.push(r);
      this.checkpoint(r, w, 'session', { event: 'Resident controller started', model: c.model });
    }
  }
  /** Called inside the same SQLite transaction that saves the world/chat. */
  capture(w: World) {
    for (const r of this.residents.filter((r) => r.state.world === w.id)) {
      r.state.cursor = this.memory.load(r.config.id)?.cursor ?? r.state.cursor;
      let changed = false;
      for (const m of w.messages) {
        if (!m.id || m.id <= r.state.cursor) continue;
        changed = true;
        r.state.cursor = m.id;
        if (m.to && m.to !== r.state.playerId && m.name !== r.state.name) continue;
        const sender = Object.values(w.players).find((p) => p.name === m.name);
        this.memory.append(r.config.id, w.time, 'chat', { ...m, sender: sender?.id });
        if (
          m.kind === 'chat' &&
          sender &&
          !sender.npc &&
          (m.to === r.state.playerId ||
            m.text.toLowerCase().includes(r.state.name.toLowerCase().split(' ')[0]))
        ) {
          r.wake = true;
          r.state.needsDecision = true;
          r.state.helpQuestion = m.text;
          r.state.questionFrom = sender.id;
          // A person can ask about the problem immediately; the failed-step
          // block remains, so chatting cannot restart the same action loop.
          if (r.state.recovery) r.state.recovery.retryAt = 0;
          r.state.replyTo = m.to === r.state.playerId ? sender.id : undefined;
        }
      }
      if (changed) this.memory.save(r.config.id, r.state);
    }
  }
  private checkpoint(r: Resident, w: World, kind?: string, data?: unknown) {
    this.store.saveWorld(w, Date.now() / 1000, () => {
      if (kind) this.memory.append(r.config.id, w.time, kind, data);
      this.capture(w);
      this.memory.save(r.config.id, r.state);
    });
  }
  private failure(r: Resident, w: World, message: string, attempted = r.state.plan[r.state.index]) {
    failStep((r.state.recovery ??= {}), w.time, attempted, message);
    const previous = r.state.lastOutcome;
    r.state.lastOutcome = {
      time: w.time,
      ok: false,
      message,
      attempted,
      repeats:
        previous &&
        !previous.ok &&
        previous.message === message &&
        JSON.stringify(previous.attempted) === JSON.stringify(attempted)
          ? previous.repeats + 1
          : 1,
    };
    r.nav = undefined;
    r.state.plan = [];
    r.state.index = 0;
    r.state.waitUntil = 0;
    r.wake = true;
    r.state.needsDecision = true;
    r.state.status = message;
    this.checkpoint(r, w, 'failure', r.state.lastOutcome);
  }
  private perform(r: Resident, w: World, a: Action, advanceStep: boolean) {
    const before = structuredClone(w),
      stateBefore = structuredClone(r.state);
    try {
      const p = w.players[r.state.playerId],
        stats = this.actionStats(w, p, a);
      const result = act(w, p.id, a);
      if (advanceStep) {
        // Engine toggles, outside when already outside, and work refreshes are
        // not evidence that a failed journey or production goal has succeeded.
        if (
          stats.cash !== p.cash ||
          JSON.stringify(stats.inventory) !== JSON.stringify(p.inventory) ||
          stats.job !== (p.job ?? null) ||
          JSON.stringify(stats.learning) !== JSON.stringify(p.learning ?? null) ||
          JSON.stringify(stats.task) !== JSON.stringify(p.task ?? null)
        )
          madeProgress((r.state.recovery ??= {}));
        r.state.index++;
        r.state.lastOutcome = {
          time: w.time,
          ok: true,
          message: result,
          attempted: { kind: 'act', action: a } as Step,
          repeats: 1,
        };
      }
      if (p.task) r.state.observedTask = JSON.stringify(p.task);
      this.checkpoint(r, w, 'action', {
        action: a,
        result,
        before: stats,
        after: this.actionStats(w, p, a),
      });
    } catch (e) {
      this.worlds.set(w.id, before);
      r.state = stateBefore;
      this.failure(r, before, (e as Error).message.slice(0, 250), {
        kind: 'act',
        action: a,
      } as Step);
      return false;
    }
    // A script hook cannot roll back an already committed action.
    if (a.type === 'task') this.onTask?.(w, r.state.playerId);
    return true;
  }
  private actionStats(w: World, p: Player, a: Action) {
    const b = w.buildings.find((b) => b.id === a.building);
    return {
      cash: p.cash,
      inventory: { ...p.inventory },
      health: p.health,
      job: p.job ?? null,
      activeUntil: p.activeUntil,
      skills: [...p.skills],
      learning: p.learning ? { ...p.learning } : null,
      task: p.task ? { ...p.task } : null,
      building: b
        ? {
            id: b.id,
            stock: { ...b.stock },
            investment: b.investment,
            employedHere: b.employees.includes(p.id),
          }
        : undefined,
    };
  }
  tick(dt: number, now = Date.now()) {
    if (this.closed) return;
    for (const r of this.residents) {
      const w = this.worlds.get(r.state.world),
        p = w?.players[r.state.playerId];
      if (!w || !p || !p.online) continue;
      if (r.nav) {
        const result = r.nav.step(w, p, dt);
        move(w, p, result.input, dt);
        if (result.error) this.failure(r, w, result.error);
        else if (result.arrived) {
          r.nav = undefined;
          if (r.navOrigin && distance(r.navOrigin, p) >= 4) madeProgress((r.state.recovery ??= {}));
          r.navOrigin = undefined;
          r.state.index++;
          this.checkpoint(r, w, 'arrival', { x: p.x, z: p.z });
        }
      } else move(w, p, { throttle: 0, steer: 0, boost: false }, dt);
    }
    if (now < this.pollAt) return;
    this.pollAt = now + 500;
    // Oldest request first prevents a chatty NPC from monopolising the shared queue.
    for (const r of [...this.residents].sort((a, b) => a.lastCall - b.lastCall)) {
      const w = this.worlds.get(r.state.world),
        p = w?.players[r.state.playerId];
      if (!w || !p) continue;
      if (r.active && !p.online) {
        this.memory.pause(r.config.id, true);
        r.active = false;
        r.busy?.abort();
        r.nav = undefined;
        r.wake = true;
        r.state.needsDecision = true;
        this.checkpoint(r, w, 'session', { event: 'Removed from play; operator resume required' });
      }
      if ((w.messageSeq ?? 0) > (this.memory.load(r.config.id)?.cursor ?? r.state.cursor))
        this.checkpoint(r, w);
      const paused = this.memory.paused(r.config.id),
        occupied = r.config.activeAlone || Object.values(w.players).some((q) => q.online && !q.npc);
      if (paused || !occupied) {
        r.active = false;
        if (p.online) {
          p.online = false;
          p.speed = 0;
          r.nav = undefined;
          if (r.busy) {
            r.busy.abort();
            r.wake = true;
            r.state.needsDecision = true;
          }
          this.checkpoint(r, w, 'session', {
            event: paused ? 'Paused by operator' : 'Sleeping while parish is empty',
          });
        }
        r.state.status = paused ? 'Paused by operator' : 'Sleeping while parish is empty';
        continue;
      }
      if (now < r.cooldown) continue;
      p.online = true;
      r.active = true;
      if (r.state.observedTask && !p.task) {
        delete r.state.observedTask;
        this.checkpoint(r, w, 'task-complete', {
          cash: p.cash,
          inventory: p.inventory,
          skills: p.skills,
        });
      }
      if (r.state.observedDeaths !== undefined && p.deaths !== r.state.observedDeaths)
        this.failure(r, w, 'Life ended; review what went wrong');
      r.state.observedDeaths = p.deaths;
      const critical = p.hunger >= 40000 || p.thirst >= 40000 || p.health < 30000;
      if (critical && !r.state.critical) {
        r.wake = true;
        r.state.needsDecision = true;
        r.nav = undefined;
        if (r.state.recovery) r.state.recovery.retryAt = 0;
        this.checkpoint(r, w, 'needs', { hunger: p.hunger, thirst: p.thirst, health: p.health });
      }
      r.state.critical = critical;
      if (r.busy || w.time < (r.state.recovery?.retryAt ?? 0)) continue;
      if (r.wake || (now >= r.state.nextAt && (!r.state.plan.length || now >= r.state.until))) {
        if (now - r.lastCall < r.config.intervalMs) continue;
        if (this.residents.filter((q) => q.busy).length >= this.budget.config.concurrency) continue;
        this.think(r, w, p, now);
        continue;
      }
      if (r.nav || p.task || now < r.state.waitUntil) continue;
      this.runStep(r, w, p, now);
    }
  }
  private runStep(r: Resident, w: World, p: Player, now: number) {
    if (!r.state.plan.length) return;
    if (r.state.index >= r.state.plan.length) {
      if (--r.state.repeats > 0 && now < r.state.until) r.state.index = 0;
      else {
        r.state.plan = [];
        r.state.status = 'Waiting to reconsider';
        this.checkpoint(r, w, 'plan-complete', { cash: p.cash, bank: p.bank });
        return;
      }
    }
    const step = r.state.plan[r.state.index];
    const blocked = blockedStep(r.state.recovery, step, w.time);
    if (blocked) {
      this.failure(
        r,
        w,
        `Recently failed step is resting until world time ${Math.ceil(blocked.until)}: ${blocked.message}`,
        step,
      );
      return;
    }
    r.state.status = r.state.intent;
    try {
      if (step.kind === 'wait') {
        r.state.index++;
        r.state.waitUntil = now + step.seconds * 1000;
        this.checkpoint(r, w);
      } else if (step.kind === 'act') this.perform(r, w, step.action, true);
      else if (step.kind === 'guide') {
        r.state.guideQuery = step.query;
        r.state.plan = [];
        r.wake = true;
        r.state.needsDecision = true;
        this.checkpoint(r, w, 'guide-lookup', { query: step.query });
      } else if (step.kind === 'recall') {
        r.state.recall = this.memory.search(r.config.id, step.query, step.before);
        r.state.plan = [];
        r.wake = true;
        r.state.needsDecision = true;
        this.checkpoint(r, w, 'recall', {
          query: step.query,
          before: step.before,
          matches: r.state.recall.map((e) => e.id),
        });
      } else {
        let target: { x: number; z: number } | undefined,
          radius = 3;
        if (step.kind === 'move') target = step;
        else {
          target = w.buildings.find((b) => b.id === step.destination);
          radius = 12;
          if (!target) {
            target = resourceNodes.find((n) => n.id === step.destination);
            radius = 6;
          }
        }
        if (!target) throw Error('Destination does not exist');
        const position = { x: target.x, z: target.z };
        r.nav = new Navigator(w, p, position, radius);
        r.navOrigin = { x: p.x, z: p.z };
        this.checkpoint(r, w, 'journey', {
          target: position,
          mode: p.vehicle === 5 ? 'walking' : 'driving',
        });
      }
    } catch (e) {
      this.failure(r, w, (e as Error).message.slice(0, 250));
    }
  }
  private think(r: Resident, w: World, p: Player, now: number) {
    const request = structuredClone({
      instructions: instructions + '\nYour personality: ' + r.state.personality,
      observation: {
        ...observe(w, p, r.state, this.memory, r.config.id),
        ...(r.config.provider === 'jev'
          ? { farmerChoices: farmerChoices(w, p, r.state), farming: farmerSituation(w, p) }
          : {}),
      },
    });
    const { gameGuide: _guide, ...decisionObservation } = request.observation;
    const decisionRequest =
      r.config.provider === 'jev'
        ? {
            instructions: jevInstructions + '\nYour personality: ' + r.state.personality,
            observation: decisionObservation,
          }
        : request;
    const bytes =
      Buffer.byteLength(JSON.stringify(decisionRequest)) +
      Buffer.byteLength(JSON.stringify(turnTool));
    if (bytes > 96000) {
      p.online = false;
      p.speed = 0;
      r.active = false;
      this.failure(r, w, 'Observation too large; reduce custom world content');
      r.cooldown = now + 60000;
      return;
    }
    const reservation = this.budget.reserve(r.config.id, bytes, outputLimit, now, r.rates);
    if (reservation === undefined) {
      p.online = false;
      r.active = false;
      p.speed = 0;
      r.nav = undefined;
      r.cooldown = now + 60000;
      r.state.status = 'Resting: shared AI budget limit';
      this.checkpoint(r, w);
      return;
    }
    r.lastCall = now;
    r.wake = false;
    r.state.needsDecision = false;
    r.state.pending = true;
    const replyTo = r.state.replyTo;
    this.checkpoint(r, w);
    r.nav = undefined;
    r.state.status = 'Thinking';
    const controller = new AbortController();
    r.busy = controller;
    r.pending = r.brain
      .decide(decisionRequest, controller.signal)
      .then(async (result) => {
        if (this.closed) return;
        this.budget.settle(
          reservation,
          result.inputTokens,
          result.outputTokens,
          result.cacheWriteTokens,
          result.cacheReadTokens,
        );
        const current = this.worlds.get(r.state.world),
          player = current?.players[r.state.playerId];
        if (
          controller.signal.aborted ||
          this.memory.paused(r.config.id) ||
          !current ||
          !player?.online
        )
          return;
        // Dialogue is a separately metered call, only for an addressed human.
        // It cannot replace the action provider's choice or replay a whole plan.
        if (r.dialogue && request.observation.currentConversation) {
          const { farmerChoices: _choices, ...conversationObservation } = request.observation;
          const dialogueRequest = {
            instructions:
              request.instructions +
              '\nCONVERSATION ONLY: Jev has already chosen your actions. Reply to the current human question using the game guide and observed results. chosenPlan is a future intention, NOT completed work. Update your notebook with useful relationships/lessons. Return a harmless wait plan; your plan, intent and timing are ignored. Do not promise a different action. Never start a reply with a chat command.',
            observation: { ...conversationObservation, chosenPlan: result.decision.plan },
          };
          const chatBytes =
            Buffer.byteLength(JSON.stringify(dialogueRequest)) +
            Buffer.byteLength(JSON.stringify(turnTool));
          const chatReservation =
            chatBytes <= 96000
              ? this.budget.reserve(
                  r.config.id,
                  chatBytes,
                  outputLimit,
                  Date.now(),
                  r.dialogue.rates,
                )
              : undefined;
          if (chatReservation !== undefined) {
            try {
              const chat = await r.dialogue.brain.decide(dialogueRequest, controller.signal);
              if (this.closed) return;
              this.budget.settle(
                chatReservation,
                chat.inputTokens,
                chat.outputTokens,
                chat.cacheWriteTokens,
                chat.cacheReadTokens,
              );
              const d = decisionSchema.parse(chat.decision);
              if (d.speech?.text.trim().startsWith('*')) throw Error('Invalid conversation');
              result = {
                ...result,
                decision: { ...result.decision, speech: d.speech, notebook: d.notebook },
              };
            } catch {
              if (this.closed) return;
              this.budget.failed(chatReservation);
              this.checkpoint(r, this.worlds.get(r.state.world) ?? current, 'dialogue-error', {
                message: 'Conversation unavailable; the selected gameplay plan is preserved.',
              });
            }
          } else
            this.checkpoint(r, this.worlds.get(r.state.world) ?? current, 'dialogue-budget', {
              message: 'Conversation deferred by shared budget or context limit.',
            });
        }
        // Another action may have rolled back/replaced the world during dialogue.
        const latest = this.worlds.get(r.state.world);
        if (
          controller.signal.aborted ||
          this.closed ||
          this.memory.paused(r.config.id) ||
          !latest?.players[r.state.playerId]?.online
        )
          return;
        this.accept(r, latest, result, Date.now(), replyTo);
      })
      .catch((e) => {
        if (this.closed) return;
        this.budget.failed(reservation);
        r.state.pending = false;
        r.wake = true;
        r.state.needsDecision = true;
        r.active = false;
        r.state.errors++;
        r.state.status = 'AI unavailable; resting before retry';
        r.cooldown = Date.now() + Math.min(300000, 15000 * 2 ** Math.min(r.state.errors, 4));
        const current = this.worlds.get(r.state.world);
        if (current) {
          const player = current.players[r.state.playerId];
          if (player) {
            player.online = false;
            player.speed = 0;
          }
          this.checkpoint(r, current, 'provider-error', {
            message:
              e instanceof Error &&
              /^AI (provider HTTP [0-9]+|response incomplete|response did not contain one valid turn|response missing token accounting)$/.test(
                e.message,
              )
                ? e.message
                : 'AI request failed or timed out',
          });
        }
      })
      .finally(() => {
        r.busy = undefined;
        r.pending = undefined;
      });
  }
  private accept(r: Resident, w: World, result: BrainResult, now: number, replyTo?: string) {
    const d = decisionSchema.parse(result.decision);
    if (d.speech?.text.trim().startsWith('*')) throw Error('NPC speech cannot run chat commands');
    r.state.pending = false;
    const addressed = !!r.state.helpQuestion;
    const rejected = d.plan.find((s) => blockedStep(r.state.recovery, s, w.time));
    if (rejected) {
      this.failure(
        r,
        w,
        'Plan repeats a recently failed step; choose another approach or wait for its retry time',
        rejected,
      );
      // Preserve addressed questions for a corrected answer; do not broadcast
      // the rejected plan's promise or silently change the model's strategy.
      return;
    }
    if (d.speech && r.state.replyTo === replyTo) delete r.state.replyTo;
    r.state.notebook = d.notebook;
    r.state.intent = d.intent;
    r.state.plan = d.plan;
    r.state.index = 0;
    r.state.repeats = d.repeat;
    r.state.until = now + d.reconsiderSeconds * 1000;
    r.state.nextAt = r.state.until;
    r.state.waitUntil = 0;
    r.state.errors = 0;
    r.state.recall = undefined;
    r.state.guideQuery = undefined;
    if (d.speech && !r.wake) r.state.helpQuestion = undefined;
    r.state.status = d.intent;
    this.checkpoint(r, w, 'decision', {
      intent: d.intent,
      plan: d.plan,
      repeat: d.repeat,
      reconsiderSeconds: d.reconsiderSeconds,
    });
    const recipient = replyTo || d.speech?.to || undefined;
    if (
      d.speech &&
      allowSpeech((r.state.recovery ??= {}), d.speech.text, recipient, w.time, addressed)
    ) {
      const a: Action = {
        type: 'chat',
        text: d.speech.text,
        ...(recipient ? { to: recipient } : {}),
      };
      this.perform(r, w, a, false);
    }
  }
  status() {
    return this.residents.map((r) => ({
      id: r.config.id,
      playerId: r.state.playerId,
      name: r.state.name,
      personality: r.state.personality,
      world: r.state.world,
      online: !!this.worlds.get(r.state.world)?.players[r.state.playerId]?.online,
      status: r.busy
        ? 'Thinking'
        : this.memory.paused(r.config.id)
          ? 'Paused by operator'
          : this.worlds.get(r.state.world)?.players[r.state.playerId]?.online
            ? 'Active'
            : 'Resting',
      model: r.config.model,
      provider: r.config.provider,
    }));
  }
  async settled() {
    await Promise.all(this.residents.map((r) => r.pending));
  }
  close() {
    this.closed = true;
    for (const r of this.residents) {
      r.busy?.abort();
      const w = this.worlds.get(r.state.world);
      if (w) {
        const p = w.players[r.state.playerId];
        if (p) {
          p.online = false;
          p.speed = 0;
        }
        this.checkpoint(r, w, 'session', { event: 'Server stopped' });
      }
    }
  }
}
