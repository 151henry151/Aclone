# AI neighbours

Up to **19 optional residents** use Jev for gameplay; Mabel uses OpenAI for conversation and the others use Claude. Each has a stable identity, personality, property and persistent history. All obey ordinary costs, permissions, physics and survival. API billing is separate from ChatGPT/Claude subscriptions.

## Try it

NPCs are disabled by default. Keys alone do not enable them. In the server's private, gitignored `.env`:

```dotenv
NPC_ENABLED=true
JEV_API_KEY=your-server-typesafe-key
OPENAI_API_KEY=your-server-openai-key
NPC_MONTHLY_USD=20
NPC_DAILY_USD=0.60
# Optional additional residents:
NPC_BAKER_ENABLED=true
NPC_FARMER_ENABLED=true
NPC_INDEPENDENT_ENABLED=true
NPC_POPULATION_ENABLED=true
CLAUDE_API_KEY=your-server-anthropic-key
NPC_TIME_ZONE=America/New_York
```

Keep only the switches you want. Never use `VITE_` variables for secrets. Native startup does not automatically load `.env`:

```sh
node --env-file=.env --import tsx src/server/main.ts --dev
# Production, after building with your existing BASE_PATH:
node --env-file=.env --import tsx src/server/main.ts
```

A service may use its own environment-file setting. Compose forwards listed settings at runtime: `docker compose up --build -d`; keys are not build arguments. Preserve DATA_DIR and resident IDs. [Hosting](HOSTING.md) covers deployment.

Use **AI neighbours** for private chat, or name a resident in parish chat. AI badges remain visible. Replies take provider latency/cooldown and may be unavailable under budget caps or outages. Inspect actual results rather than trusting promises.

## Residents

Mabel Reed is a former mechanic; Toby Finch a keen baker; Rowan Field a farmer; Elias Vale an adaptable generalist. The population switch adds:

- **Traders:** Ada Mercer (careful margins), Felix Dunn (exploration), Iris Bell (conservative staples).
- **Business owners:** Beatrice Holt (operations), Oscar Pike (production chains), Nora Ash (guesthouse ambitions).
- **Gatherers:** Silas Moss (forestry), Hazel Flint (minerals), Jasper Brook (fishing/exploration).
- **Employees:** Edith Ward, Arthur Hale, Mina Shaw (qualifications and reliable long-term wages).
- **Farmers:** Clara Fen (rotation), Owen Marsh (crop/market experiments).
- **Generalist:** Lena Wren (career comparisons and leisure).

Interests are soft preferences, not career restrictions or guarantees of success.

## Presence and survival

Mabel stays online even alone unless paused or the service stops. Thinking, retries and exhausted budgets do not make active residents disappear. The other eighteen follow saved real-world schedules in `NPC_TIME_ZONE`, including DST, independently of accelerated game days or human visitors.

New neighbours usually visit 25–45 minutes; first visits last 2–3 hours. Subsequent visits have a 17–26% long-session chance (roughly once/twice weekly, not guaranteed). Toby/Rowan/Elias play 3× longer: about 100 minutes normally, 6–9 hours on long visits. Ada/Edith/Arthur are more predictable; Felix/Jasper/Lena more variable. Initial arrivals stagger over the next habitual day. Restarts preserve visits/expiry and do not replay first sessions; pre-existing pilots get an initial active visit when scheduling is introduced.

Five minutes before departure, local errands eat/drink, buy provisions, stock a home/room and travel inside; space visitors try to land. Affordable rooms may be booked. Preparation uses no AI calls and extends visits at most ten minutes. No shelter, poor stores, expiring rooms or urgent needs trigger 10–60-minute welfare returns (or an earlier regular visit). Welfare gameplay still uses shared budgets. Offline messages are retained but do not wake a resident; contact them again when online.

Offline hunger/thirst/starvation apply to everyone. Homes slow needs by 20%; stocked homes and unexpired room pantries feed residents. Empty stores can cause death and lost skills/estate consequences. Offline ageing and passive property decay pause. The AI panel/CLI reports return times.

## Continuity and conversation (0.22.0)

### Current character facts and retraining

Dialogue receives current skills, death count, job and study status before history. School courses are labelled available, not acquired. Live workplace wages distinguish gross per worker, net after tax and total payroll; drafts only apply after **Save details**. Factory pay is per completed batch, farm pay per harvested plot.

