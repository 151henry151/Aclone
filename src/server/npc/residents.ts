// SPDX-License-Identifier: GPL-3.0-or-later
import { workplace } from './workplace.ts';
import { economicMenu } from './enterprise.ts';
import { carePlan } from './care.ts';
import type { World, Player, Action } from '../../shared/types.ts';
import { act, addPlayer, move, say } from '../../shared/simulation.ts';
import { resourceNodes } from '../../shared/resources.ts';
import type { Store } from '../store.ts';
import type { Universe, Account } from '../universe.ts';
import { spaceChoices, spaceOperations, spaceAction, exchange, systemFor } from './space.ts';
import { operation } from './player-operations.ts';
import { leaveCombat } from '../../shared/combat.ts';
import { NpcMemory, type ResidentState } from './memory.ts';
import { NpcBudget, budgetSchema, type TokenRates, type BudgetConfig } from './budget.ts';
import { decisionSchema, type Brain, type BrainResult, type Step } from './decision.ts';
import type { NpcConfig } from './config.ts';
import { failStep, blockedStep, madeProgress, allowSpeech } from './recovery.ts';
import { distance } from '../../shared/simulation.ts';
import { Navigator } from './navigation.ts';
import { instructions, conversationInstructions, observe } from './observation.ts';
import { careNeeded } from './strategy.ts';
import { characterRevision } from './character-facts.ts';
import { jevInstructions } from './jev.ts';
import { farmerSituation } from './farmer.ts';
import { adaptiveChoices, parishSurvey } from './adaptive.ts';
import { conversationTool, conversationOutputLimit, unqueuedPromise } from './conversation.ts';
import { operationAction } from './player-operations.ts';
import { initialPresence, beginVisit } from './habits.ts';
import { preferChoices } from './preferences.ts';
import {
  conversationView,
  decisionAgenda,
  learnedChoices,
  rememberConversation,
} from './agenda.ts';
import {
  commitmentChoices,
  employmentBlocker,
  refreshEmployment,
  focusCommitments,
  deliveryBlocker,
  recordCommitment,
  checkCommitmentPrice,
  recordDelivery,
} from './commitments.ts';
import { homecomingPlan, offlineReadiness, returnDelay } from './homecoming.ts';
import { outputLimit, turnTool } from './turn-tool.ts';
export interface ResidentOptions {
  config: NpcConfig;
  brain: Brain;
  rates?: TokenRates;
  dialogue?: { brain: Brain; rates: TokenRates; provider?: 'openai' | 'anthropic' };
}
interface Resident extends ResidentOptions {
  state: ResidentState;
  nav?: Navigator;
  navOrigin?: { x: number; z: number };
  busy?: AbortController;
  chatBusy?: boolean;
  pending?: Promise<void>;
  wake: boolean;
  lastCall: number;
  cooldown: number;
  active: boolean;
  caring?: boolean;
  careCheckAt?: number;
  shiftCheckAt?: number;
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
        w = worlds.get(this.memory.load(c.id)?.world ?? c.world);
      if (!w || worlds.get(c.world)?.template !== 'economy')
        throw Error('NPC world must be an existing economy parish');
      w.messageSeq = Math.max(w.messageSeq ?? 0, ...w.messages.map((m) => m.id ?? 0));
      // Old saves lack sequence IDs; migrate the entire retained ring in order.
      if (w.messages.some((m) => !m.id))
        for (const message of w.messages) message.id = ++w.messageSeq;
      let state = this.memory.load(c.id);
      if (state && (state.originWorld ?? state.world) !== c.world)
        throw Error('An existing NPC cannot be moved to another world by configuration');
      if (!state)
        this.store.transaction(() => {
          const { account } = this.universe.register(c.name);
          account.npc = true;
          account.system = systemFor(w.id);
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
      if (c.presence === 'scheduled') {
        if (!state.presence) {
          state.presence = initialPresence(c.id, c.habit, c.timeZone, Date.now());
          // Existing pilots get a full visit to prepare, rather than being
          // suddenly signed off with empty stores during this migration.
          if (w.players[state.playerId]) state.presence.nextAt = Date.now();
        }
      } else delete state.presence;
      state.originWorld ??= c.world;
      if (c.provider === 'jev' && state.behaviorVersion !== 2) state.needsDecision = true;
      state.behaviorVersion = 2;
      if (state.decisionProvider !== c.provider) state.needsDecision = true;
      state.decisionProvider = c.provider;
      if (state.personality !== c.personality) {
        this.memory.append(c.id, w.time, 'personality', {
          previous: state.personality,
          current: c.personality,
        });
        state.personality = c.personality;
      }
      // Register identity now, but create a new pilot only on their first visit.
      // Unborn characters must not starve while waiting to start playing.
      const p =
        !w.players[state.playerId] &&
        state.presence?.phase === 'offline' &&
        state.presence.sessions === 0
          ? undefined
          : addPlayer(w, state.playerId, state.name);
      if (p) {
        p.npc = true;
        p.authority = 0;
        p.online = false;
        p.speed = 0;
      }
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
    const residents = this.residents.filter((r) => r.state.world === w.id && !r.state.inSpace);
    const now = Date.now();
    const changed = new Set<Resident>();
    for (const r of residents) {
      r.state.cursor = this.memory.load(r.config.id)?.cursor ?? r.state.cursor;
      const previous = r.state.publicConversations ?? [];
      r.state.publicConversations = previous.filter((c) => c.world === w.id && c.expiresAt > now);
      if (previous.length !== r.state.publicConversations.length) changed.add(r);
    }
    // Route once per message, before updating any resident's state. Iterating
    // residents first makes a switch of addressee depend on resident order.
    for (const m of w.messages) {
      if (!m.id) continue;
      const unread = residents.filter((r) => m.id! > r.state.cursor);
      if (!unread.length) continue;
      const sender = Object.values(w.players).find((p) => p.name === m.name);
      const humanChat = m.kind === 'chat' && sender && !sender.npc;
      const words: string[] = m.text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
      const named = residents.filter((r) =>
        words.includes(r.state.name.toLowerCase().split(' ')[0]),
      );
      const namesHuman = Object.values(w.players).some(
        (p) => !p.npc && p.id !== sender?.id && words.includes(p.name.toLowerCase().split(' ')[0]),
      );
      const listeners =
        humanChat && !m.to && !named.length && !namesHuman
          ? residents.filter((r) =>
              r.state.publicConversations?.some(
                (c) => c.speakerId === sender.id && c.messageId < m.id!,
              ),
            )
          : [];
      const targets = m.to
        ? residents.filter((r) => r.state.playerId === m.to)
        : named.length
          ? named
          : listeners.length === 1
            ? listeners
            : [];
      for (const r of unread) {
        changed.add(r);
        r.state.cursor = m.id;
        if (humanChat) {
          // A DM or a different named resident ends this player's public thread.
          // Never overwrite a newer thread when catching up an older cursor.
          const newer = r.state.publicConversations!.some(
            (c) => c.speakerId === sender.id && c.messageId >= m.id!,
          );
          if (!newer) {
            r.state.publicConversations = r.state.publicConversations!.filter(
              (c) => c.speakerId !== sender.id,
            );
            if (
              !m.to &&
              targets.length === 1 &&
              targets[0] === r &&
              r.state.presence?.phase !== 'offline'
            ) {
              r.state.publicConversations.push({
                speakerId: sender.id,
                world: w.id,
                messageId: m.id,
                expiresAt: now + 120000,
              });
              // Bounded state even in a busy parish; oldest threads expire first.
              r.state.publicConversations = r.state.publicConversations.slice(-64);
            }
          }
        }
        if (m.to && m.to !== r.state.playerId && m.name !== r.state.name) continue;
        this.memory.append(r.config.id, w.time, 'chat', { ...m, sender: sender?.id });
        if (humanChat && targets.includes(r) && r.state.presence?.phase !== 'offline') {
          r.wake = true;
          r.state.needsDecision = true;
          r.state.helpQuestion = m.text;
          r.state.conversationId = m.id;
          r.state.questionFrom = sender.id;
          // Chat can interrupt recovery without restarting a failed action loop.
          if (r.state.recovery) r.state.recovery.retryAt = 0;
          r.state.replyTo = m.to === r.state.playerId ? sender.id : undefined;
        }
      }
    }
    for (const r of changed) this.memory.save(r.config.id, r.state);
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
  private perform(r: Resident, w: World, a: Action, advanceStep: boolean, attemptedStep?: Step) {
    const before = structuredClone(w),
      stateBefore = structuredClone(r.state);
    try {
      const p = w.players[r.state.playerId],
        stats = this.actionStats(w, p, a);
      checkCommitmentPrice(w, r.state, a);
      const result = act(w, p.id, a);
      const pendingReply = r.state.pendingAgreementReply;
      if (
        a.type === 'chat' &&
        pendingReply?.world === w.id &&
        pendingReply.text === a.text &&
        pendingReply.to === a.to
      ) {
        delete r.state.pendingAgreementReply;
        if (r.state.conversationId === pendingReply.conversationId) {
          r.state.helpQuestion = undefined;
          r.state.replyTo = undefined;
        }
      }
      refreshEmployment(w, p, r.state);
      if (recordDelivery(r.state, w.id, a)) {
        r.wake = true;
        r.state.needsDecision = true;
      }
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
          attempted: attemptedStep ?? ({ kind: 'act', action: a } as Step),
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
      this.failure(
        r,
        before,
        (e as Error).message.slice(0, 250),
        attemptedStep ?? ({ kind: 'act', action: a } as Step),
      );
      return false;
    }
    // A script hook cannot roll back an already committed action.
    if (a.type === 'task') this.onTask?.(w, r.state.playerId);
    return true;
  }
  private account(r: Resident): Account {
    const row = this.store.db
      .prepare('SELECT state FROM accounts WHERE id=?')
      .get(r.state.playerId);
    if (!row) throw Error('Resident account missing');
    return JSON.parse(String(row.state));
  }
  private choices(r: Resident, w: World, p: Player) {
    const a = this.account(r);
    if (r.state.inSpace) return spaceChoices(a, this.worlds, this.universe);
    const deliveries = commitmentChoices(w, p, r.state);
    // A failed human agreement merits one factual notice, not another model call
    // or recurring public activity narration. Legacy channels default to private.
    const blocked = r.state.commitments?.find(
      (c) =>
        c.world === w.id &&
        c.status === 'blocked' &&
        !c.blockedNoticeSent &&
        w.players[c.speakerId]?.online &&
        !p.task,
    );
    if (blocked && !p.muted && !w.settings.chatLocked) {
      act(w, p.id, {
        type: 'chat',
        text: blocked.delivery
          ? `My delivery is blocked: ${blocked.outcome} ${blocked.delivered}/${blocked.delivery.quantity} ${blocked.delivery.item} delivered.`
          : `My agreed task is blocked: ${blocked.outcome}`,
        ...(blocked.replyTo === null ? {} : { to: blocked.speakerId }),
      });
      blocked.blockedNoticeSent = true;
      this.checkpoint(r, w, 'delivery-blocked', { id: blocked.id, outcome: blocked.outcome });
    }
    const agreed = focusCommitments(w, p, r.state, deliveries);
    if (!p.task && !careNeeded(w, p) && agreed.length) return learnedChoices(r.state, agreed);
    const choices = [...deliveries, ...adaptiveChoices(w, p, r.state)];
    const port = w.buildings.find((b) => b.kind === 'starport' && !b.construction);
    if (port && !p.task && !p.atHome && !p.game) {
      const prep: Step[] =
        p.vehicle !== 5 && p.fuel <= 0
          ? [{ kind: 'act', action: { type: 'vehicle', slot: 5 } }]
          : p.vehicle !== 5 && !p.engine
            ? [{ kind: 'act', action: { type: 'engine' } }]
            : [];
      const visit: Step[] = [...prep, { kind: 'travel', destination: port.id }];
      choices.push({
        id: 'space_takeoff',
        description:
          'Visit the spaceport and take off to explore galactic work, surveying or trade. Local money, skills and jobs remain here; galactic credits are separate. Consider unfinished work first.',
        plan: [...visit, operation('takeoff')],
        reconsiderSeconds: 600,
      });
      const spent =
        a.exchanged[w.id]?.day === Math.floor(w.time / 86400) ? a.exchanged[w.id].amount : 0;
      const n = Math.min(
        10,
        w.settings.exchangeCap - spent,
        Math.floor(Math.max(0, p.cash - 20000) / (w.settings.exchangeRate * 100)),
      );
      if (n > 0)
        choices.push({
          id: 'space_exchange',
          description: `Convert ${n * w.settings.exchangeRate * 100} local cash to ${n} galactic credits at the port. One-way conversion, not profit.`,
          plan: [...visit, operation('exchange', { amount: n })],
          reconsiderSeconds: 600,
        });
    }
    return learnedChoices(
      r.state,
      economicMenu(
        w,
        p,
        preferChoices(focusCommitments(w, p, r.state, choices), r.config.preference, p.job),
        r.config.preference,
      ),
    );
  }
  private performSpace(r: Resident, w: World, step: Extract<Step, { kind: 'operation' }>) {
    const stateBefore = structuredClone(r.state),
      before = structuredClone(w);
    let destination: World | undefined, destinationBefore: World | undefined;
    try {
      this.store.transaction(() => {
        const a = this.account(r),
          previous = structuredClone(a),
          op = operationAction(step),
          p = w.players[a.id];
        if (op.type === 'exchange') {
          if (r.state.inSpace) throw Error('Land before exchanging local cash');
          exchange(w, p, a, Number(op.amount));
          this.universe.save(a);
        } else if (op.type === 'takeoff') {
          if (
            r.state.inSpace ||
            !w.buildings.some((b) => b.kind === 'starport' && distance(p, b) < 18)
          )
            throw Error('Drive to the spaceport to take off');
          leaveCombat(w, p);
          p.online = false;
          p.speed = 0;
          p.lastSeen = w.time;
          r.state.inSpace = true;
          say(w, 'Parish notice', p.name + ' has left for space.');
        } else if (op.type === 'land') {
          if (!r.state.inSpace || a.transit)
            throw Error('Wait until your jump arrives before landing');
          destination = this.worlds.get(String(op.world));
          if (
            !destination ||
            systemFor(destination.id) !== a.system ||
            (destination.settings.locked && destination.owner !== a.id)
          )
            throw Error('World unavailable in this system');
          destinationBefore = structuredClone(destination);
          const q = addPlayer(destination, a.id, a.name);
          q.npc = true;
          q.authority = 0;
          q.online = true;
          if (r.state.world !== destination.id) {
            delete r.state.evaluation;
            delete r.state.observedDeaths;
            delete r.state.observedTask;
          }
          r.state.world = destination.id;
          r.state.inSpace = false;
          r.state.cursor = destination.messageSeq ?? 0;
          say(destination, 'Parish notice', q.name + ' arrived.');
        } else {
          if (!r.state.inSpace) throw Error('Take off first');
          spaceAction(this.universe, a, op);
        }
        r.state.index++;
        r.state.lastOutcome = {
          time: w.time,
          ok: true,
          message: `Completed ${op.type}`,
          attempted: step,
          repeats: 1,
        };
        this.checkpoint(r, w, 'space-action', { action: op, before: previous, after: a });
        if (destination && destination !== w) this.checkpoint(r, destination);
      });
    } catch (e) {
      this.worlds.set(w.id, before);
      if (destinationBefore) this.worlds.set(destinationBefore.id, destinationBefore);
      r.state = stateBefore;
      this.failure(r, before, (e as Error).message, step);
    }
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
    // Addressed players get the next free slot; oldest call breaks ties. Running
    // requests are not aborted and every call still shares the hard spending cap.
    for (const r of [...this.residents].sort(
      (a, b) =>
        Number(this.dialogueDue(b, now)) - Number(this.dialogueDue(a, now)) ||
        a.lastCall - b.lastCall,
    )) {
      const w = this.worlds.get(r.state.world);
      if (!w) continue;
      let p = w.players[r.state.playerId];
      if (
        !p &&
        r.state.presence?.phase === 'offline' &&
        now >= r.state.presence.nextAt &&
        !this.memory.paused(r.config.id)
      ) {
        p = addPlayer(w, r.state.playerId, r.state.name);
        p.npc = true;
        p.authority = 0;
        p.online = false;
      }
      if (!p) continue;
      if (r.state.observedDeaths !== undefined && p.deaths !== r.state.observedDeaths) {
        // A previous-life plan or reply must not reappear after resurrection,
        // including replies already in flight when the death happened.
        r.busy?.abort();
        delete r.state.pendingAgreementReply;
        delete r.state.dialogueAttempt;
        delete r.state.observedTask;
        delete r.state.evaluation;
        delete r.state.recovery;
        r.state.plan = [];
        r.state.intent = 'Begin a new life; reassess my qualifications, work and supplies.';
        r.state.pending = false;
        r.state.observedDeaths = p.deaths;
        r.cooldown = 0;
        r.caring = false;
        this.failure(
          r,
          w,
          'My life ended. Recheck my current skills, job and supplies before continuing.',
        );
      }
      r.state.observedDeaths = p.deaths;
      if (r.active && !p.online && !r.state.inSpace) {
        this.memory.pause(r.config.id, true);
        r.active = false;
        r.busy?.abort();
        r.nav = undefined;
        r.wake = true;
        r.state.needsDecision = true;
        this.checkpoint(r, w, 'session', { event: 'Removed from play; operator resume required' });
      }
      if (
        !r.state.inSpace &&
        (w.messageSeq ?? 0) > (this.memory.load(r.config.id)?.cursor ?? r.state.cursor)
      )
        this.checkpoint(r, w);
      const paused = this.memory.paused(r.config.id),
        occupied =
          r.config.presence !== 'on-demand' ||
          r.config.activeAlone ||
          [...this.worlds.values()].some(
            (v) =>
              (v.id === w.id || v.id === r.state.originWorld) &&
              Object.values(v.players).some((q) => q.online && !q.npc),
          );
      if (paused || !occupied) {
        r.active = false;
        if (p.online || r.busy) {
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
      if (this.session(r, w, p, now)) continue;
      // A survival errand must not silence an online resident either. Only the
      // addressed conversation is requested; routine care keeps running locally.
      if (
        !r.busy &&
        this.dialogueDue(r, now) &&
        now - r.lastCall >= r.config.intervalMs &&
        this.residents.filter((q) => q.busy).length < this.budget.config.concurrency
      ) {
        p.online = !r.state.inSpace;
        r.active = p.online;
        this.think(r, w, p, now);
        continue;
      }
      // Eating, drinking and finishing an emergency errand never wait for API credits.
      if (!r.state.inSpace && (r.caring || careNeeded(w, p))) {
        if (r.caring && r.state.plan.length && r.state.index < r.state.plan.length) {
          if (!r.nav && !p.task && now >= r.state.waitUntil) this.runStep(r, w, p, now);
          continue;
        }
        if (r.caring) {
          r.caring = false;
          r.wake = true;
        }
        if (!p.task && now >= (r.careCheckAt ?? 0)) {
          r.careCheckAt = now + 10000;
          const plan = carePlan(w, p);
          if (plan.length && !plan.some((s) => blockedStep(r.state.recovery, s, w.time))) {
            r.busy?.abort();
            r.nav = undefined;
            r.state.plan = plan;
            r.state.index = 0;
            r.state.repeats = 1;
            r.state.waitUntil = 0;
            r.state.pending = false;
            r.wake = false;
            r.caring = true;
            p.online = true;
            r.active = true;
            this.checkpoint(r, w, 'self-care', { hunger: p.hunger, thirst: p.thirst });
            this.runStep(r, w, p, now);
            continue;
          }
        }
      }
      // Continuing a chosen, supplied job is routine; no paid call just to renew a shift.
      if (
        now < r.cooldown &&
        !r.busy &&
        !r.nav &&
        !p.task &&
        !r.state.inSpace &&
        !careNeeded(w, p) &&
        p.job &&
        now >= (r.shiftCheckAt ?? 0)
      ) {
        r.shiftCheckAt = now + 60000;
        const b = w.buildings.find((b) => b.id === p.job);
        const job = b && workplace(w, p, b);
        if (
          b &&
          job?.qualified &&
          job.employedHere &&
          !job.workActiveNextCycle &&
          Math.hypot(p.x - b.x, p.z - b.z) < 14 &&
          !job.ifYouWork.capitalShortfall &&
          !job.blockers.some((v) => !v.startsWith('No active employees'))
        )
          this.perform(r, w, { type: 'work', building: b.id }, false);
      }
      if (now < r.cooldown && !this.dialogueDue(r, now)) continue;
      p.online = !r.state.inSpace;
      r.active = true;
      const pendingReply = r.state.pendingAgreementReply;
      if (
        !r.busy &&
        pendingReply?.world === w.id &&
        !p.muted &&
        !w.settings.chatLocked &&
        !r.state.inSpace
      ) {
        this.perform(
          r,
          w,
          {
            type: 'chat',
            text: pendingReply.text,
            ...(pendingReply.to ? { to: pendingReply.to } : {}),
          },
          false,
        );
        continue;
      }
      if (r.state.inSpace) this.universe.arrive(this.account(r));
      if (r.state.observedTask && !p.task) {
        delete r.state.observedTask;
        this.checkpoint(r, w, 'task-complete', {
          cash: p.cash,
          inventory: p.inventory,
          skills: p.skills,
        });
      }
      const critical = careNeeded(w, p);
      if (critical && !r.state.critical) {
        r.wake = true;
        r.state.needsDecision = true;
        r.nav = undefined;
        if (r.state.recovery) r.state.recovery.retryAt = 0;
        this.checkpoint(r, w, 'needs', { hunger: p.hunger, thirst: p.thirst, health: p.health });
      }
      r.state.critical = critical;
      if (r.busy || (w.time < (r.state.recovery?.retryAt ?? 0) && !this.dialogueDue(r, now)))
        continue;
      if (
        r.wake ||
        this.dialogueDue(r, now) ||
        (now >= r.state.nextAt && (!r.state.plan.length || now >= r.state.until))
      ) {
        if (now - r.lastCall < r.config.intervalMs) continue;
        if (this.residents.filter((q) => q.busy).length >= this.budget.config.concurrency) continue;
        this.think(r, w, p, now);
        continue;
      }
      if (r.nav || p.task || now < r.state.waitUntil) continue;
      this.runStep(r, w, p, now);
    }
  }
  /** Wall-clock presence is independent of game days, model calls and human visitors. */
  private session(r: Resident, w: World, p: Player, now: number) {
    const s = r.state.presence;
    if (!s) return false;
    if (s.phase === 'offline') {
      if (now < s.nextAt) return true;
      beginVisit(s, r.config.id, r.config.habit, r.config.timeZone, now);
      r.state.plan = [];
      r.state.waitUntil = 0;
      r.nav = undefined;
      r.wake = true;
      r.state.needsDecision = true;
      r.state.status = s.reason!;
      this.checkpoint(r, w, 'session', { event: 'Scheduled arrival', ...s });
    }
    if (s.phase === 'playing' && now >= s.endsAt - 5 * 60000) {
      s.phase = 'preparing';
      r.caring = false;
      if (!r.chatBusy) r.busy?.abort();
      r.nav = undefined;
      r.state.plan = [];
      r.state.waitUntil = 0;
      r.state.pending = false;
      r.wake = false;
      r.state.needsDecision = false;
      this.checkpoint(r, w, 'session', {
        event: 'Preparing food, stores and shelter before logout',
      });
    }
    if (s.phase !== 'preparing') return false;
    const away = Math.max(600, (s.nextRegularAt - now) / 1000);
    const ready = offlineReadiness(w, p, away);
    // Leaving preparations still count as being online. Let addressed chat run,
    // including while travelling home, but never extend a visit indefinitely.
    const chatGrace = !!r.state.helpQuestion && now < s.preparationUntil + 60000;
    if (
      !chatGrace &&
      (now >= s.preparationUntil ||
        (now >= s.endsAt && ready.atHome && ready.stocked && ready.comfortable))
    ) {
      const seconds = returnDelay(w, p, away);
      s.phase = 'offline';
      s.nextAt = now + seconds * 1000;
      s.shortVisit = s.nextAt < s.nextRegularAt;
      s.reason = s.shortVisit
        ? 'Returning sooner for food, water or shelter'
        : 'At home until the next visit';
      r.active = false;
      r.busy?.abort();
      r.nav = undefined;
      r.wake = false;
      r.state.plan = [];
      r.state.needsDecision = false;
      r.state.pending = false;
      if (r.state.helpQuestion && r.state.questionFrom)
        say(
          w,
          'AI notice',
          `${r.state.name} had to log off before replying. Please try again on their next visit.`,
          'system',
          r.state.questionFrom,
        );
      r.state.helpQuestion = undefined;
      r.state.replyTo = undefined;
      r.state.publicConversations = [];
      r.state.status = s.reason;
      p.online = false;
      p.speed = 0;
      p.lastSeen = w.time;
      leaveCombat(w, p);
      this.checkpoint(r, w, 'session', { event: 'Scheduled departure', readiness: ready, ...s });
      return true;
    }
    p.online = !r.state.inSpace;
    r.active = true;
    if (
      !r.busy &&
      this.dialogueDue(r, now) &&
      now - r.lastCall >= r.config.intervalMs &&
      this.residents.filter((q) => q.busy).length < this.budget.config.concurrency
    ) {
      this.think(r, w, p, now);
      return true;
    }
    if (r.busy || r.nav || p.task || now < r.state.waitUntil) return true;
    if (r.state.inSpace) {
      const a = this.account(r);
      this.universe.arrive(a);
      const landing = spaceChoices(a, this.worlds, this.universe).find((c) =>
        c.plan.some((step) => step.kind === 'operation' && step.operation === 'land'),
      );
      if (!landing) return true;
      r.state.plan = landing.plan;
    } else if (!r.state.plan.length || r.state.index >= r.state.plan.length) {
      r.state.plan = homecomingPlan(w, p, away);
      // Never execute the remainder of an errand whose prerequisite failed.
      if (r.state.plan.some((step) => blockedStep(r.state.recovery, step, w.time)))
        r.state.plan = [];
      if (!r.state.plan.length) {
        r.state.waitUntil = now + 30000;
        return true;
      }
    } else {
      this.runStep(r, w, p, now);
      return true;
    }
    r.state.index = 0;
    r.state.repeats = 1;
    r.state.intent = 'Prepare supplies and return home before logging off';
    r.state.status = r.state.intent;
    this.checkpoint(r, w, 'homecoming', { plan: r.state.plan, readiness: ready });
    this.runStep(r, w, p, now);
    return true;
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
      } else if (step.kind === 'act') {
        if (r.state.inSpace) throw Error('Land before taking parish actions');
        this.perform(r, w, step.action, true);
      } else if (step.kind === 'operation') {
        if (spaceOperations.has(step.operation)) this.performSpace(r, w, step);
        else {
          if (r.state.inSpace) throw Error('Land before taking parish actions');
          this.perform(r, w, operationAction(step), true, step);
        }
      } else if (step.kind === 'fish') {
        if (p.game !== 'fishing' || (p.fishUntil ?? Infinity) < w.time) {
          this.perform(r, w, { type: 'joinGame', game: 'fishing' }, false, step);
        } else if (p.fishAt !== undefined && w.time >= p.fishAt && w.time <= (p.fishUntil ?? 0)) {
          if (this.perform(r, w, { type: 'reel' }, false, step)) {
            r.state.fishCaught = (r.state.fishCaught ?? 0) + 1;
            if (r.state.fishCaught >= step.catches) {
              r.state.index++;
              delete r.state.fishCaught;
            }
            this.checkpoint(r, w, 'fishing-progress', {
              caught: r.state.fishCaught ?? step.catches,
            });
          }
        }
      } else if (step.kind === 'guide') {
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
        if (r.state.inSpace) throw Error('Land before driving');
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
  private dialogueDue(r: Resident, now: number) {
    if (!r.dialogue || !r.state.helpQuestion) return false;
    const key = `${r.state.world}:${r.state.conversationId ?? `${r.state.questionFrom}:${r.state.helpQuestion}`}`;
    const attempt = r.state.dialogueAttempt;
    return (
      !attempt ||
      attempt.key !== key ||
      (!attempt.done && attempt.attempts < 3 && now >= attempt.nextAt)
    );
  }
  private think(r: Resident, w: World, p: Player, now: number) {
    const revision = characterRevision(p);
    const discardStaleReply = (world: World) => {
      const player = world.players[r.state.playerId];
      if (player && characterRevision(player) === revision) return false;
      delete r.state.dialogueAttempt;
      delete r.state.pendingAgreementReply;
      r.state.pending = false;
      r.state.plan = [];
      r.state.waitUntil = 0;
      r.nav = undefined;
      r.wake = true;
      r.state.needsDecision = true;
      this.checkpoint(r, world, 'stale-decision', {
        reason:
          'Character qualifications, life or employment changed while thinking; recheck current facts.',
      });
      return true;
    };
    const chatOnly = this.dialogueDue(r, now);
    const snapshot = {
      time: w.time,
      cash: p.cash,
      bank: p.bank,
      health: p.health,
      inventory: { ...p.inventory },
      job: p.job ?? null,
    };
    const prior = r.state.evaluation;
    if (prior && !chatOnly) {
      const result = {
        goal: r.state.intent,
        elapsedSeconds: Math.max(0, w.time - prior.time),
        cashChange: p.cash - prior.cash,
        bankChange: p.bank - prior.bank,
        healthChange: p.health - prior.health,
        previousJob: prior.job,
        currentJob: p.job ?? null,
      };
      r.state.experiences = [...(r.state.experiences ?? []), result].slice(-8);
      this.memory.append(r.config.id, w.time, 'evaluation', result);
    }
    if (!chatOnly) r.state.evaluation = snapshot;
    const request = structuredClone({
      instructions: instructions + '\nYour personality: ' + r.state.personality,
      observation: {
        ...observe(w, p, r.state, this.memory, r.config.id),
        agenda: decisionAgenda(r.state),
        experiences: r.state.experiences,
        lessons: r.state.experiences?.slice(-3).map((e) => ({ ...e, goal: e.goal.slice(0, 180) })),
        careerPreference: r.config.preference,
        commitments: r.state.commitments,
        session: r.state.presence
          ? {
              phase: r.state.presence.phase,
              minutesRemaining: Math.max(0, (r.state.presence.endsAt - now) / 60000),
              readiness: offlineReadiness(
                w,
                p,
                Math.max(600, (r.state.presence.nextRegularAt - now) / 1000),
              ),
            }
          : undefined,
        ...(!chatOnly && r.config.provider === 'jev'
          ? {
              choices: this.choices(r, w, p),
              space: { inSpace: !!r.state.inSpace, account: this.account(r) },
              parishSurvey: parishSurvey(w, p),
              farming: farmerSituation(w, p),
              vocation: r.config.vocation,
              enduringGoal: r.config.initialGoal,
            }
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
      (r.config.provider === 'jev' ? 0 : Buffer.byteLength(JSON.stringify(turnTool)));
    if (!chatOnly && bytes > 96000) {
      // Model availability is not a logout. Preserve visible presence and back off.
      p.online = !r.state.inSpace;
      p.speed = 0;
      r.active = p.online;
      this.failure(r, w, 'Observation too large; reduce custom world content');
      r.cooldown = now + 60000;
      return;
    }
    const choices = 'choices' in request.observation ? request.observation.choices : undefined;
    const localChoice =
      !chatOnly &&
      r.config.provider === 'jev' &&
      choices?.length === 1 &&
      choices[0].id.startsWith('commitment_')
        ? choices[0]
        : undefined;
    const reservation =
      chatOnly || localChoice
        ? undefined
        : this.budget.reserve(r.config.id, bytes, outputLimit, now, r.rates);
    if (!chatOnly && !localChoice && reservation === undefined) {
      p.online = !r.state.inSpace;
      r.active = p.online;
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
    if (!chatOnly) r.nav = undefined;
    r.state.status = chatOnly ? 'Replying' : 'Thinking';
    const controller = new AbortController();
    r.busy = controller;
    r.chatBusy = chatOnly;
    const pending: Promise<BrainResult> = chatOnly
      ? Promise.resolve({
          decision: {
            intent: r.state.intent,
            notebook: r.state.notebook,
            speech: null,
            plan: r.state.plan.slice(r.state.index).length
              ? r.state.plan.slice(r.state.index)
              : [{ kind: 'wait', seconds: 60 }],
            repeat: 1,
            reconsiderSeconds: 60,
          },
          inputTokens: 0,
          outputTokens: 0,
        })
      : localChoice
        ? Promise.resolve({
            decision: {
              intent: localChoice.description.slice(0, 300),
              notebook: r.state.notebook,
              speech: null,
              plan: localChoice.plan,
              repeat: 1,
              reconsiderSeconds: localChoice.reconsiderSeconds ?? 600,
            },
            inputTokens: 0,
            outputTokens: 0,
          })
        : r.brain.decide(decisionRequest, controller.signal);
    r.pending = pending
      .then(async (result) => {
        if (this.closed) return;
        if (reservation !== undefined)
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
          !player ||
          (!player.online && !r.state.inSpace)
        )
          return;
        // Dialogue is a separately metered call, only for an addressed human.
        // It cannot replace the action provider's choice or replay a whole plan.
        let conversationCompleted = false;
        const conversation = request.observation.currentConversation;
        const conversationKey = conversation
          ? `${r.state.world}:${conversation.id ?? `${conversation.speakerId}:${conversation.question}`}`
          : undefined;
        const attempt =
          r.state.dialogueAttempt?.key === conversationKey ? r.state.dialogueAttempt : undefined;
        if (
          r.dialogue &&
          conversation &&
          (!attempt || (!attempt.done && attempt.attempts < 3 && Date.now() >= attempt.nextAt))
        ) {
          const conversationObservation = conversationView(
            request.observation,
            r.state,
            conversation.speakerId ?? '',
            !!replyTo,
          );
          const dialogueRequest = {
            instructions: conversationInstructions + '\nYour personality: ' + r.state.personality,
            observation: conversationObservation,
          };
          const chatBytes =
            Buffer.byteLength(JSON.stringify(dialogueRequest)) +
            Buffer.byteLength(JSON.stringify(conversationTool));
          const chatReservation =
            chatBytes <= 96000
              ? this.budget.reserve(
                  r.config.id,
                  chatBytes,
                  conversationOutputLimit,
                  Date.now(),
                  r.dialogue.rates,
                )
              : undefined;
          if (chatReservation !== undefined) {
            const count = (attempt?.attempts ?? 0) + 1;
            r.state.dialogueAttempt = {
              key: conversationKey!,
              attempts: count,
              nextAt: Date.now() + (count === 1 ? 60000 : 300000),
              done: false,
            };
            this.checkpoint(r, this.worlds.get(r.state.world) ?? current);
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
              r.state.dialogueAttempt.done = true;
              conversationCompleted = true;
              // Even a deliberate silent reply is a completed conversation, not a reason to poll chat again.
              if (!d.speech && r.state.conversationId === conversation.id) {
                r.state.helpQuestion = undefined;
                r.state.replyTo = undefined;
              }
              result = {
                ...result,
                gameplayRequest: chat.gameplayRequest,
                preferences: chat.preferences,
                decision: { ...result.decision, speech: d.speech, notebook: d.notebook },
              };
            } catch {
              if (this.closed) return;
              this.budget.failed(chatReservation);
              const latest = this.worlds.get(r.state.world) ?? current;
              const noticeKey = `${conversationKey}:failure:${count >= 3 ? 'final' : 'retry'}`;
              if (conversation.speakerId && r.state.dialogueNoticeKey !== noticeKey) {
                say(
                  latest,
                  'AI notice',
                  count >= 3
                    ? `${r.state.name} still cannot reply right now. Please try again later.`
                    : `${r.state.name} received your message but could not reply just now. A retry is scheduled.`,
                  'system',
                  conversation.speakerId,
                );
                r.state.dialogueNoticeKey = noticeKey;
              }
              this.checkpoint(r, latest, 'dialogue-error', {
                message: 'Conversation unavailable; the selected gameplay plan is preserved.',
              });
            }
          } else {
            const latest = this.worlds.get(r.state.world) ?? current;
            r.state.dialogueAttempt = {
              key: conversationKey!,
              attempts: attempt?.attempts ?? 0,
              nextAt: Date.now() + 60000,
              done: false,
            };
            const noticeKey = conversationKey!;
            if (conversation.speakerId && r.state.dialogueNoticeKey !== noticeKey) {
              say(
                latest,
                'AI notice',
                `${r.state.name} received your message, but conversation is waiting for the shared AI budget.`,
                'system',
                conversation.speakerId,
              );
              r.state.dialogueNoticeKey = noticeKey;
            }
            this.checkpoint(r, latest, 'dialogue-budget', {
              message: 'Conversation deferred by shared budget or context limit.',
            });
          }
        }
        // Another action may have rolled back/replaced the world during dialogue.
        const latest = this.worlds.get(r.state.world);
        if (
          controller.signal.aborted ||
          this.closed ||
          this.memory.paused(r.config.id) ||
          !latest ||
          (!latest.players[r.state.playerId]?.online && !r.state.inSpace)
        )
          return;
        // Validate against the world AFTER the asynchronous reply: ownership,
        // stock and prices may have changed while the model was thinking.
        if (discardStaleReply(latest)) return;
        if (conversation?.speakerId && conversationCompleted) {
          rememberConversation(
            r.state,
            { speakerId: conversation.speakerId, world: latest.id, private: !!replyTo },
            result.decision.notebook,
            result.preferences,
            latest.time,
          );
        }
        const proposal = result.gameplayRequest;
        let recorded = false;
        if (proposal && conversation?.speakerId && conversationKey) {
          const player = latest.players[r.state.playerId];
          const reason =
            !proposal.cancel && proposal.delivery
              ? deliveryBlocker(latest, player, proposal.delivery, proposal.delivery.quantity, true)
              : undefined;
          if (!reason)
            recorded = recordCommitment(
              r.state,
              proposal,
              conversationKey,
              conversation.speakerId,
              latest,
              replyTo ?? null,
            );
          if (recorded && proposal.employment && !proposal.cancel) {
            refreshEmployment(latest, player, r.state);
            const queued = r.state.commitments?.find((c) => c.id === conversationKey);
            if (queued?.status === 'blocked') queued.blockedNoticeSent = true;
          }
          if (proposal.delivery || proposal.employment || proposal.cancel || !recorded) {
            const text = reason
              ? `I need to correct that before agreeing: ${reason} I have not accepted this delivery.`
              : !recorded
                ? !proposal.delivery && !proposal.employment && !proposal.cancel
                  ? 'I cannot take on that errand yet. I can agree to deliver specific goods, or learn a skill and take a job at a named workplace. Which of those did you have in mind?'
                  : 'I have not added a new agreement: it is already recorded, there is no matching request to cancel, or my four unfinished requests need attention first. Please ask about my existing agreements.'
                : proposal.cancel
                  ? 'I have cancelled your latest unfinished request.'
                  : proposal.employment
                    ? `I have agreed to ${proposal.employment.train ? 'learn the required skill if needed and ' : ''}take the job at ${latest.buildings.find((b) => b.id === proposal.employment!.building)?.name ?? 'the requested workplace'}. ${employmentBlocker(latest, player, proposal.employment) ?? 'I need to fit this around keeping myself fed, watered and rested.'} That is my agreement, not a report of finished training or a job change.`
                    : `I currently have access to ${proposal.delivery!.quantity} ${proposal.delivery!.item}, and the buyer has the posted price, investment and storage for the order. I have recorded your delivery request at a minimum of ${proposal.delivery!.unitPrice / 100}d per item before tax. It still needs to be planned and carried out, possibly in several loads; nothing has been delivered on this request yet.`;
            result = {
              ...result,
              decision: { ...result.decision, speech: { text, to: replyTo ?? null } },
            };
          }
          if (result.decision.speech)
            r.state.pendingAgreementReply = {
              world: latest.id,
              text: result.decision.speech.text,
              to: replyTo,
              conversationId: conversation.id,
            };
          if (recorded) {
            r.state.needsDecision = true;
            r.wake = true;
            r.state.plan = [];
            r.state.waitUntil = 0;
            r.nav = undefined;
          }
          this.checkpoint(
            r,
            latest,
            recorded ? 'conversation-request' : 'conversation-request-declined',
            {
              id: conversationKey,
              request: proposal,
              reason: reason ?? (recorded ? undefined : 'No new agreement recorded'),
            },
          );
          // The agreement is durable before spending on its wording. A failed or
          // budget-limited reply uses the factual acknowledgement above, never a
          // new proposal, duplicate agreement, or unbounded model loop.
          const spoken = await this.phraseAgreement(
            r,
            latest,
            conversation,
            replyTo,
            {
              accepted: recorded,
              request: proposal,
              status:
                recorded && proposal.cancel
                  ? 'cancelled'
                  : (r.state.commitments?.find((c) => c.id === conversationKey)?.status ??
                    'declined'),
              facts: result.decision.speech?.text,
            },
            controller.signal,
          );
          if (spoken) {
            result = { ...result, decision: { ...result.decision, speech: spoken } };
            if (r.state.pendingAgreementReply) r.state.pendingAgreementReply.text = spoken.text;
          }
        }
        if (
          !proposal &&
          conversation &&
          result.decision.speech &&
          unqueuedPromise(result.decision.speech.text)
        ) {
          result = {
            ...result,
            decision: {
              ...result.decision,
              speech: {
                text: 'I spoke too soon: I have not taken on a new errand. Tell me which workplace you mean for a job or training, or which goods and destination for a delivery, so we can agree on the details.',
                to: replyTo ?? null,
              },
            },
          };
        }
        const finalWorld = this.worlds.get(r.state.world);
        if (
          !finalWorld ||
          this.closed ||
          controller.signal.aborted ||
          this.memory.paused(r.config.id) ||
          (!finalWorld.players[r.state.playerId]?.online && !r.state.inSpace)
        )
          return;
        if (discardStaleReply(finalWorld)) return;
        this.accept(r, finalWorld, result, Date.now(), replyTo, chatOnly);
        if (
          chatOnly &&
          (!r.state.plan.length || now >= r.state.until || p.hunger >= 40000 || p.thirst >= 40000)
        ) {
          r.wake = true;
          r.state.needsDecision = true;
        }
        if (recorded) {
          // One extra gameplay decision only for a recorded agreement; no chat call.
          r.wake = true;
          r.state.needsDecision = true;
          r.state.plan = [];
          r.state.waitUntil = 0;
          r.nav = undefined;
          this.checkpoint(r, finalWorld);
        }
      })
      .catch((e) => {
        if (this.closed || controller.signal.aborted) return;
        if (reservation !== undefined) this.budget.failed(reservation);
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
            player.online = !r.state.inSpace;
            r.active = player.online;
            player.speed = 0;
          }
          this.checkpoint(r, current, 'provider-error', {
            message:
              e instanceof Error &&
              /^AI (provider HTTP [0-9]+|gameplay context exceeds (local size|provider token) limit|response incomplete|response did not contain one valid turn|response missing token accounting)$/.test(
                e.message,
              )
                ? e.message
                : 'AI request failed or timed out',
          });
        }
      })
      .finally(() => {
        r.busy = undefined;
        r.chatBusy = false;
        r.pending = undefined;
      });
  }
  private async phraseAgreement(
    r: Resident,
    w: World,
    conversation: NonNullable<ReturnType<typeof observe>['currentConversation']>,
    replyTo: string | undefined,
    receipt: Record<string, unknown>,
    signal: AbortSignal,
  ) {
    if (!r.dialogue || signal.aborted || this.closed) return;
    const p = w.players[r.state.playerId];
    if (!p || !p.online) return;
    const observation = conversationView(
      observe(w, p, r.state, this.memory, r.config.id),
      r.state,
      conversation.speakerId ?? '',
      !!replyTo,
    );
    // A newer question can arrive during a provider call. This receipt belongs
    // only to the original speaker/message and cannot inherit the newer channel.
    observation.currentConversation = conversation;
    observation.conversationHistory = conversation.speakerId
      ? this.memory
          .conversation(r.config.id, conversation.speakerId, p.id, !!replyTo)
          .map((e) => e.data)
      : [];
    const request = {
      instructions:
        conversationInstructions +
        '\nYour personality: ' +
        r.state.personality +
        '\nRECEIPT REPLY ONLY: The server has already checked and recorded or declined this request. Say the receipt result naturally in your own voice. Do not claim unverified travel, training, employment or delivery happened. Explain any actual blocker. No new promises or actions: gameplayRequest and preferences MUST be null. Do not mention tools, validation or providers. Keep this reply brief and specific. The receipt facts override your earlier draft.',
      observation: { ...observation, responsePhase: 'receipt', agreementResult: receipt },
    };
    const bytes =
      Buffer.byteLength(JSON.stringify(request)) +
      Buffer.byteLength(JSON.stringify(conversationTool));
    if (bytes > 96000) return;
    const reservation = this.budget.reserve(
      r.config.id,
      bytes,
      conversationOutputLimit,
      Date.now(),
      r.dialogue.rates,
    );
    if (reservation === undefined) return;
    try {
      const answer = await r.dialogue.brain.decide(request, signal);
      this.budget.settle(
        reservation,
        answer.inputTokens,
        answer.outputTokens,
        answer.cacheWriteTokens,
        answer.cacheReadTokens,
      );
      if (this.closed || signal.aborted || this.memory.paused(r.config.id)) return;
      const speech = decisionSchema.parse(answer.decision).speech;
      if (answer.gameplayRequest || !speech || speech.text.trim().startsWith('*')) return;
      return { text: speech.text, to: replyTo ?? null };
    } catch {
      this.budget.failed(reservation);
      // Preserve the already-durable agreement and factual fallback, no retry.
      return;
    }
  }
  private accept(
    r: Resident,
    w: World,
    result: BrainResult,
    now: number,
    replyTo?: string,
    chatOnly = false,
  ) {
    const d = decisionSchema.parse(result.decision);
    if (d.speech?.text.trim().startsWith('*')) throw Error('NPC speech cannot run chat commands');
    r.state.pending = false;
    const addressed = !!r.state.helpQuestion;
    // Public activity narration is never an autonomous side effect of a plan.
    // Apply to every provider, including old adapters and malformed chat replies.
    if (!addressed) d.speech = null;
    const rejected = !chatOnly && d.plan.find((s) => blockedStep(r.state.recovery, s, w.time));
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
    if (!r.dialogue || !chatOnly) r.state.notebook = d.notebook;
    if (!chatOnly) {
      r.state.intent = d.intent;
      r.state.plan = d.plan;
      delete r.state.fishCaught;
      r.state.index = 0;
      r.state.repeats = d.repeat;
      r.state.until = now + d.reconsiderSeconds * 1000;
      r.state.nextAt = r.state.until;
      r.state.waitUntil = 0;
      r.state.errors = 0;
      r.state.recall = undefined;
      r.state.guideQuery = undefined;
    }
    if (d.speech && !r.wake) r.state.helpQuestion = undefined;
    r.state.status = d.intent;
    this.checkpoint(r, w, chatOnly ? 'conversation' : 'decision', {
      intent: d.intent,
      plan: d.plan,
      repeat: d.repeat,
      reconsiderSeconds: d.reconsiderSeconds,
    });
    // The initiating message fixes the channel, including public (undefined).
    // A model's recipient suggestion must not privatize public replies or redirect DMs.
    // replyTo was captured before the async call, so newer chat cannot reroute this answer.
    const recipient = replyTo;
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
      status: r.state.inSpace
        ? 'In space'
        : r.busy
          ? 'Thinking'
          : this.memory.paused(r.config.id)
            ? 'Paused by operator'
            : this.worlds.get(r.state.world)?.players[r.state.playerId]?.online
              ? 'Active'
              : 'Resting',
      model: r.config.model,
      provider: r.config.provider,
      presence: r.config.presence,
      nextVisitAt: r.state.presence?.phase === 'offline' ? r.state.presence.nextAt : undefined,
      sessionEndsAt: r.state.presence?.phase !== 'offline' ? r.state.presence?.endsAt : undefined,
      conversationProvider: r.dialogue ? (r.dialogue.provider ?? 'anthropic') : undefined,
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
