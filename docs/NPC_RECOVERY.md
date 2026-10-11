# NPC recovery implementation and handoff

Status: release 0.60.0, following the 2026-10-10 audit of `ae97603`.
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
