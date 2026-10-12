# NPC recovery implementation and handoff

Historical baseline: release 0.60.0, following the 2026-10-10 audit of `ae97603`.
Current work and remaining proof gates are recorded at the end of this handoff.
**Latest: the paid baseline was stopped at the user’s request; it is not running.**
Deploy to nogits.com using the documented backup/build/restart procedure. No world
reset or economic bailout is included. Human deliveries and investments in the
historical snapshots must not be counted as autonomous NPC recovery.

## Implemented

- **Execution:** fix the real scheduled-session gate; walk when stranded without
  fuel, including during an accepted journey; allow longer countryside walks and escape newly constructed footprints; enforce recovery delays across local
  routines and avoid recording the same blocked attempt every tick.
- **Households:** use actual full pantry nutrition; reserve food/drink/rent money and a fuel purchase when low;
  retrieve personal provisions from expired rooms; unload excess provisions or freight blocking meals;
  remain at home when no further affordable departure errand is available.
  Bound fishing and portable reserves; sell/store surplus fish. Empty-tank cargo
  recovery unloads locally or discards only enough surplus for walking, preserving
  tools and emergency meals through ordinary player actions.
- **Careers:** persistent gathering, hauling, training/employment and property
  projects. Gatherers can acquire the correct tool and sell the resulting load.
  Continuation checks observed stock, quotes, capacity, capital and skills again.
  Interrupted plans survive normal overnight absences; death invalidates them.
  Construction budgets include materials, tax, operating cash and living costs;
  accepted projects procure and deliver materials until complete.
- **Businesses:** include retail tax in profitability estimates; avoid redundant
  factory shifts; replenish owned tills and return exported output receipts;
  constrain experimental wage rises to affordable positive margins. Cash-poor owners
  can draw surplus business cash for household/cottage savings without spending
  operating reserves or investor claims.
- **Farming:** rank funded input shortages against existing stocks and crops
  already planted, while preserving seasons, capacity and rotation constraints. Farm owners can fund seasonal plots, learn the skill, tend them and
  return exported crop receipts to the till.
- **Planner reliability:** cap earned stake withdrawals to the action limit;
  isolate malformed choices; retain safe schema diagnostics. Mabel's captured
  256d collection exceeded the 100d action limit and poisoned her previous menu.
- **Fairness:** ordinary NPC employers use remembered quotes; Mabel retains the
  public-market guide privilege. Private guest stores remain private.

## Verification

Regression coverage includes real session initialization, penniless empty-tank
recovery through the controller, pantry consumption, reserves, staffing, till
reinvestment, ordinary tool/gather/sale actions, restarts, depleted suppliers,
changed prices, crop shortages and malformed planning candidates.

The saved audit export was replayed locally: all 19 residents' generated menus
validated after the stake-collection fix. No provider request was sent. The export
and raw production data remain outside the repository.