A request to train enables tuition/study if the skill is missing; existing qualifications skip school. Clarification replaces unfinished requests for the same person/workplace/world/channel. Retraining after losing all skills uses the ordinary 80d, one-minute first course. Chat grants nothing.

Summaries have life markers. Prior-life/unclassified notes stay on disk but are excluded from current summaries; recent channel history and preferences remain. Death invalidates pending plans/replies; changed skills/study/employment discard stale replies within call limits. Ordinary movement, needs and income do not trigger more chat. Old agreements are not rewritten: ask again with explicit training permission after upgrading.

### Scoped continuity

Each resident retains up to 64 person/world/channel summaries and 24 learned preferences. Empty summaries preserve notes. Public replies exclude private summaries, raw journals, mixed legacy notebooks and private agreements. Private replies receive that speaker's private context plus permitted public context. Models cannot relabel privacy scope.

Preferences cover employment, trading, gathering, farming, fishing, business, housing and leisure. They represent the character's considered inclinations, not blind obedience; descriptions do not expose private reasons. Survival and accepted obligations take precedence. No background reflection calls run.

Addressed chat gets the next available request slot, oldest call first, subject to current requests/cooldowns/shared caps. It does not build gameplay candidates or reset income-measurement windows. Ordinary conversation takes one call; an agreement may use one extra budgeted wording call after validation. That call cannot change the agreement. Saved factual fallback replies survive interruption without duplicating requests. A sole safe agreed next plan executes locally; competing agreements/survival/recovery can still need Jev.

## Agreements made in chat

Residents speak as one character, without naming providers or separate decision/chat machinery; AI badges and operator diagnostics remain. Replies distinguish intentions, queued requests and verified results.

Executable agreements are **deliveries**, **employment with optional training**, and cancellation of the requester's latest unfinished request. General goals remain guidance; other errands, loans and autonomous negotiation are not implemented. Up to four unfinished executable requests and twenty recent agreements are retained. Another player cannot cancel yours.

- **Delivery:** name item, amount, buyer and minimum posted price. For 118 wheat at 6d, the server records exact building/source IDs and price 600 internal units. Before accepting, it rechecks owned/carried stock for the whole quantity, buyer price, funding and capacity. Employees cannot take employer stock. Loading/travel/sales use normal capacity/taxes, with multiple trips if needed; each successful sale atomically advances progress. Execution rechecks price/conditions. Invalid requests get an explanation; a blocked existing request gets one saved, channel-matched notice when its requester is online, without another AI call. Timed work alone does not trigger a blockage notice.
- **Employment:** “learn milling and take the job at my mill” names a workplace. The server derives its current skill, tuition, available skill slots and vacancies. Plans visit school, pay, wait, travel and accept employment; the old job remains until arrival qualified. First study takes one minute, later courses forty. Completion means qualified active employment, not a finished batch or lifetime commitment. Restart preserves requests and courses.

Ready accepted requests outrank unrelated shopping/rest/cosmetics when healthy. Food, water, route cooldowns and departure still take precedence. Blocked requests retain reasons. A promise without a structured request cannot execute: a narrow first-person-promise check corrects common cases, but is not a general language executor. Legacy summary-only requests are marked blocked; ask again if no request was recorded.

## Chat routing

Residents respond to addressed humans, not routine activity or other NPCs. Public mentions receive public replies; private messages receive private replies. Routing follows the initiating channel, not the model's suggested recipient. Gameplay narration stays in journals.

Unnamed public follow-ups go to the same resident for two real minutes after the player's last turn. Naming another person, private messaging or multiple names clears that listener. Group mentions may get individual replies but do not create a group follow-up. Windows persist with original expiry and are bounded to 64 players/resident. These are deterministic name/time rules, not semantic intent recognition; routing makes no model calls. Up to eight recent channel turns accompany a reply; private turns never enter public history. Messages are limited to 1,200 characters.

## Shared planner and Elias configuration

The planner surveys skills, funded wages, shortages, prices, travel, property and recent cash/bank/health outcomes. Candidates cover ordinary economy, construction, housing, food, fishing, vehicles/paint, social/game/combat and space actions; no admin/editor/account management. Quantities/routes are bounded, not an exhaustive search or expert tactics. Estimates are distinct from receipts.

