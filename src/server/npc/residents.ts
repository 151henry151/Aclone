import { returnResidentHome } from './home-world.ts';
import {
  businessRequestBlocker,
  checkBusinessAction,
  recordBusinessAction,
} from './business-requests.ts';
import { checkHousingPurchase } from './housing.ts';
import { savingChoices } from './ambitions.ts';
import { planQuotes, changedQuote } from './execution.ts';
import {
  publicAddressees,
  mentionsName,
  isChatDismissal,
  isChatClosing,
  chatWasDismissed,
} from './chat-attention.ts';
import { recordBusinessFreight } from './business-freight.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { isGroupAddress, groupResponder, groupTopic } from './group-chat.ts';
import {
  perceivedWorld,
  rememberMarkets,
  inspectionChoices,
  marketKnowledge,
} from './perception.ts';
import {
  suspendPlan,
  resumePlan,
  employmentRoutine,
  exploreRoutine,
  hustleRoutine,
  visitorShouldHustle,
  preparingPlan,
} from './routines.ts';
import { supplyChoices, continueSupply } from './survival.ts';
import {
  publishSupplyIntent,
  anotherSupplier,
  anotherFounding,
  publishFoundingIntent,
} from './cooperation.ts';
import { strategicReviewDue, prosperityBriefing, opportunityCounts } from './prosperity.ts';
import { netAssets, liquidCapital } from './wealth.ts';
import { workplace, shiftBlocker } from './workplace.ts';
import { startCareer, continueCareer, finishCareer, projectTrade } from './projects.ts';
import { canKeepFishing, strandedCargo } from './cargo.ts';
import { householdBudget } from './household.ts';
import { ownerRoutine, ownerBidRoutine, cargoRelief } from './business-policy.ts';
import { economicMenu, enterpriseChoices } from './enterprise.ts';
import { carePlan } from './care.ts';
import type { World, Player, Action } from '../../shared/types.ts';
import { act, addPlayer, move, say } from '../../shared/simulation.ts';
import { worldResources } from '../../shared/resources.ts';
import type { Store } from '../store.ts';
import type { Universe, Account } from '../universe.ts';
import { spaceChoices, spaceOperations, spaceAction, exchange, systemFor } from './space.ts';
import { operation } from './player-operations.ts';
import { travelPrep, drivePlan } from './travel.ts';
import { leaveCombat } from '../../shared/combat.ts';
import { NpcMemory, type ResidentState } from './memory.ts';
import { NpcBudget, budgetSchema, type TokenRates, type BudgetConfig } from './budget.ts';
import { decisionSchema, type Brain, type BrainResult, type Step } from './decision.ts';
import type { NpcConfig } from './config.ts';
import { failStep, blockedStep, madeProgress, allowSpeech } from './recovery.ts';
import { distance } from '../../shared/simulation.ts';
import { Navigator, serviceRadius } from './navigation.ts';
import { instructions, conversationInstructions, observe } from './observation.ts';
import { careNeeded, secondsToDamage } from './strategy.ts';
import { characterRevision } from './character-facts.ts';
import { jevInstructions, LocalRequestError } from './jev.ts';
import { farmerSituation } from './farmer.ts';
import { adaptiveChoices, parishSurvey } from './adaptive.ts';
import { kindRecipe } from './chains.ts';
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
  queued?: boolean;
  chatBusy?: boolean;
  pending?: Promise<void>;
  wake: boolean;
  lastCall: number;
  cooldown: number;
  active: boolean;
  caring?: boolean;
  careCheckAt?: number;
  shiftCheckAt?: number;
  ownerCheckAt?: number;
  exploreCheckAt?: number;
}
export class Residents {
  readonly memory: NpcMemory;
  readonly budget: NpcBudget;
  private residents: Resident[] = [];
  onTask?: (w: World, id: string) => void;
  private closed = false;
  private pollAt = 0;
  private planQueue: { resident: Resident; now: number }[] = [];
  private planning = false;
  private planTimer?: ReturnType<typeof setTimeout>;
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
      const c = option.config;
      const initialWorld = worlds.get(this.memory.load(c.id)?.world ?? c.world);
      if (!initialWorld || worlds.get(c.world)?.template !== 'economy')
        throw Error('NPC world must be an existing economy parish');
      let w: World = initialWorld;
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
      if (c.homeWorldOnly && (state.world !== c.world || state.inSpace)) {
        const home = worlds.get(c.world)!;
        const away = w;
        const returning = state;
        this.store.transaction(() => {
          const row = this.store.db
            .prepare('SELECT state FROM accounts WHERE id=?')
            .get(returning.playerId);
          if (!row) throw Error('Resident account missing');
          const account = JSON.parse(String(row.state));
          returnResidentHome(returning, home, away, account);
          this.universe.save(account);
          this.store.saveWorld(away, Date.now() / 1000);
          this.store.saveWorld(home, Date.now() / 1000);
          this.memory.save(c.id, returning);
          this.memory.append(c.id, home.time, 'home-world-return', { from: away.id, to: home.id });
        });
        w = home;
      }
      if (c.presence === 'scheduled') {
        if (!state.presence) {
          state.presence = initialPresence(c.id, c.habit, c.timeZone, Date.now());
          // Existing pilots get a full visit to prepare, rather than being
          // suddenly signed off with empty stores during this migration.
          if (w.players[state.playerId]) state.presence.nextAt = Date.now();
        }
      } else delete state.presence;
      state.originWorld ??= c.world;
      if (c.provider === 'jev' && state.behaviorVersion !== 3) state.needsDecision = true;
      state.behaviorVersion = 3;
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
        wake:
          Date.now() >= (state.plannerRetryAt ?? 0) &&
          (!!state.needsDecision || !!state.pending || state.plan.length === 0),
        lastCall: 0,
        cooldown: state.plannerRetryAt ?? 0,
        active: false,
        caring: state.routine === 'care',
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
      const addressedPlayers = publicAddressees(m.text, Object.values(w.players));
      const dismissal = isChatDismissal(m.text);
      const named = residents.filter((r) =>
        addressedPlayers.some((p) => p.id === r.state.playerId),
      );
      // Natural stop phrases sometimes put the name in the middle: "thanks Mabel, enough for now".
      if (dismissal && !addressedPlayers.length)
        named.push(...residents.filter((r) => mentionsName(m.text, r.state.name)));
      const namesHuman = addressedPlayers.some((p) => !p.npc && p.id !== sender?.id);
      const incidentalName =
        !named.length && residents.some((r) => mentionsName(m.text, r.state.name));
      const listeners =
        humanChat && !m.to && !named.length && !namesHuman && !incidentalName
          ? residents.filter((r) =>
              r.state.publicConversations?.some(
                (c) =>
                  c.speakerId === sender.id &&
                  c.messageId < m.id! &&
                  (dismissal || (c.followupsRemaining ?? 1) > 0),
              ),
            )
          : [];
      const group = !!(
        humanChat &&
        !m.to &&
        !named.length &&
        !namesHuman &&
        isGroupAddress(m.text)
      );
      const volunteer =
        group && !dismissal
          ? groupResponder(
              w,
              residents.filter((r) => !this.memory.paused(r.config.id)),
              m.text,
              m.id,
              now,
            )
          : undefined;
      const targets = m.to
        ? residents.filter((r) => r.state.playerId === m.to)
        : namesHuman
          ? []
          : named.length
            ? named
            : group
              ? dismissal
                ? residents
                : volunteer
                  ? [volunteer]
                  : []
              : !isChatClosing(m.text) && listeners.length === 1
                ? listeners
                : [];
      if (humanChat && !m.to && !targets.length) {
        for (const r of residents) {
          r.state.publicConversations = [];
          changed.add(r);
        }
      }
      for (const r of unread) {
        changed.add(r);
        r.state.cursor = m.id;
        if (humanChat && dismissal && targets.includes(r)) {
          const closed =
            r.state.dismissedChat?.world === w.id ? r.state.dismissedChat : { world: w.id };
          if (m.to) {
            closed.privateThrough = Object.fromEntries(
              [...Object.entries(closed.privateThrough ?? {}), [sender.id, m.id]].slice(-64),
            );
          } else {
            // "We don't need help" closes the public conversation for all participants.
            closed.publicThrough = Math.max(closed.publicThrough ?? 0, m.id);
            r.state.publicConversations = [];
          }
          r.state.dismissedChat = closed;
          // Silence also covers later automatic notices about existing agreements;
          // the agreements themselves continue through normal gameplay.
          for (const c of r.state.commitments ?? [])
            if (
              c.world === w.id &&
              (m.to ? c.replyTo !== null && c.speakerId === sender.id : c.replyTo === null)
            )
              c.blockedNoticeSent = true;
          if (chatWasDismissed(r.state, w.id, r.state.conversationId, r.state.replyTo)) {
            delete r.state.helpQuestion;
            delete r.state.replyTo;
            delete r.state.groupQuestion;
            delete r.state.dialogueAttempt;
          }
          const pending = r.state.pendingAgreementReply;
          if (
            pending &&
            chatWasDismissed(r.state, pending.world, pending.conversationId, pending.to)
          )
            delete r.state.pendingAgreementReply;
          this.memory.append(r.config.id, w.time, 'conversation-dismissed', {
            messageId: m.id,
            private: !!m.to,
          });
          continue;
        }
        if (humanChat) {
          // A DM or a different named resident ends this player's public thread.
          // Never overwrite a newer thread when catching up an older cursor.
          const newer = r.state.publicConversations!.some(
            (c) => c.speakerId === sender.id && c.messageId >= m.id!,
          );
          if (!newer) {
            const previousThread = r.state.publicConversations!.find(
              (c) => c.speakerId === sender.id,
            );
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
                // Only an explicit invitation renews the window; replies cannot keep it alive forever.
                expiresAt:
                  named.includes(r) || group ? now + 120000 : (previousThread?.expiresAt ?? now),
                followupsRemaining:
                  named.includes(r) || group
                    ? 2
                    : Math.max(0, (previousThread?.followupsRemaining ?? 1) - 1),
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
          if (group) {
            r.state.groupReplyAt = now;
            r.state.groupQuestion = { messageId: m.id, topic: groupTopic(m.text) };
          } else delete r.state.groupQuestion;
          r.state.conversationId = m.id;
          r.state.questionFrom = sender.id;
          r.state.questionFromName = sender.name;
          // Chat can interrupt recovery without restarting a failed action loop.
          if (r.state.recovery) r.state.recovery.retryAt = 0;
          r.state.replyTo = m.to === r.state.playerId ? sender.id : undefined;
        }
      }
    }
    for (const r of changed) this.memory.save(r.config.id, r.state);
  }

  private checkpoint(r: Resident, w: World, kind?: string, data?: unknown) {
    const player = w.players[r.state.playerId];
    if (player)
      publishSupplyIntent(
        w,
        player,
        r.state.supplyGoal,
        !!kind && ['decision', 'self-care', 'supply-progress', 'arrival', 'action'].includes(kind),
      );
    this.store.saveWorld(w, Date.now() / 1000, () => {
      if (kind) this.memory.append(r.config.id, w.time, kind, data);
      this.capture(w);
      this.memory.save(r.config.id, r.state);
    });
  }
  private failure(r: Resident, w: World, message: string, attempted = r.state.plan[r.state.index]) {
    if (r.state.career && !r.state.routine) r.state.career.failures++;
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
      checkHousingPurchase(w, p, a);
      checkCommitmentPrice(w, r.state, a);
      checkBusinessAction(w, p, r.state, a);
      if (a.type === 'job' || a.type === 'work') {
        const b = w.buildings.find((b) => b.id === a.building);
        const blocked = b && shiftBlocker(w, p, b);
        if (blocked) throw Error(blocked);
      }
      // Plans travel before quitting. Recheck the promised vacancy locally before
      // relinquishing the old job; stale quotes must not cause job churn.
      if (a.type === 'quit') {
        const next = r.state.plan
          .slice(r.state.index + 1)
          .find((s) => s.kind === 'act' && s.action.type === 'job');
        if (next?.kind === 'act' && next.action.type === 'job') {
          const target = next.action.building;
          const b = w.buildings.find((b) => b.id === target);
          if (!b || distance(p, b) >= 18)
            throw Error('Inspect the new workplace before leaving my job');
          if (!workplace(w, p, b)?.qualified)
            throw Error('Qualify for the new job before leaving my current one');
          const blocked = shiftBlocker(w, p, b);
          if (blocked) throw Error(blocked);
        }
      }
      const result = act(w, p.id, a);
      recordBusinessFreight(before, w, p, r.state, a);
      if (a.type === 'construct') {
        const site = w.buildings.find(
          (b) =>
            b.owner === p.id && b.construction && !before.buildings.some((old) => old.id === b.id),
        );
        if (site)
          startCareer(w, p, r.state, {
            kind: site.kind === 'home' ? 'housing' : 'business',
            target: site.id,
          });
      }
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
      refreshEmployment(perceivedWorld(w, p, r.state, r.config.id === 'mabel'), p, r.state);
      const businessChanged = recordBusinessAction(w, p, r.state, a);
      if (recordDelivery(r.state, w.id, a) || businessChanged) {
        r.wake = true;
        r.state.needsDecision = true;
      }
      if (r.state.career && (!r.state.routine || r.state.routine === 'hustle')) {
        const difference = p.cash - stats.cash;
        if (
          a.type === 'trade' &&
          projectTrade(r.state.career, { building: a.building, item: a.item })
        ) {
          if (difference > 0) {
            r.state.career.receipts += difference;
            r.state.career.completed++;
          } else r.state.career.spending -= difference;
          r.state.career.lastReceipt = w.ledger.at(-1)?.id;
        }
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
    if (r.state.inSpace)
      return r.config.homeWorldOnly ? [] : spaceChoices(a, this.worlds, this.universe);
    const actual = w;
    w = perceivedWorld(w, p, r.state, r.config.id === 'mabel');
    const deliveries = commitmentChoices(w, p, r.state, actual.buildings);
    // A failed human agreement merits one factual notice, not another model call
    // or recurring public activity narration. Legacy channels default to private.
    const blocked = r.state.commitments?.find(
      (c) =>
        c.world === w.id &&
        c.status === 'blocked' &&
        !c.blockedNoticeSent &&
        actual.players[c.speakerId]?.online &&
        !p.task,
    );
    if (blocked && !p.muted && !w.settings.chatLocked) {
      act(actual, p.id, {
        type: 'chat',
        text: blocked.delivery
          ? `My delivery is blocked: ${blocked.outcome} ${blocked.delivered}/${blocked.delivery.quantity} ${blocked.delivery.item} delivered.`
          : `My agreed task is blocked: ${blocked.outcome}`,
        ...(blocked.replyTo === null ? {} : { to: blocked.speakerId }),
      });
      blocked.blockedNoticeSent = true;
      this.checkpoint(r, actual, 'delivery-blocked', { id: blocked.id, outcome: blocked.outcome });
    }
    const agreed = focusCommitments(w, p, r.state, deliveries);
    if (!p.task && !careNeeded(w, p) && agreed.length)
      return learnedChoices(r.state, agreed).map((c) => ({
        ...c,
        tradeQuotes: planQuotes(w, c.plan),
      }));
    const choices = [
      ...savingChoices(w, p, r.state),
      ...supplyChoices(w, p, r.state),
      ...deliveries,
      ...inspectionChoices(actual, p, r.state),
      ...adaptiveChoices(w, p, r.state),
    ];
    const port = w.buildings.find((b) => b.kind === 'starport' && !b.construction);
    if (!r.config.homeWorldOnly && port && !p.task && !p.atHome && !p.game) {
      const visit: Step[] = [...travelPrep(p), { kind: 'travel', destination: port.id }];
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
        visitorShouldHustle(r.config.id, r.state.presence),
        r.state,
      ),
    ).map((c) => ({ ...c, tradeQuotes: planQuotes(w, c.plan) }));
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
        if (r.config.homeWorldOnly)
          throw Error(
            'My role is based in my home world; space travel and currency exchange are unavailable.',
          );
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
      if (!w || w.maintenance?.paused || !p || !p.online) continue;
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
      if (!w || w.maintenance?.paused) continue;
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
      rememberMarkets(w, p, r.state);
      if (r.state.observedDeaths !== undefined && p.deaths !== r.state.observedDeaths) {
        // A previous-life plan or reply must not reappear after resurrection,
        // including replies already in flight when the death happened.
        r.busy?.abort();
        delete r.state.pendingAgreementReply;
        delete r.state.dialogueAttempt;
        delete r.state.observedTask;
        delete r.state.evaluation;
        delete r.state.recovery;
        delete r.state.suspendedPlan;
        delete r.state.supplyGoal;
        finishCareer(w, p, r.state, 'Life ended; reassess all abilities and assets');
        delete r.state.ambition;
        delete r.state.plannerRetryAt;
        delete r.state.tradeQuotes;
        delete r.state.businessCargo;
        delete r.state.businessProceeds;
        delete r.state.routine;
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
        this.dequeueThink(r);
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
      if (!r.state.inSpace && !p.atHome && !p.crowBody && !p.task && ![0, 5].includes(p.vehicle)) {
        // Repair obsolete/custom transport before route backoff or another model call.
        r.nav = undefined;
        const known = perceivedWorld(w, p, r.state, r.config.id === 'mabel');
        const prep = strandedCargo(p, known)[0] ?? travelPrep(p)[0];
        if (prep?.kind === 'act') this.perform(r, w, prep.action, false);
        else if (prep?.kind === 'operation') this.perform(r, w, operationAction(prep), false);
        continue;
      }
      if (w.time < (r.state.recovery?.retryAt ?? 0) && !this.dialogueDue(r, now)) {
        // Backoff must not prevent using food already in hand. Only an immediate
        // serving may bypass it, never another route, investment or model call.
        const immediate = carePlan(
          perceivedWorld(w, p, r.state, r.config.id === 'mabel'),
          p,
          r.state,
        );
        if (
          immediate.length === 1 &&
          immediate[0].kind === 'act' &&
          immediate[0].action.type === 'use'
        )
          this.perform(r, w, immediate[0].action, false);
        else if (
          immediate.length === 1 &&
          immediate[0].kind === 'operation' &&
          immediate[0].operation === 'crow' &&
          p.crowBody
        )
          this.perform(r, w, operationAction(immediate[0]), false, immediate[0]);
        continue;
      }
      // A survival errand must not silence an online resident either. Only the
      // addressed conversation is requested; routine care keeps running locally.
      if (
        !r.busy &&
        !r.queued &&
        this.dialogueDue(r, now) &&
        now - r.lastCall >= r.config.intervalMs &&
        this.plannerBusy() < this.budget.config.concurrency
      ) {
        p.online = !r.state.inSpace;
        r.active = p.online;
        this.enqueueThink(r, now);
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
          delete r.state.routine;
          r.wake = !resumePlan(w, p, r.state) && now >= (r.state.plannerRetryAt ?? 0);
          if (!r.wake) r.state.needsDecision = false;
          if (!r.wake) {
            r.state.until = now + 1800000;
            r.state.nextAt = r.state.until;
            r.state.needsDecision = false;
          }
        }
        if (!p.task && now >= (r.careCheckAt ?? 0)) {
          r.careCheckAt = now + 10000;
          const known = perceivedWorld(w, p, r.state, r.config.id === 'mabel');
          const continuation = continueSupply(known, p, r.state);
          let plan = carePlan(known, p, r.state);
          if (!plan.length) plan = cargoRelief(known, p, r.state);
          if (!plan.length) {
            const supply = continuation ?? supplyChoices(known, p, r.state)[0];
            if (supply) {
              r.state.supplyGoal ??= supply.supplyGoal;
              plan = supply.plan;
            }
          }
          // Discover an unknown source rather than interpreting unseen stock as empty.
          if (!plan.length && !r.state.supplyGoal && (p.hunger >= 15000 || p.thirst >= 15000))
            plan = inspectionChoices(w, p, r.state)[0]?.plan ?? [];
          if (plan.length) suspendPlan(w, p, r.state);
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
            r.state.routine = 'care';
            p.online = true;
            r.active = true;
            this.checkpoint(r, w, 'self-care', { hunger: p.hunger, thirst: p.thirst });
            this.runStep(r, w, p, now);
            continue;
          }
        }
      }
      // Execute accepted plans during outages. A strategic-call budget never
      // freezes driving, a production wait, or an already chosen ordinary action.
      if (!r.busy && !r.nav && !p.task && now >= r.state.waitUntil && !r.state.inSpace) {
        const known = perceivedWorld(w, p, r.state, r.config.id === 'mabel');
        if (
          !careNeeded(w, p) &&
          !p.learning &&
          !r.state.helpQuestion &&
          r.state.index >= r.state.plan.length &&
          now >= (r.ownerCheckAt ?? 0)
        ) {
          r.ownerCheckAt = now + 60000;
          const plan = ownerBidRoutine(known, p, r.state);
          if (plan.length && !plan.some((s) => blockedStep(r.state.recovery, s, w.time))) {
            r.state.plan = plan;
            r.state.index = 0;
            r.state.repeats = 1;
            r.state.until = r.state.nextAt = now + 600000;
            r.state.routine = 'employment';
            r.state.needsDecision = false;
            r.wake = false;
            this.checkpoint(r, w, 'owner-purchasing', { plan });
            this.runStep(r, w, p, now);
            continue;
          }
        }
        if (
          now >= (r.state.plannerRetryAt ?? 0) &&
          !careNeeded(w, p) &&
          strategicReviewDue(w, p, r.state, r.config.preference)
        ) {
          r.wake = true;
          r.state.needsDecision = true;
        }
        const project =
          !careNeeded(w, p) &&
          !r.state.helpQuestion &&
          r.state.career &&
          (r.state.career.kind === 'housing' ||
            (r.state.career.kind === 'business' &&
              known.buildings.some((b) => b.id === r.state.career?.target && b.construction))) &&
          r.state.index >= r.state.plan.length
            ? continueCareer(known, p, r.state, enterpriseChoices(known, p))
            : undefined;
        const continuation =
          project ??
          (!r.wake && !r.state.needsDecision && r.state.index >= r.state.plan.length
            ? (continueSupply(known, p, r.state) ??
              (!r.state.helpQuestion && !r.state.routine && r.state.career
                ? continueCareer(
                    known,
                    p,
                    r.state,
                    ['business', 'housing'].includes(r.state.career.kind)
                      ? enterpriseChoices(known, p)
                      : [],
                  )
                : undefined))
            : undefined);
        if (continuation && r.state.index >= r.state.plan.length) {
          r.state.plan = continuation.plan;
          r.state.tradeQuotes = planQuotes(known, continuation.plan);
          r.state.index = 0;
          r.state.repeats = 1;
          r.state.until = now + 1800000;
          r.state.nextAt = r.state.until;
          r.wake = false;
          r.state.needsDecision = false;
          this.checkpoint(r, w, r.state.supplyGoal ? 'supply-progress' : 'career-progress', {
            goal: r.state.supplyGoal ?? r.state.career,
            plan: continuation.plan,
          });
        }
        if (
          !careNeeded(w, p) &&
          !r.wake &&
          !r.state.routine &&
          !r.state.supplyGoal &&
          r.state.index >= r.state.plan.length &&
          (p.vehicle === 5 || p.fuel < 10)
        ) {
          const plan = cargoRelief(known, p, r.state).length
            ? cargoRelief(known, p, r.state)
            : drivePlan(known, p);
          if (plan.length) {
            r.nav = undefined;
            r.state.plan = plan;
            r.state.index = 0;
            r.state.repeats = 1;
            r.state.routine = 'drive';
            r.wake = false;
            this.checkpoint(r, w, 'drive', { plan });
          }
        }
        if (
          !careNeeded(w, p) &&
          !r.wake &&
          r.state.index >= r.state.plan.length &&
          now >= (r.shiftCheckAt ?? 0)
        ) {
          r.shiftCheckAt = now + 60000;
          const plan = ownerRoutine(known, p, r.state).length
            ? ownerRoutine(known, p, r.state)
            : employmentRoutine(known, p, r.state);
          if (plan.length && (!r.state.routine || r.state.routine === 'explore')) {
            if (!r.state.routine) suspendPlan(w, p, r.state);
            r.nav = undefined;
            r.state.plan = plan;
            r.state.index = 0;
            r.state.repeats = 1;
            r.state.routine = 'employment';
            r.wake = false;
            this.checkpoint(r, w, 'employment-routine', { plan });
          }
        }
        if (
          !careNeeded(w, p) &&
          !r.wake &&
          !r.state.needsDecision &&
          !r.state.routine &&
          !r.state.supplyGoal &&
          r.state.presence?.phase !== 'preparing' &&
          !p.task &&
          r.state.index >= r.state.plan.length &&
          now >= (r.exploreCheckAt ?? 0)
        ) {
          r.exploreCheckAt = now + 90000;
          const hustle =
            now < (r.state.plannerRetryAt ?? 0) ||
            visitorShouldHustle(r.config.id, r.state.presence, now);
          const plan = hustle ? hustleRoutine(known, p, r.state) : exploreRoutine(w, p, r.state);
          if (plan.length) {
            r.nav = undefined;
            r.state.plan = plan;
            r.state.index = 0;
            r.state.repeats = 1;
            r.state.tradeQuotes = planQuotes(known, plan);
            r.state.routine = hustle ? 'hustle' : 'explore';
            r.wake = false;
            this.checkpoint(r, w, hustle ? 'hustle' : 'explore-parish', { plan });
          }
        }
        if (
          r.state.plan.length &&
          r.state.index < r.state.plan.length &&
          (now < r.cooldown || r.state.routine || r.state.supplyGoal)
        ) {
          this.runStep(r, w, p, now);
          continue;
        }
        if (
          (r.state.routine === 'employment' ||
            r.state.routine === 'explore' ||
            r.state.routine === 'hustle' ||
            r.state.routine === 'drive') &&
          r.state.index >= r.state.plan.length
        ) {
          if (r.state.routine === 'hustle') r.exploreCheckAt = now;
          delete r.state.routine;
          r.state.plan = [];
          r.wake = !resumePlan(w, p, r.state) && now >= (r.state.plannerRetryAt ?? 0);
          if (!r.wake) r.state.needsDecision = false;
          r.state.until = now + 1800000;
          r.state.nextAt = r.state.until;
        }
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
      if (
        r.busy ||
        r.queued ||
        (w.time < (r.state.recovery?.retryAt ?? 0) && !this.dialogueDue(r, now))
      )
        continue;
      if (
        r.wake ||
        this.dialogueDue(r, now) ||
        (now >= r.state.nextAt && (!r.state.plan.length || now >= r.state.until))
      ) {
        if (now - r.lastCall < r.config.intervalMs) continue;
        if (this.plannerBusy() >= this.budget.config.concurrency) continue;
        this.enqueueThink(r, now);
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
      r.wake = !resumePlan(w, p, r.state);
      r.state.needsDecision = r.wake;
      r.state.until = now + 1800000;
      r.state.status = s.reason!;
      this.checkpoint(r, w, 'session', { event: 'Scheduled arrival', ...s });
    }
    if (s.phase === 'playing' && now >= s.endsAt - 5 * 60000) {
      s.phase = 'preparing';
      suspendPlan(w, p, r.state);
      r.caring = false;
      delete r.state.routine;
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
      !r.queued &&
      this.dialogueDue(r, now) &&
      now - r.lastCall >= r.config.intervalMs &&
      this.plannerBusy() < this.budget.config.concurrency
    ) {
      this.enqueueThink(r, now);
      return true;
    }
    if (
      r.busy ||
      r.queued ||
      r.nav ||
      p.task ||
      now < r.state.waitUntil ||
      w.time < (r.state.recovery?.retryAt ?? 0)
    )
      return true;
    if (r.state.inSpace) {
      const a = this.account(r);
      this.universe.arrive(a);
      const landing = spaceChoices(a, this.worlds, this.universe).find((c) =>
        c.plan.some((step) => step.kind === 'operation' && step.operation === 'land'),
      );
      if (!landing) return true;
      r.state.plan = landing.plan;
    } else if (!r.state.plan.length || r.state.index >= r.state.plan.length) {
      const alreadyWorked = r.state.routine === 'employment';
      if (alreadyWorked) delete r.state.routine;
      const known = perceivedWorld(w, p, r.state, r.config.id === 'mabel');
      const next = alreadyWorked
        ? { plan: homecomingPlan(known, p, away, r.state) }
        : preparingPlan(known, p, away, r.state);
      r.state.plan = next.plan;
      if (next.routine) r.state.routine = next.routine;
      // Never execute the remainder of an errand whose prerequisite failed.
      if (r.state.plan.some((step) => blockedStep(r.state.recovery, step, w.time)))
        r.state.plan = [];
      if (!r.state.plan.length && !ready.atHome)
        r.state.plan = inspectionChoices(w, p, r.state)[0]?.plan ?? [];
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
    r.state.intent =
      r.state.routine === 'employment'
        ? 'Honour the job I already hold before I go home'
        : 'Prepare supplies and return home before logging off';
    r.state.status = r.state.intent;
    this.checkpoint(r, w, r.state.routine === 'employment' ? 'employment-routine' : 'homecoming', {
      plan: r.state.plan,
      readiness: ready,
    });
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
        if (r.state.commitments?.some((c) => c.world === w.id && c.status === 'pending')) {
          r.wake = true;
          r.state.needsDecision = true;
        }
        this.checkpoint(r, w, 'plan-complete', { cash: p.cash, bank: p.bank });
        return;
      }
    }
    const step = r.state.plan[r.state.index];
    const blocked = blockedStep(r.state.recovery, step, w.time);
    if (blocked) {
      r.state.waitUntil = now + Math.max(1, blocked.until - w.time) * 1000;
      return;
    }
    // The tank can empty after a plan was accepted. Repair the transport prerequisite
    // without discarding its destination or fetching another strategic decision.
    if (
      (step.kind === 'travel' || step.kind === 'move' || (step.kind === 'fish' && p.crowBody)) &&
      !r.state.inSpace
    ) {
      const prep = travelPrep(p);
      if (prep.length) {
        r.state.plan.splice(r.state.index, 0, ...prep);
        this.checkpoint(r, w, 'transport-recovery', { destination: step });
        return;
      }
    }
    if (step.kind === 'act' && step.action.type === 'vehicle' && step.action.slot === 5) {
      const unload = strandedCargo(p, perceivedWorld(w, p, r.state, r.config.id === 'mabel'));
      if (unload.length) {
        r.state.plan.splice(r.state.index, 0, ...unload);
        this.checkpoint(r, w, 'cargo-recovery', { plan: unload });
        return;
      }
    }
    r.state.status = r.state.intent;
    try {
      if (step.kind === 'wait') {
        r.state.index++;
        r.state.waitUntil = now + step.seconds * 1000;
        this.checkpoint(r, w);
      } else if (step.kind === 'act') {
        if (!r.state.routine || r.state.routine === 'hustle') {
          const quoteError = changedQuote(w, p, step.action, r.state.tradeQuotes);
          if (quoteError) throw Error(quoteError);
        }
        if (r.state.inSpace) throw Error('Land before taking parish actions');
        this.perform(r, w, step.action, true);
      } else if (step.kind === 'operation') {
        if (spaceOperations.has(step.operation)) this.performSpace(r, w, step);
        else {
          if (r.state.inSpace) throw Error('Land before taking parish actions');
          this.perform(r, w, operationAction(step), true, step);
        }
      } else if (step.kind === 'fish') {
        if (!canKeepFishing(w, p)) {
          if (p.game === 'fishing') this.perform(r, w, { type: 'leaveGame' }, false, step);
          r.state.index++;
          delete r.state.fishCaught;
          this.checkpoint(r, w, 'fishing-load-limit', { fish: p.inventory.fish ?? 0 });
          return;
        }
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
        if (p.vehicle === 5 && p.fuel > 0) this.perform(r, w, { type: 'vehicle', slot: 0 }, false);
        if (p.vehicle !== 5 && !p.engine && p.fuel > 0)
          this.perform(r, w, { type: 'engine' }, false);
        let target: { x: number; z: number } | undefined,
          radius = 3;
        if (step.kind === 'move') target = step;
        else {
          target = w.buildings.find((b) => b.id === step.destination);
          radius = serviceRadius;
          if (!target) {
            target = worldResources(w).find((n) => n.id === step.destination);
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
  private plannerBusy() {
    return this.residents.filter((q) => q.busy || q.queued).length;
  }
  private enqueueThink(r: Resident, now: number) {
    if (r.busy || r.queued || this.closed) return;
    r.queued = true;
    this.planQueue.push({ resident: r, now });
    this.pumpPlanner();
  }
  private dequeueThink(r: Resident) {
    if (!r.queued) return;
    this.planQueue = this.planQueue.filter((q) => q.resident !== r);
    r.queued = false;
  }
  private pumpPlanner() {
    if (this.closed || this.planning || this.planTimer) return;
    if (!this.planQueue.length) return;
    if (this.residents.filter((q) => q.busy).length >= this.budget.config.concurrency) return;
    this.planning = true;
    this.planTimer = setTimeout(() => this.runQueuedThink(), 0);
  }
  private runQueuedThink() {
    this.planTimer = undefined;
    this.planning = false;
    const item = this.planQueue.shift();
    if (!item || this.closed) {
      if (item) item.resident.queued = false;
      return;
    }
    const { resident: r, now } = item;
    r.queued = false;
    if (this.memory.paused(r.config.id)) {
      this.pumpPlanner();
      return;
    }
    const w = this.worlds.get(r.state.world),
      p = w?.players[r.state.playerId];
    if (w && !w.maintenance?.paused && p) {
      try {
        this.think(r, w, p, now);
      } catch (err) {
        console.error(`NPC ${r.config.id} think failed:`, err);
        r.wake = false;
        r.state.needsDecision = false;
        r.state.nextAt = now + 60000;
        r.state.until = r.state.nextAt;
      }
    }
    this.pumpPlanner();
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
      netAssets: netAssets(w, p),
      liquidCapital: liquidCapital(w, p),
      time: w.time,
      cash: p.cash,
      bank: p.bank,
      health: p.health,
      inventory: { ...p.inventory },
      job: p.job ?? null,
    };
    const knownWorld = perceivedWorld(w, p, r.state, r.config.id === 'mabel');
    const request = structuredClone({
      instructions: instructions + '\nYour personality: ' + r.state.personality,
      observation: {
        ...observe(knownWorld, p, r.state, this.memory, r.config.id),
        knowledge: marketKnowledge(w, r.state, r.config.id === 'mabel'),
        agenda: decisionAgenda(r.state),
        experiences: r.state.experiences,
        lessons: r.state.experiences?.slice(-3).map((e) => ({ ...e, goal: e.goal.slice(0, 180) })),
        careerPreference: r.config.preference,
        homeWorldRole: r.config.homeWorldOnly
          ? {
              world: r.config.world,
              rule: 'Remain in this world. Help neighbours and follow through on your founded town: establish viable businesses, finish sites and organise supplies and staffing. Earn and train as needed; protect living and operating reserves. Space travel is unavailable.',
            }
          : undefined,
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
              parishSurvey: parishSurvey(knownWorld, p),
              farming: farmerSituation(knownWorld, p),
              vocation: r.config.vocation,
              enduringGoal: r.config.initialGoal,
            }
          : {}),
      },
    });
    const { gameGuide: _guide, ...decisionObservation } = request.observation;
    let decisionRequest =
      r.config.provider === 'jev'
        ? {
            instructions: jevInstructions + '\nYour personality: ' + r.state.personality,
            observation: {
              ...decisionObservation,
              career: r.state.career,
              ambition: r.state.ambition,
              projectHistory: r.state.projectHistory,
              household: householdBudget(knownWorld, p),
              prosperity: prosperityBriefing(knownWorld, p, decisionObservation.choices),
            },
          }
        : request;
    if (!chatOnly && r.brain.prepare) {
      try {
        decisionRequest = r.brain.prepare(decisionRequest) as typeof decisionRequest;
        const warnings = (decisionRequest.observation as Record<string, unknown>).planningWarnings;
        if (Array.isArray(warnings) && warnings.length)
          this.checkpoint(r, w, 'planning-warning', { rejected: warnings });
      } catch (error) {
        // No reservation, transport, or paid retry for invalid local context.
        r.cooldown = now + 300000;
        r.state.plannerRetryAt = r.cooldown;
        r.wake = false;
        r.state.needsDecision = false;
        r.state.status = 'Gameplay context unavailable; continuing local routines';
        this.checkpoint(r, w, 'local-planning-error', {
          message: 'Gameplay request rejected before transport; no charge',
          reason:
            error instanceof LocalRequestError ? error.message : 'Unknown local validation failure',
        });
        return;
      }
    }
    const bytes =
      Buffer.byteLength(
        ('preparedBody' in decisionRequest
          ? (decisionRequest.preparedBody as string)
          : undefined) ?? JSON.stringify(decisionRequest),
      ) + (r.config.provider === 'jev' ? 0 : Buffer.byteLength(JSON.stringify(turnTool)));
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
      r.state.plannerRetryAt = r.cooldown;
      r.wake = false;
      r.state.needsDecision = false;
      r.state.status = 'Continuing local work; planning budget unavailable';
      this.checkpoint(r, w);
      return;
    }
    const prior = r.state.evaluation;
    if (
      prior &&
      !chatOnly &&
      w.time > prior.time &&
      (snapshot.liquidCapital !== prior.liquidCapital ||
        snapshot.netAssets !== prior.netAssets ||
        p.health !== prior.health ||
        snapshot.job !== prior.job ||
        JSON.stringify(p.inventory) !== JSON.stringify(prior.inventory))
    ) {
      const result = {
        goal: r.state.intent,
        elapsedSeconds: Math.max(0, w.time - prior.time),
        ...(prior.netAssets !== undefined
          ? { netAssetChange: snapshot.netAssets - prior.netAssets }
          : {}),
        cashChange: p.cash - prior.cash,
        ...(prior.liquidCapital !== undefined
          ? { liquidCapitalChange: snapshot.liquidCapital - prior.liquidCapital }
          : {}),
        bankChange: p.bank - prior.bank,
        healthChange: p.health - prior.health,
        previousJob: prior.job,
        currentJob: p.job ?? null,
      };
      r.state.experiences = [...(r.state.experiences ?? []), result].slice(-8);
      this.memory.append(r.config.id, w.time, 'evaluation', result);
    }
    if (!chatOnly) r.state.evaluation = snapshot;
    r.lastCall = now;
    r.wake = false;
    r.state.needsDecision = false;
    r.state.pending = true;
    const replyTo = r.state.replyTo;
    const conversationAtStart = request.observation.currentConversation;
    const discardDismissedChat = () => {
      if (!chatWasDismissed(r.state, w.id, conversationAtStart?.id, replyTo)) return false;
      r.state.pending = false;
      if (!chatOnly) {
        r.wake = true;
        r.state.needsDecision = true;
      }
      const current = this.worlds.get(r.state.world);
      if (current) this.checkpoint(r, current);
      return true;
    };
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
            tradeQuotes: localChoice.tradeQuotes,
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
        if (discardDismissedChat()) return;
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
                  'chat',
                )
              : undefined;
          if (chatReservation !== undefined) {
            const count = (attempt?.attempts ?? 0) + 1;
            r.state.dialogueAttempt = {
              key: conversationKey!,
              attempts: count,
              deferrals: attempt?.deferrals ?? 0,
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
              if (discardDismissedChat()) return;
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
              if (discardDismissedChat()) return;
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
            const deferrals = (attempt?.deferrals ?? 0) + 1;
            const exhausted = deferrals >= 3;
            r.state.dialogueAttempt = {
              key: conversationKey!,
              attempts: attempt?.attempts ?? 0,
              nextAt: Date.now() + (deferrals === 1 ? 60000 : 300000),
              done: exhausted,
              deferrals,
            };
            const noticeKey = `${conversationKey!}:${exhausted ? 'expired' : 'waiting'}`;
            if (conversation.speakerId && r.state.dialogueNoticeKey !== noticeKey) {
              say(
                latest,
                'AI notice',
                exhausted
                  ? `${r.state.name} cannot reply right now. Please try again later.`
                  : `${r.state.name} received your message, but conversation is waiting for the shared AI budget.`,
                'system',
                conversation.speakerId,
              );
              r.state.dialogueNoticeKey = noticeKey;
            }
            this.checkpoint(r, latest, 'dialogue-budget', {
              message: exhausted
                ? 'Conversation expired after three admission refusals; no model call was made.'
                : 'Conversation deferred by shared budget or context limit.',
              deferrals,
            });
            if (exhausted && r.state.conversationId === request.observation.currentConversation?.id)
              r.state.helpQuestion = undefined;
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
        if (discardDismissedChat() || discardStaleReply(latest)) return;
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
          const known = perceivedWorld(latest, player, r.state, r.config.id === 'mabel');
          const reason =
            !proposal.cancel && proposal.business
              ? businessRequestBlocker(known, player, proposal.business)
              : !proposal.cancel && proposal.delivery
                ? deliveryBlocker(
                    known,
                    player,
                    proposal.delivery,
                    proposal.delivery.quantity,
                    true,
                    true,
                  )
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
            refreshEmployment(known, player, r.state);
            const queued = r.state.commitments?.find((c) => c.id === conversationKey);
            if (queued?.status === 'blocked') queued.blockedNoticeSent = true;
          }
          if (
            proposal.delivery ||
            proposal.employment ||
            proposal.business ||
            proposal.cancel ||
            !recorded
          ) {
            const text = reason
              ? `I need to correct that before agreeing: ${reason} I have not accepted this request.`
              : !recorded
                ? !proposal.delivery &&
                  !proposal.employment &&
                  !proposal.business &&
                  !proposal.cancel
                  ? 'I cannot take on that errand yet. I can agree to deliver goods, train and take a job, or change prices and withdraw surplus at my own business. Which of those did you have in mind?'
                  : 'I have not added a new agreement: it is already recorded, there is no matching request to cancel, or my four unfinished requests need attention first. Please ask about my existing agreements.'
                : proposal.cancel
                  ? 'I have cancelled your latest unfinished request.'
                  : proposal.business
                    ? 'I have recorded the business change. I still need to visit and carry it out, preserving operating reserves and investor claims. No cash has been withdrawn or prices changed yet.'
                    : proposal.employment
                      ? `I have agreed to ${proposal.employment.train ? 'learn the required skill if needed and ' : ''}take the job at ${latest.buildings.find((b) => b.id === proposal.employment!.building)?.name ?? 'the requested workplace'}. ${employmentBlocker(known, player, proposal.employment) ?? 'I need to fit this around keeping myself fed, watered and rested.'} That is my agreement, not a report of finished training or a job change.`
                      : `I currently have access to ${proposal.delivery!.quantity} ${proposal.delivery!.item}, and will check the buyer’s price, investment and storage on arrival. I have recorded your delivery request at a minimum of ${proposal.delivery!.unitPrice / 100}d per item before tax. It still needs to be planned and carried out, possibly in several loads; nothing has been delivered on this request yet.`;
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
                text: 'I spoke too soon: I have not taken on a new errand. Tell me which workplace you mean for a job or training, which goods and destination for a delivery, or which business and reserve or price to change, so we can agree on the details.',
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
        if (discardDismissedChat() || discardStaleReply(finalWorld)) return;
        this.accept(
          r,
          finalWorld,
          result,
          Date.now(),
          replyTo,
          chatOnly,
          chatOnly ? undefined : opportunityCounts(decisionRequest.observation.choices ?? []),
        );
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
        if (reservation !== undefined) {
          if (e instanceof LocalRequestError) this.budget.notSent(reservation);
          else this.budget.failed(reservation);
        }
        r.state.pending = false;
        r.wake = false;
        r.state.needsDecision = false;
        r.active = false;
        r.state.errors++;
        r.state.status = 'AI unavailable; continuing local work';
        r.cooldown = Date.now() + Math.min(300000, 15000 * 2 ** Math.min(r.state.errors, 4));
        r.state.plannerRetryAt = r.cooldown;
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
        this.pumpPlanner();
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
    if (
      !r.dialogue ||
      signal.aborted ||
      this.closed ||
      chatWasDismissed(r.state, w.id, conversation.id, replyTo)
    )
      return;
    const p = w.players[r.state.playerId];
    if (!p || !p.online) return;
    const observation = conversationView(
      observe(
        perceivedWorld(w, p, r.state, r.config.id === 'mabel'),
        p,
        r.state,
        this.memory,
        r.config.id,
      ),
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
      'chat',
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
    available?: ReturnType<typeof opportunityCounts>,
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
      // An asynchronous planner may have selected before a neighbour announced
      // the same errand. Recheck on acceptance rather than issuing duplicate trips.
      const goal = result.supplyGoal;
      const player = w.players[r.state.playerId];
      if (
        goal &&
        player &&
        !r.state.supplyGoal &&
        secondsToDamage(w, player) > 1800 &&
        anotherSupplier(w, player, goal.building, goal.item)
      ) {
        r.state.plan = [];
        r.state.nextAt = now + 30000;
        r.state.until = r.state.nextAt;
        r.wake = false;
        this.checkpoint(r, w, 'supply-deferred', { building: goal.building, item: goal.item });
        return;
      }
      const construct = d.plan.find((s) => s.kind === 'operation' && s.operation === 'construct');
      const foundingKind =
        construct && construct.kind === 'operation'
          ? construct.parameters.find((x) => x.name === 'kind')?.value
          : undefined;
      if (
        typeof foundingKind === 'string' &&
        player &&
        secondsToDamage(w, player) > 1800 &&
        anotherFounding(w, player, foundingKind)
      ) {
        r.state.plan = [];
        r.state.nextAt = now + 30000;
        r.state.until = r.state.nextAt;
        r.wake = false;
        this.checkpoint(r, w, 'supply-deferred', { kind: foundingKind });
        return;
      }
      if (typeof foundingKind === 'string' && player) {
        const item = Object.keys(kindRecipe(w, foundingKind)?.outputs ?? {})[0] ?? foundingKind;
        publishFoundingIntent(w, player, foundingKind, item);
      }
      delete r.state.plannerRetryAt;
      r.state.strategyReviewedAt = w.time;
      if (result.supplyGoal) r.state.supplyGoal = result.supplyGoal;
      if (result.ambition) r.state.ambition = result.ambition;
      if (result.careerGoal && player) startCareer(w, player, r.state, result.careerGoal);
      if (player)
        r.state.tradeQuotes =
          result.tradeQuotes ??
          planQuotes(perceivedWorld(w, player, r.state, r.config.id === 'mabel'), d.plan);
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
      available,
      selection: result.selection,
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
  /** Experiment barrier: dispatch queued work, without awaiting model results.
   * Normal server scheduling is unchanged. Deferred results can then arrive on
   * an evaluator's virtual clock while the ordinary controller keeps ticking. */
  async dispatched() {
    while (!this.closed && (this.planning || this.planTimer))
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  async settled() {
    while (!this.closed && (this.planQueue.length || this.planning || this.planTimer))
      await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.all(this.residents.map((r) => r.pending));
  }
  close() {
    this.closed = true;
    if (this.planTimer) clearTimeout(this.planTimer);
    this.planTimer = undefined;
    this.planning = false;
    for (const item of this.planQueue) item.resident.queued = false;
    this.planQueue.length = 0;
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