The offline soak command and its limits are documented in [NPCs](NPCS.md#household-and-career-recovery).
It is a diagnostic test driver, not evidence that Jev can now sustain a whole town.
Completed local checks:

- `npm run check`: TypeScript passed and all 651 tests passed.
- The generic food-reserve adjustment passes all eight career regressions.
  Evaluator reporting passes TypeScript and a short smoke run; planner cue changes
  pass candidate validation and the saved 19-resident menu replay.
- `npm run build`: passed; existing bundle-size and third-party annotation warnings remain.
- Tracked and new implementation files pass Prettier and whitespace checks; unrelated local snapshot exports remain untouched.
- Chromium inventory discard/walking/tractor regression: passed on a disposable instance.
- The short 2.4-hour controller run had no failures or deaths; only the always-online
  resident had arrived in that window. This is not population-level evidence.
- The initial corrected full-day integration run exposed a builder trapped inside its
  own new footprint: 124 route failures followed by dehydration despite having cash.
  This was reproduced and fixed with a physics regression.
- The rerun ended with no deaths, full health and valid shelter for all four residents;
  three built cottages. There were 7 recoverable failures and 393 deterministic
  decisions. Three net-asset changes remained negative after setup and consumption;
  the farm had no wheat. This is not proof of long-run profitability.
- The subsequent 48-hour run still had zero deaths and four valid homes, but
  accumulated 118 failures. Mabel ended with 141 fish, no fuel and too much cargo
  to walk; zero deaths at the cutoff therefore did **not** mean recovery passed.
  The new controller regression reproduces that load and walks to obtain a drink
  without API calls, grants or teleportation. Fishing and unloading now prevent
  the same buildup. The fresh 48-hour run included fishing/cargo and farm-owner fixes. Its
  24-hour checkpoint showed no deaths, productive crops and 22 recoverable
  failures, but one asset-rich resident still lacked cash and a valid home. This
  prompted the protected owner-draw rule. The completed 48-hour run had 959
  deterministic decisions, zero deaths, full health, three valid homes and 32
  failures (19 insufficient business investment, three empty-fuel movement,
  three journey timeouts, four changing farm plots, one depleted stock, one route
  failure and one competing worker). The fish/cargo retry loops did not recur.
  The mill ended with 116 wheat but 157 cash units and no flour; the farm had 499
  wheat. Two residents had zero or near-zero liquid cash. These are still cash-flow
  and production-chain warnings, not a passing self-sufficiency result.
- The protected owner draw, explicit low-fuel cash allowance, generic food reserves
  and expanded reporting were added after that soak started. All have regression
  coverage. A one-hour continuation from its captured state, using wait-only
  strategic choices to exercise local upkeep, had no failures or deaths. The farm
  owner moved from 4,201 to 24,015 personal cash units while retaining protected
  farm capital; this is an internal transfer, not newly generated income.
- No seven-day live/model canary has run. Positive median savings, sustained local
  production and the intended attendance budget remain explicit evaluation gates.

The soak harness uses 100 ms physics steps and follows transactional world replacements.
Coarse-step runs or runs advancing a stale rollback object are invalid evidence and
must be discarded.

## Release and deployment handoff

Release groups: ordinary-player cargo disposal, NPC execution/household/career
policy, and evaluation/reporting. Pre-existing snapshot documents remain separate.
The deployment script verifies the public version and base-path assets; retain
its pre-deploy backup. Service health is not evidence of economic recovery.

Before calling the whole economy recovered, run the updated evaluator for seven
or more days with nineteen residents and varied seeds, then a bounded actual-Jev
canary. The deterministic chooser is useful for integration defects but cannot
establish model judgment. In particular, verify mill capitalization/throughput,
owner savings for housing and the affordability of short employee visits; tune
underlying economics only if feasible diversified careers still cannot pay living
costs. Do not count high catalogue-valued farm stocks as spendable wealth.

After deployment, compare a period without human rescue against the audited
baseline: deaths, starvation exposure, valid stocked homes, net assets, completed
resource/trade loops, production interruptions, till solvency, duplicate staffing,
API calls and repeated failures. Credit stock/cash injections to their actual
human or NPC source. Observe a limited population before enabling broader changes.
A passing test suite is not a guarantee of sustained production profitability.

## Staffing follow-up: 0.61.0

Automatic producers now have ideal active crew sizes, with slower production on
both sides of the ideal. Released in 0.61.0, following the 0.60.0 recovery baseline
described above. NPC shift selection and workplace
observations use the new curve. Seasonal farms retain manual plots.

Validation: 657 tests, TypeScript, build and the browser staffing display check
passed. The browser confirmed 50% → 100% → 67% for one, two and three active
millers. Fractional progress survives save/load and different tick sizes.

Repeat the economic baseline with these rules before comparing later soaks:
default one-worker price margins do not establish profitability at ideal staffing.
A solo miller now completes a batch every two checks; two millers complete it every
check but draw two wages. Existing owner prices and wages have not been changed.
No new long-running economy soak has yet measured this staffing policy.

## Next proof of economic stability

1. **Capture the release baseline.** Retain the pre-deploy SQLite backup and record
   the release SHA, world time, settings, provider models and budget caps. At the
   next audit, capture actual resident/till balances, jobs, valid shelter and pantry
   coverage. Annotate every human delivery, investment or administrative change;
   a window with a rescue cannot establish autonomous recovery.
2. **Prove the arithmetic.** Price complete gathering, trading, employment and
   ownership careers from observed quotes. Include fuel, tools, taxes, payroll,
   rent and a full day of offline consumption. Compare scheduled daily minutes
   with the income needed to survive. A 35-minute visit cannot be called viable
   just because its first few shifts pay wages. Inspect mill funding and margins,
   owner household liquidity and employee living costs first. Change one policy
   or balance parameter at a time and retain before/after fixtures.
3. **Extend offline evaluation.** First rerun four residents for 48 hours on the
   released rules, then run 19 residents for seven days at seeds 1, 2 and 3. Extend
   passing cases to 14 days. These are real-time-equivalent days of advancing world
   time, not seven calendar days in the accelerated game. Use both a fresh start
   and a sanitized copy of the damaged parish; the current command creates fresh
   worlds, so saved-fixture loading still needs implementation. Preserve normal
   knowledge limits, schedules, needs and physical travel. Keep the halfway restart.
4. **Stress the supply chain.** Add repeatable shortage cases: empty pump fuel,
   mill wheat/till shortages, full export stock, expired lodging, empty fuel with
   heavy cargo, a failed investment, price changes and competing workers. Report
   the cause, first useful action and recovery time. Neither resets nor free
   resources count as recovery. Also test provider outages and exhausted budgets.
5. **Test actual Jev choices.** After mechanical gates pass, use an isolated,
   sanitized world with four residents for 48 hours and a hard run-wide spending
   cap, then 19 for seven days. Preserve existing daily/monthly caps and record
   calls/tokens/cost estimates separately from provider invoices. Add durable
   fixture/resume support and per-run budget enforcement before starting this
   paid test. Accelerate simulation, not provider rate limits; cache/replay prior
   decisions only for deterministic regressions, never as fresh-model evidence.
6. **Validate on nogits.com.** Observe the already-configured population rather
   than silently disabling existing residents. Take read-only checkpoints at
   24 hours, 72 hours and seven days, with interval metrics between checkpoints.
   Test chat commitments separately. If users keep playing, use the isolated
   canary for controlled no-rescue evidence and label the live run observational.
   No recurring collection has been scheduled by this release.

Proposed acceptance gates, evaluated after a 48-hour establishment period:

- Zero avoidable starvation/dehydration deaths when necessities can be obtained.
  Every resident has valid shelter with coverage through the next planned absence,
  or an explicitly measured viable temporary survival plan.
- Local food and water are purchasable for at least 95% of sampled time; government
  and imported supply are counted separately. Report outage duration and recovery
  time, not only end-of-run stock totals.
- Positive median household savings over seven days, with every resident's liquid
  reserve, debt and survival coverage reported. Separate transfers, loan proceeds,
  gifts and catalogue-valued stock from earned income. No resident may hide a
  continuing cash drain behind an increasing inventory valuation.
- Core farm → mill → bakery and fuel → pump → household chains pay input, payroll
  and tax costs from actual sales, replenish operating cash and survive several
  interruptions. Distinguish retained capital from money available to withdraw.
- No unbounded repeats of an unchanged failing action. Record failures per 100
  attempts, maximum identical-failure streak and time blocked; target no more than
  three retries before a different recovery step or explicit backoff.
- Demonstrated successful gathering, hauling, employment and ownership paths
  across seeds, without omniscient shop access or fixed forced roles. Measure
  scheduled/welfare online time and model cost per surviving resident-day.

The evaluator already reports deaths, shelter, assets/liquidity, action failures,
local supply samples, online time and money-flow reasons. Saved-fixture input,
complete cost-basis accounting, continuous live sampling and paid-canary budgeting
are **next work**, not implemented reporting guarantees. Baseline and experiment
outputs must include code/config/seed/time range and remain outside public source
when they contain live player data. If a deployment regression threatens saves or
causes a retry storm, preserve diagnostics and stop the affected experiment; use
code rollback only after checking compatibility, and never restore an old database
over newer player progress without an explicit recovery decision.

## 2026-10-11 continuation — unreleased prosperity work

Winter farming is complete: **0.63.4 / `8bcbb1a`** was pushed and deployed to
nogits.com, with health/base-path asset checks. All 684 release tests and the
winter/spring browser test passed. The changes below are local, not deployed.

Read-only production evidence showed 433 local planner-size failures in the last
24 hours (278 Mabel), mostly repeated employment careers, and only two NPC-owned
operating businesses despite several large personal cash balances. Historical
human rescues remain a confounder. The old 44,000 engine/refuel errors were mostly
outside the recent six-hour window; they are not evidence of a current retry storm.
Puddlewick's removed council model also left its town inaccessible to NPC civic plans.

Implemented for release 0.64.0:

- Shortened Jev instructions and bounded optional memory under the existing 24KB
  request limit, without increasing token allowances. All 19 captured resident
  requests replay successfully, including the new prosperity briefing.
- Staggered career reviews after completed errands (25–35 minutes; employee
  preference 45–55), with no added chat calls. Routine shifts cannot replace an
  accepted errand. Existing survival priorities and provider budgets remain.
- Own-account visibility, protected surplus withdrawals, internal business stock
  transfers, full-crew reserves and starter-animal construction costs. Sales
  receipts remain distinct from transfers and unsold inventory value.
- Bounded construction search across actual map dimensions; conditional extra
  capacity where an existing owned producer has sales and observed funded buyers
  remain short. Career menus retain construction, acquisition, livestock, farm
  expansion and civic alternatives. None is a prescribed career assignment.
- Optional distant-town founding for securely housed, well-capitalized owners;
  normal charter charges and permissions apply. Public town-centre access works
  for humans and NPCs without recreating removed council buildings.
- Evaluator accepts 21 days and a wall-time limit, reports acceleration, incomplete
  runs, holdings and governance. It still substitutes heuristic choices for Jev.

Validation so far: full TypeScript/unit check passed **695 tests**; the subsequent
controller regression also passes within the nine-test prosperity group. A bounded
19-resident configuration advanced **2.806 hours in 45.03 seconds (224×)**, 35
heuristic decisions, zero deaths and zero local planning errors. Only Mabel had arrived in this early scheduled-attendance window; this is a throughput smoke test, not an
economy success result or a reliable extrapolation to 21 days. No paid model
calls, production mutations, reset or economic grants were made.

Still required: longer 19-resident comparisons, damaged-world fixture input,
durable evaluator resume, fully seeded replay, aggregate paid-test caps and an
actual-Jev accelerated canary with real provider throttling and simulated response
latency. Growth actions existing in a menu do not prove models will choose them
well. Track individual survival, liquidity, household coverage, production,
imports, failures, new businesses and town participation over repeated runs.
Keep the earlier acceptance gates; do not call the circular economy proven yet.

When committing is requested, separate planner request reliability, NPC growth
policy, public town-centre access and evaluator tooling into logical commits.
Preserve the three pre-existing untracked NPC snapshot documents. The production build and formatting/whitespace checks also passed. This work has
not been committed, pushed or deployed; only the winter release has.

## 2026-10-11 actual-Jev four-day experiment — running

The user authorized the normal Jev spending of four real-time days, accelerated.
Read-only production accounting showed 4,726 Jev requests, 40,851,892 input tokens
and $1.7178987 accounted over the preceding four days. Production's configured
budget is $2.40/day and $20/month (local `.env` still defaults to $0.60/day).
The experiment preserves the **production** budgets and adds a $9.60 whole-run
ceiling; Jev 1.13.0 costs $0.042/million input tokens, output free.

Implemented `scripts/npc-canary.ts`, a read-only snapshot export helper, and
`CanarySpend`/`CanaryClock`. Unit checks cover concurrent reservations, durable
charges, cancellation, rate-limit stop and virtual delivery latency; all 13
canary/prosperity checks and the complete 700-test TypeScript/unit check passed. Source and configuration fingerprints prevent
mixing policy revisions within an experiment. No production changes were made.

Private source and results: `/tmp/aclone-four-day-jev/`; source captured at
1791759810003 Unix milliseconds. All three worlds and 19 existing NPCs are included.
The initial 60-second wall-time segment advanced 0.4416667 normal hours, made
56 real requests costing $0.021014406, and recorded no deaths. It stopped cleanly
and was resumed with identical inputs/code. This is **not the four-day result**.
Follow `/tmp/aclone-four-day-jev/continuation.log` and `run/report.json`.
World state and NPC memory stay private; do not commit the snapshot/database.

Pending: finish the 96-hour run, analyze deaths and costs per resident, useful
production and new holdings, update the analysis canvas and record remaining
failure modes. The simulation excludes human chat, scripts and rendering/network
load; existing human investments in the snapshot remain a confounder. A single
run is not proof of a self-sustaining circular economy. Nothing in this new work
has been committed, pushed or deployed.

Progress view: `/home/henry/.cursor/projects/home-henry-dev-Aclone/canvases/npc-four-day-jev.canvas.tsx`.
The private renderer `/tmp/aclone-four-day-jev/render.py --watch` refreshes it from
checkpoints without network calls. Its own TypeScript diagnostics are clear
(the workspace contains unrelated pre-existing canvas key-prop diagnostics).
At 2.69 simulated hours: no NPC deaths, local basic food/water in every sample,
Mabel acquired the quarry (the waterworks was already hers), and spending was approximately $0.105. This is an
early observation only; leave the running policy frozen through completion.

The four-day canvas now reports successful construction starts, completed new
buildings, unfinished sites and purchases separately, including per-NPC actions.
It reads the same durable checkpoint and excludes journal entries imported from
before the test. At roughly 31 simulated hours: **0 starts, 0 new completions,
4 existing-property purchases** (Mabel: quarry; Oscar: house; Toby: stonemason;
Arthur: cottage). The earlier note that Mabel acquired the waterworks was wrong:
she owned it in the starting snapshot; her new purchase was the quarry.
This is a reporting-only change; the running simulation code remains frozen.

## 2026-10-11 interim actual-Jev diagnosis — 34.69 hours

Analysis uses a frozen copy at `/tmp/aclone-four-day-jev/interim-analysis/snapshot.sqlite`
and the matching starting snapshot. Journal IDs >502600 exclude imported history.
The paid run continues unchanged; no new code fixes, commit, push or deployment
were performed for this analysis. The results canvas renderer now preserves this
fixed interim analysis beside the independently updating checkpoint totals.

**Confirmed execution failure:** Mabel selected free custom vehicle slot 8 at
hour 3.54. `navigation.ts` only supports slots 0 and 5; the automatic transport
repair does not normalize slot 8. She incurred 236 ground-navigation failures,
died of dehydration twice and retained the unusable slot through respawn.
Prioritize capability validation, immediate safe transport recovery and a
cross-destination repeated-failure escape, with survival/respawn regression tests.

**Housing and investment are stalled:** zero new starts/completions; five
existing-property purchases; only five of 19 have a household. Toby holds
39,385.93d cash while a known-material cottage plus reserve costs 1,502.99d.
Read-only candidate replay offers him construction: missing materials or
insufficient money are NOT sufficient explanations at this checkpoint. He chose
100d bakery withdrawals 101 times among 338 decisions. Add persistent projects,
meaningful milestones and purpose-linked draws; avoid six cottage-style choices
competing before deciding whether to establish a home. Historical request menus
are not recorded, so this replay does not prove which choices reached every call.

**Incentives are misaligned:** 1,494 public labour tasks paid 67,230d versus
9,786.60d ordinary business wages and 396d harvest wages. Labour pays 45d/15s;
bakery employment pays 22d gross per completed 600s batch (employment can overlap
other activities). Balance the fallback without removing emergency survival.
At current waterworks quotes, a 12-water batch yields 69.74d after sales tax,
against 36d fuel and 44d ideal-crew wages: -10.26d even before dearer replacement
fuel. Evaluate and set prices using full staffing, efficiency and actual inputs.

**Private wealth is not business solvency:** bakery operating cash flow is
-530.24d, net capital withdrawals 4,277.47d, till 4,844.23d -> 36.52d.
Waterworks operating cash flow -2,705.39d with 4,233.64d capital injections.
These are cash-flow deltas, not accrual profit: unsold inputs/output and personal
exports require separate attribution. Preserve operating reserves and connect
owner exports to business funding rather than only personal cash growth.

**External trade is consuming reserves:** spaceport till 22,683d -> 13.22d;
water stock reached 500. NPCs bought 215 government fuel for 8,997.75d; no refinery
was built. Review export clearance/funding and observed shortage-driven investment.
Do not mistake selling to a seeded finite treasury for a sustainable export loop.

**Repetition / attendance:** 121 work attempts failed because another worker
covered the cycle. Rowan chose bakery employment plans 250 times. Unsheltered
residents return frequently (18 new Toby sessions, 19 Rowan, 25 Ada in this period).
Use staffing rechecks, state-change retries and goal persistence; monitor useful
outcomes per paid decision rather than simply increasing model spending.

Encouraging: 87 mill, 174 bakery and 57 waterworks batches, with local food/water
available in every minute sample, without new human interventions. This is not
a stable circular-economy verdict. Finish the 96h baseline, then test isolated
fixes against matched starting conditions. Measure construction completions,
stocked households, operating margins/runway, export funding, public grants,
imports, decision churn and civic participation. Do not change the running
policy mid-experiment. No additional paid calls were used for the local replay.

## 2026-10-11 stopped baseline and economy repair (unreleased)

The user stopped the experiment to implement the findings. Final checkpoint:
**41.8917 of 96 normal-equivalent hours; 4,210 requests; $1.585985 estimated Jev
spend; 37,761,547 input and 2,219,526 output tokens.** It ended with three Mabel
deaths, zero new construction and five existing-property purchases. Earlier
“continue/finish the frozen baseline” instructions above are superseded.

The local process and canvas watcher were stopped gracefully. A durable private
copy of the original source, frozen code, report, checkpoint, paid-call ledger and
interim analysis is at `var/experiments/jev-baseline-2026-10-11/` (gitignored).
Do not publish these snapshots or rerun that directory against modified rules.
Production was not touched and no replacement paid experiment was started.

Implemented for release 0.64.0:

- Unsupported vehicles normalize to tractor/walking before planning; surplus
  freight can be unloaded through normal trade/storage/discard actions first.
- One cottage candidate per resident, continuation for accepted home/building
  construction projects, periodic review for completed businesses, and fewer
  redundant employment candidates. Reserves and acquisition estimates include
  the ideal crew rather than a single worker.
- Growth draws target a costed shortfall rather than repeated small withdrawals.
  Business cargo records actual owner-export proceeds through care interruptions
  and saves, with ordinary deposits returning funds to operating tills.
- Bank and investment limits are 10,000,000 internal money units (100,000d).
  Player trades retain a separate 10,000-item bound; NPC farm loads no longer have the derived 100d sale-value ceiling.
- Default production and retail chains cover full payroll, input hauling and
  taxes. Pump fuel bids cover initial public imports; hay storage connects to
  livestock buyers. One-time Puddlewick price/wage migration explicitly includes
  existing human/NPC businesses, preserving ownership, cash and stock. New worlds
  already carry the migration marker, so later owner changes are not overwritten.
- Treasury ports sell bounded real surplus every 30 minutes, recording external
  revenue and freeing stock capacity. Essentials retain a shelf reserve; no
  stockless cash grants, custom-world exports or private-port bailouts.
- Normal public labour pays 1d/15s. Below 50d cash plus bank, a cooldown-limited
  relief shift pays a default premium meal-and-water allowance (150d). Reward is
  fixed at task start and cooldown survives reload/death. The UI and NPC guide
  explain the distinction.

Release 0.64.0 separates the cash-transfer repair, economy prices/shipments/relief,
NPC prosperity/execution and evaluator/reporting into logical commits. The user
has authorized pushing and deploying this release to nogits.com. The deployment
procedure takes a database backup and applies the pricing migration without
resetting the world. Uploaded assets must also be backed up if present.

Next proof gate: compare a **new run from the same starting snapshot**, with
migration applied once, against the stopped baseline over a matched horizon.
Use real Jev within the authorized normal four-day budget only when the user
resumes the experiment. Track new construction completions, stocked homes,
per-resident deaths, full-crew business cash flow excluding owner transfers,
public labour/relief grants, net import/export flows and useful outcomes per
paid decision. Then extend toward 96 hours. Prices and local tests establish
feasible paths, not that an AI population will choose them or remain stable.

Validation for this local revision: `npm run check` passed **717 tests** and
TypeScript; the production build passed. Changed-file Prettier and whitespace
checks passed. Regression coverage includes completed cottage construction via
ordinary paid deliveries, farm exports over 100d, full collection of earned
investment returns, full-crew margins, hay supply, persisted export departures,
one-time owned-price migration, household reserves and transport recovery.
The baseline results canvas was marked stopped and its TSX parses successfully.
The stopped experiment remains archived. Release deployment status should be
verified with the public health endpoint; no new paid experiment is running.