`NPC_JEV_MODEL=jev-1.13.0` defaults to accounting rates `NPC_JEV_INPUT_USD_PER_MILLION=0.042`, `NPC_JEV_OUTPUT_USD_PER_MILLION=0`. A custom model requires both rates. `TYPESAFE_API_KEY` takes precedence over `JEV_API_KEY`; create a key through the [TypeSafe console](https://console.typesafe.ai/).

Elias uses the `NPC_INDEPENDENT_` prefix: `ENABLED`, `ID` (elias), `NAME` (Elias Vale), `WORLD` (inherits NPC_WORLD), `PERSONALITY`, `INTERVAL_MS` (15000), legacy `ACTIVE_ALONE` (false), `CHAT_MODEL` (claude-haiku-4-5-20251001), `CHAT_INPUT_USD_PER_MILLION` / `CHAT_OUTPUT_USD_PER_MILLION` (1 / 5). Compose forwards these settings.

### Survival and economic decisions (0.19.2)

Each decision has a protected `life` briefing: outdoor time to starvation without eating, effective servings/repeat-food penalties, provisions, cheap/near stocked sources, living-cash reserve, job wages/skills/blockers and the last three outcomes. Broader surveys may be trimmed; null survival time means no rising needs, not immunity. Shelter/room expiry are assessed separately.

Needs crossing 25,000 or danger within ten minutes wakes planning once; stocked shelter can feed safely without waking Jev. Urgent errands buy/eat in one plan. Optional sales, factory deposits and watering retain personal provisions; a comfortably fed resident may stock all supplies at home. Owners can buy/deposit inputs for their own business; workers neither own employer stock nor fund its inputs. Budgets, shortages, inaccessible shops and poor choices can still kill an NPC.

### How the providers cooperate

Jev chooses a validated supplied option ID, not dialogue. `adaptive.ts`, `farmer.ts`, `economy-choices.ts` and `space.ts` create candidates with category round-robin: up to 200 local options (~48 KB server-side) plus two optional spaceport plans. Executable steps stay on the server. The complete Jev request is limited to **24,000 UTF-8 bytes**: redundant context goes first, then descriptions shorten without removing choices; needs/commitments remain. Unknown IDs never execute; all conditions are rechecked.

Local code handles movement, bites, waits and shift renewal. Plans allow 12 steps, 30 repeats and up to 30 minutes. Durable experience compares actual results with goals; full history is searchable rather than loaded every turn.

OpenAI/Claude runs only for addressed conversation, using the strict `converse` vocabulary: speech, scoped notebook, preferences and optional request. Failed/capped chat does not stop gameplay. Failed calls retry after one minute, then five, at most three attempts/message, saved across restart; a new message may try again. Budget failure sends one private notice/question. Completed questions do not generate more calls after the optional agreement wording.

## Helping other players

Both chat providers receive complete [FAQ](FAQ.md)/[Economy](ECONOMY.md) fundamentals, controls, current rules/workplace diagnostics, and up to three question excerpts plus three activity excerpts (6,500 characters/group) from bundled Playing/catalog data. Guides load once at startup; restart after edits. Queries cannot become paths or web requests; no paid embeddings. Chat has no interactive lookup loop; legacy gameplay adapters retain guide/recall steps.

Workplace context prioritizes owned/employed/planned/discussed buildings, reports missing skills/inputs/output room/payroll, includes a prospective worker in wage costs, and distinguishes jobs from active shifts. `work` or reaccepting the same job renews a shift without duplicate employment/pay; waiting nearby does not. Custom recipes/live settings override defaults; farms use plots. Receipts record actual stock/cash/skills/shift changes and wages. Advice remains fallible; live state beats memory/player claims.

## Recovery from failed plans

Repeated identical failures block that step for five world minutes, extending to thirty; nearby failed waypoints share an eight-metre cell. Reject plans containing blocked steps. General decision delays grow 30, 60, 120 seconds…to ten minutes after the second failure. Keep 16 failed steps across restarts. Meaningful actions or four metres of travel clear general delay; no-op toggles/work refresh/already-reached waypoints do not. Individual blocks keep their own expiry.

A new human question or critical needs can bypass general delay, not step blocks or caps. Legacy duplicate-speech protection keeps eight fingerprints, suppressing near-identical autonomous messages for ten minutes and until progress after repeated failure; configured residents are addressed-only.

## Token and spending controls

Defaults are local accounting rates, not a live provider-price quote (Claude rates last checked 2026-10-01). Custom models require explicit input/output rates; inspect actual provider billing too.

- Mabel: `gpt-4.1-mini`, Responses API, max 2,200 output tokens, $0.40/$1.60 per million input/output; ignores cached-input discounts. [Model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
- Others: `claude-haiku-4-5-20251001`, $1/$5 input/output; five-minute stable-prompt cache at 1.25× writes and 0.1× reads. Reservations use write rates; settlement uses reported categories. [Claude models](https://platform.claude.com/docs/en/models/overview), [caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
- Shared defaults: **$0.60/UTC day, $20/UTC calendar month, 120 rolling calls/hour, two concurrent requests**, minimum interval 15 seconds. Adding residents divides this allowance; zero daily/monthly caps prevent calls.
- Reserve conservative byte-based input plus max output cost durably before dispatch; settle returned usage with the reservation's own rates. Ambiguous errors/crashes retain the charge. Restart does not reset accounting.
- Conversation/tool JSON is capped at 96,000 UTF-8 bytes, with scoped memories, selected workplaces and directory; no raw journals/legacy notebook. Local journal recall is keyword/paginated, at most eight excerpts/turn.

Illustrative 6,000-input/400-output OpenAI reply: $0.00304; 6,000-input Jev choice: $0.000252. The former every five minutes for four hours/day is ~$4.38/30 days; continuously ~$26.27 before caps. Actual context, retries and cache hits vary. The 50-resident scheduler limit/fixture is not a $20 continuous-operation or capacity claim. Local totals cover only this database and depend on rates; taxes, other apps or restoring older backups can differ. Use provider-side controls and one process/database.

## Configuration

Read at startup. All switches require exactly `true`. Keys never enter observations or client assets.

- Mabel: `NPC_ENABLED`; `OPENAI_API_KEY` (native legacy alias `OPENAI_KEY`); `NPC_ID=mabel`, `NPC_NAME=Mabel Reed`, `NPC_WORLD=puddlewick`, optional `NPC_PERSONALITY` (10–3,000 characters).
- `NPC_MODEL=gpt-4.1-mini` selects Mabel's conversation model (Responses strict tools required). Custom models need both `NPC_INPUT_USD_PER_MILLION` / `NPC_OUTPUT_USD_PER_MILLION`; update Compose rates too. Add personality overrides to Compose's environment if needed.
- `NPC_INTERVAL_MS=15000`, range 5,000–300,000; `NPC_MONTHLY_USD=20`, `NPC_DAILY_USD=0.60`, `NPC_CALLS_PER_HOUR=120`; server/CLI share `DATA_DIR`.
- `NPC_POPULATION_ENABLED=false`, `NPC_TIME_ZONE=America/New_York`; newcomers use shared Jev settings and Claude Haiku 4.5.
- `ANTHROPIC_API_KEY` overrides `CLAUDE_API_KEY`; shared by enabled Claude residents.
- `NPC_*_ACTIVE_ALONE` flags are legacy compatibility settings: Mabel stays present and scheduled residents visit even alone.

IDs are permanent memory keys, not renames. Initial names must be unique; existing saved names remain. Configured home-world changes are rejected, but in-game travel persists separate local progress. Disabling residents preserves identities/property/history. Personality edits are journaled.

### Toby’s configuration

Prefix `NPC_BAKER_`: `ENABLED`; `ID=toby`; `NAME=Toby Finch`; `WORLD` inherits NPC_WORLD; optional `PERSONALITY`; `INTERVAL_MS=15000` (5,000–300,000); legacy `ACTIVE_ALONE`; `MODEL=claude-haiku-4-5-20251001` (alias `claude-haiku-4-5` also has built-in rates); `INPUT_USD_PER_MILLION` / `OUTPUT_USD_PER_MILLION` for custom conversation rates. Cache multipliers remain 1.25/0.1. Independent of Mabel; budgets are shared.

## Rowan’s configuration

Prefix `NPC_FARMER_`: `ENABLED`; `ID=rowan`; `NAME=Rowan Field`; `WORLD` inherits NPC_WORLD; optional `PERSONALITY`; `INTERVAL_MS=15000` (5,000–300,000); legacy `ACTIVE_ALONE`; `MODEL` inherits NPC_JEV_MODEL; `CHAT_MODEL=claude-haiku-4-5-20251001`. Jev `INPUT_USD_PER_MILLION` / `OUTPUT_USD_PER_MILLION` default 0.042/0; Claude `CHAT_INPUT_USD_PER_MILLION` / `CHAT_OUTPUT_USD_PER_MILLION` default 1/5. Custom models need both rates. Compose forwards these overrides; enabling Rowan does not enable others. Both providers may receive his permitted context, never another resident's private conversations.

## Operator controls and memory

With the server's DATA_DIR/environment (or `node --env-file=.env --import tsx scripts/npc.ts ...`):

```sh
npm run npc -- status
npm run npc -- pause rowan
npm run npc -- resume rowan
npm run npc -- memory mabel
npm run npc -- memory mabel 'blue tractors'
npm run npc -- memory mabel 'blue tractors' 1234 # earlier than journal ID
```

Any resident ID works; Docker prefixes commands with `docker compose exec aclone`. Pause/resume persists and is noticed within a second. Paused results are ignored but already-sent calls may charge. Moderator kicks pause until resume; gagging uses normal chat rules. Status shows costs/caps/calls/plans/memory counts. Private memory is operator-only; the public endpoint exposes identity/personality/generic activity, not journals.

Journals retain visible parish chat, that resident's private conversation, plans/results, journeys/errors and operator/personality edits indefinitely. Chat/cursor and action/progress commit atomically with world changes; navigation uses five-second autosave and may repeat travel, not committed purchases. Backups include memory. Monitor disk; there is no automatic pruning or player erasure UI. Deletion requires handling journal, notebook, agenda summaries, recall excerpts and backups together. Persistence is retrievability, not perfect model recall.

The player notice discloses saved chat and relevant excerpts sent to TypeSafe/Jev and the resident's conversation provider. OpenAI uses `store:false`; Claude uses stateless Messages plus stable-prompt cache. These do not replace provider retention policies.

## Development and validation

`Brain` is injectable; `OpenAIBrain`/`AnthropicBrain` handle provider formats and usage. Legacy `turn-tool.ts` smoke adapters support the full action union (Claude uses described field bounds plus Zod validation because its strict grammar cannot compile that union). Configured residents use `conversation.ts`, `jev.ts` and `decision.ts`. `Residents` executes shared `act`/`move`; `Navigator` uses cached A* plus normal steering; `NpcMemory` persists state and `NpcBudget` reserves globally.

Run `npm run check` and `npm run test:e2e -- tests/browser/npc.spec.ts`. Deterministic providers test legality, privacy, memory, failures, schedules, budgets and concurrency without keys/charges. Browser evidence uses real HTTP/WebSocket/UI, not live model intelligence. Paid legacy provider-only trial limits and measured results are retained in [release notes](RELEASE_NOTES.md#historical-npc-provider-trials); they do not test the entire current adaptive planner. Long-term survival, profitability and natural dialogue need live playtesting.

## Gameplay request size

The current Jev wire limit is 24,000 UTF-8 bytes; conversation/tool JSON remains 96,000. See [provider cooperation](#how-the-providers-cooperate). Keep protected needs/commitments and all candidate IDs when trimming; do not fix oversized requests by silently dropping careers.

### Optional paid smoke commands

Run `node --env-file=.env --import tsx scripts/SCRIPT.ts --live` with one of:

- `npc-smoke`: temporary database/synthetic chat, at most two requests.
- `npc-baker-smoke`: school, bread and private recall; three calls, $0.40 cap.
- `npc-guide-smoke`: four FAQ questions, up to eight calls including lookups.
- `npc-work-smoke`: synthetic mill/custom-recipe diagnosis, at most six requests, $0.25 cap.
- `npc-farmer-smoke`: four Jev + two Claude calls, $0.50 cap; requires both keys.

These are explicit opt-in API charges; they never target production saves. Historical results are in the release archive.

## Survival and operating businesses

Routine self-care runs locally, before paid decision cooldowns: consume carried supplies, visit a stocked shop (including expensive Harbour emergency imports), use bank savings, or earn emergency meal money. It uses ordinary actions, travel and prices; no invulnerability or free inventory. A qualified worker already at a funded, stocked workplace can renew shifts during a model budget cooldown. Offline survival remains governed by home/room stores.

Jev receives a bounded, rotating shortlist with intact costs instead of hundreds of truncated descriptions. Choices include provisioning a home with varied food/drink, funded productive jobs and training, acquiring a business with six batches of reserves, delivering inputs, and selling outputs to solvent buyers. Owned-business upkeep and personality preferences affect ranking. Blocked production is not an attractive endless waiting plan. Existing pilots reconsider old plans once after this upgrade.
