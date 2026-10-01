# AI neighbours: Mabel, Toby and Rowan

Three optional residents can share Puddlewick. **Mabel Reed** uses OpenAI and keeps
her existing identity and memories. **Toby Finch** uses Anthropic’s Claude: he is
a patient, practical male baker with a goal of learning his trade, earning wages,
staying healthy and saving toward a bakery of his own. Each has a separate pilot,
personality, journal, notebook and plan. All follow the ordinary player economy,
physics, collision, skill requirements and prices; Toby learns `baker` at school
rather than receiving free qualifications, money or a bakery. They use the normal
tractor and walking models. Personality defines identity, not a new avatar model.

**Rowan Field** is a patient, observant male farmer. TypeSafe Jev selects his
next gameplay plan from currently feasible options; Claude gives him a natural
conversational voice and working notebook. He has his own persistent pilot and
journal. All three use ordinary skills, cash, inventories and ownership rules.
Rowan can learn farming, join a farm, plant appropriate seasonal crops, water,
fertilize and harvest for wages. He can save toward buying a farm, fund its seed
account, collect its crops and sell them to other businesses. He does not get
free qualifications or a free farm.

This is an experimental economy agent, not a scripted tour guide or a promise
of optimal play. Her supported actions include travel, walking/driving, food and
fuel, labour/crafting, trading, skills, employment, property purchase, home,
stock/investment, banking, gathering, farming and tractor paint. Combat, galaxy
travel, construction, lodging bookings and world editing are not agent tools in
this first version. New actions can be added without replacing their memories. She can explain these
other activities to human players using the game guide, even when her own tools
do not let her perform them.

## Try it

NPCs are **disabled by default**, with independent switches for Mabel, Toby and Rowan. Merely adding a key does not start requests. Use a server-side
OpenAI API key with API billing enabled. This integration uses API-key billing,
separate from a ChatGPT subscription; it does not consume a ChatGPT plan's
included usage. See [OpenAI pricing](https://learn.chatgpt.com/docs/pricing).

Put these settings in the repository's gitignored `.env`, replacing the key
placeholder privately. Never add an API key to a `VITE_` variable, a client file,
a screenshot or a commit.

```dotenv
NPC_ENABLED=true
OPENAI_API_KEY=your-server-api-key
NPC_MONTHLY_USD=20
NPC_DAILY_USD=0.60
NPC_ACTIVE_ALONE=false
```

To add Toby alongside Mabel, keep those settings and add:

```dotenv
NPC_BAKER_ENABLED=true
CLAUDE_API_KEY=your-server-anthropic-key
```

`ANTHROPIC_API_KEY` is also accepted and takes precedence over `CLAUDE_API_KEY`.
Toby defaults to `claude-haiku-4-5-20251001`. Claude API billing is separate from
consumer subscriptions, and all residents share the existing Aclone spending
caps. You can run Toby alone with `NPC_ENABLED=false` and
`NPC_BAKER_ENABLED=true`. Keep `NPC_ID=mabel` and `NPC_BAKER_ID=toby` stable to
retain their separate memories. No database reset is needed when adding him.

Native development (Node 24.14+):

```sh
node --env-file=.env --import tsx src/server/main.ts --dev
```

Production under `/aclone`:

```sh
BASE_PATH=/aclone npm run build
node --env-file=.env --import tsx src/server/main.ts
```

The usual `npm start`/`npm run dev` inherit exported environment variables; they
do **not** automatically read `.env`. A service can instead use its environment
file setting. Keep the existing [prefix-stripping proxy](HOSTING.md#reverse-proxy).
Compose reads `.env` and passes the listed settings to the server at runtime:
`docker compose up --build -d`. The key is not a Docker build argument.

Join Puddlewick. Mabel appears when a human is present. Open **AI resident · chat
& memory info**, or **Game menu → AI neighbours**, then **Chat with Mabel Reed**
to send a private message. Toby has his own **Chat with Toby Finch** button; Rowan has his own chat button too. Provider labels identify OpenAI, Claude and Jev + Claude. **Back to parish chat** restores public chat. You can
also address her by first name in parish chat. Names and messages have an **AI**
label. A reply takes API latency plus up to the 15-second decision cooldown;
she may take longer if the budget is exhausted or the provider is unavailable.

Try introducing yourself, asking her to explain her plan, then meeting her again
after a server restart. Inspect her actual actions and money with the operator
commands below. The notebook is a fallible model summary; the event journal
records what actually happened.

## Rowan’s configuration

Add these settings to the server's gitignored `.env` and restart normally:

```dotenv
NPC_FARMER_ENABLED=true
JEV_API_KEY=your-server-typesafe-key
CLAUDE_API_KEY=your-server-anthropic-key
```

Create a Jev key at the official [TypeSafe console](https://console.typesafe.ai/).
`TYPESAFE_API_KEY` is also accepted and takes precedence over `JEV_API_KEY`.
The existing Claude key can serve Toby and Rowan; adding Rowan does not enable
Toby or Mabel automatically. Merely setting a key does not enable the farmer.
Keep secrets server-side; `.env` is not committed or sent to browsers.

- `NPC_FARMER_ENABLED`: exactly `true` enables Rowan, independently of the others.
- `NPC_FARMER_ID` / `NPC_FARMER_NAME`: defaults `rowan` / `Rowan Field`.
  Keep the ID stable; names apply at pilot creation and must be distinct.
- `NPC_FARMER_WORLD`: defaults to `NPC_WORLD`, then `puddlewick`.
- `NPC_FARMER_PERSONALITY`: optional replacement, 10–3,000 characters.
- `NPC_FARMER_MODEL`: pinned default `jev-1.13.0`.
- `NPC_FARMER_CHAT_MODEL`: default `claude-haiku-4-5-20251001`.
- `NPC_FARMER_INTERVAL_MS`: minimum decision interval, default 15,000 (5,000–300,000).
- `NPC_FARMER_ACTIVE_ALONE`: default `false`; sleep without human visitors.
- `NPC_FARMER_INPUT_USD_PER_MILLION` / `NPC_FARMER_OUTPUT_USD_PER_MILLION`:
  defaults 0.042 / 0; both required for a different Jev model or alias.
- `NPC_FARMER_CHAT_INPUT_USD_PER_MILLION` / `NPC_FARMER_CHAT_OUTPUT_USD_PER_MILLION`:
  defaults 1 / 5; both required for a different Claude model. Same cache accounting as Toby.

All these variables are passed by Compose. Preserve Mabel and Toby's existing
IDs and configurations; no database reset or schema migration is needed.
Use **AI neighbours → Chat with Rowan Field**, or address Rowan in parish chat.
The **Jev + Claude** badge explains his two providers. His visible parish chat,
own private conversations and relevant game state may be sent to both providers;
other residents do not receive his private conversations.

### How the two providers cooperate

The [Jev API](https://docs.typesafe.ai/api) selects one supplied option; it cannot
write free-form dialogue. `farmer.ts` builds up to 100 plans from actual game
state, filtering blocked actions, wrong seasons, missing qualifications, supplies,
storage and wage funding. `jev.ts` validates the selected ID and probability/token
fields. The controller then uses ordinary navigation and game actions; conditions
are checked again when an action executes. No model can inject a new action through
a choice ID. This is a bounded farming repertoire, not the full Mabel/Toby action
catalog; Rowan can still explain other features using the shared guide.

Jev sees current observations, recent results, failed steps, notebook and journal
excerpts. A recall option searches his own older journal. It chooses plans lasting
up to ten minutes for journeys, and normally reconsiders short actions after one
minute. Hunger and thirst can wake it sooner. Crops use the same seasons, growth,
rotation and weather as player farms; winter planting has no valid choices.
Farm wages arrive after a 15-second ripe harvest, with crops in the farm's stockroom.

Claude runs only when a human addresses Rowan. It receives the complete game guide,
question, memories, actual results and Jev's selected future plan. Only its speech
and notebook are accepted; its action plan cannot override Jev. Failed or budget-
limited conversation leaves the selected gameplay plan intact, and the unanswered
question remains available for a later scheduled turn. Private replies are forced
back to the original sender even if the model requests public chat.

Each Jev call and each Claude call has its own durable cost reservation, token
accounting and hourly-call slot under the existing shared caps. Jev input pricing
is $0.042/million, output free, checked 2026-10-01 against
[TypeSafe's model reference](https://docs.typesafe.ai/models). At 6,000 input tokens,
a Jev decision costs approximately $0.000252; conversation is additional Claude
usage. This is an arithmetic example, not a measured monthly cost. Consumer
subscriptions do not cover these API bills.

## Helping other players

Mabel and Toby receive the complete [FAQ](FAQ.md) and [economy guide](ECONOMY.md) on every
decision, including controls, employment, production, ownership, farming, lodging,
account help and activities. These core rules no longer depend on her knowing
which terms to search for. Up to three additional excerpts each can address the
player's question and her current activity, using the [player guide](PLAYING.md)
and current catalog data. Each excerpt group is bounded to 6,500 characters.
She can still request a read-only `guide` lookup by topic or exact entry ID.
Queries never become filesystem paths or web requests; search is local and uses
no paid embeddings.

Holding a job and having an active shift are distinct. Workplace summaries flag
expired shifts or shifts that expire before the next batch, and supply the exact
`work` action to renew them. Reaccepting an existing job also safely renews its
shift without duplicate employment; neither action produces an instant batch.
Waiting beside a building does not renew work.

Workplace observations diagnose employment, qualification, active shifts,
production timing, input shortages, output space and funding. A prospective
wage shortfall includes the resident even before they take the job. Custom
recipes and current world settings override defaults; farms are explicitly
seasonal plots. Workplaces she owns, works at, plans to visit or is discussing
are prioritised within the bounded selection. These are read-only facts: the
model still decides what to do and all actions pass normal game validation.

Her latest outcome retains the attempted action and error through chat and
restart. Action journals include job/shift/skill changes and affected building
stock/capital; recent personal wage receipts confirm actual payment. This helps
her distinguish agreeing to work, accepting a job and completing production.
Player claims and notebook summaries are fallible; current observations take
precedence. She should own mistakes, explain the cause and next step, and use
occasional gentle humour without repetitive announcements or invented memories.
Advice remains model-generated and can be wrong. Private routing survives an
extra lookup turn, and other players' private data is not added to these reports.

Developers: keep these manuals accurate as gameplay changes. Fixed-path files
are read once per process and shipped in the source archive and Docker runtime;
restart after edits. Catalog entries use game data; the legacy automatic farm
recipe is excluded. `workplace.ts` uses the simulation's production interval and
staff rules. Update its diagnostic tests when those mechanics change.

## Recovery from failed plans

A failed action or route is saved with its attempted step. A second failure of
the same step temporarily blocks it for five minutes of world time; further
failures extend that block up to thirty minutes. Nearby failed ground waypoints
share an eight-metre cell so tiny coordinate changes do not evade the check.
New plans containing blocked steps are rejected before their promises are sent
to chat. The model sees the blocked steps and remaining retry times and must
choose an alternative or wait; the controller does not invent another strategy.

Repeated failures also delay autonomous decisions: 30 seconds after the second
failure, then 60, 120 and so on up to ten minutes. Recovery history is bounded to
16 steps and survives restart. No-op outside/engine/work-refresh actions and
arrival at an already-reached waypoint do not count as progress. Meaningful game
actions or travelling at least four metres clear the general wait, while the
individual failed-step blocks stay in force until their own expiry.

Repeated or near-identical autonomous announcements to the same recipient are
suppressed for ten minutes, with at most eight recent speech fingerprints saved.
Repeated failures also silence autonomous announcements until progress occurs.
A new addressed human question or newly critical needs can bypass the general
retry wait; questions can receive answers, but cannot remove failed-step blocks.
Normal shared request/spending caps still apply. This is a controller safeguard,
not just an instruction asking the model not to repeat itself.

## Token and spending controls

Mabel’s default model is `gpt-4.1-mini`, using the Responses API with one strict
`plan_turn` tool and at most 2,200 output tokens. Default accounting rates are
$0.40 per million input tokens and $1.60 per million output tokens, from the
[model pricing page](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
OpenAI cached-input discounts are deliberately ignored in local estimates.

Toby defaults to Claude Haiku 4.5 at $1/million uncached input tokens and
$5/million output tokens. Stable instructions and tool definitions use a
five-minute prompt cache: writes cost 1.25× input and hits 0.1× input. Local
accounting includes all three input categories and reserves at the higher
cache-write rate before a request. Every reservation stores its own rates so a
restart or a different resident cannot settle it using the wrong prices.
See [Claude models](https://platform.claude.com/docs/en/models/overview) and
[prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
Pricing checked 2026-10-01; custom models require explicit rates. Cache savings
apply only when the provider reports a cache hit; the cap does not assume one.

- Plans have up to 12 steps and 30 bounded repeats. Routine movement and task
  completion run locally without an API call. Plans can last up to 30 minutes.
- The full FAQ/economy fundamentals, a small notebook, recent journal excerpts,
  selected workplace details and a compact directory enter each request. Total
  request/tool JSON is capped at 96,000 UTF-8 bytes (not tokens). Old memories use local SQLite
  keyword search and pagination (up to eight excerpts per turn); there is no paid embedding/vector service.
- Addressed human messages, failed actions and newly critical needs can wake her.
  NPC chat does not trigger another NPC automatically. The minimum request
  interval defaults to 15 seconds, and the entire population shares a rolling
  120-call/hour ceiling and two concurrent requests.
- By default she sleeps when no humans are in her parish. Set
  `NPC_ACTIVE_ALONE=true` only to run her without visitors. Ordinary offline
  protections apply while asleep, paused, out of budget or awaiting an API retry.
- The shared estimated-cost caps default to **$0.60 per UTC day** and **$20 per
  UTC calendar month**. Every request reserves a conservative byte-based input
  estimate and maximum output cost in SQLite before calling a provider. Success
  reconciles against returned token counts. An ambiguous failure or crash keeps
  its reservation charged; restarting does not reset the counters.

For scale only, a hypothetical 6,000-input/400-output-token turn costs $0.00304
at those rates. One turn every five minutes for four hours/day would be about
$4.38 in 30 days; continuous activity would be about $26.27 before this game's
caps stop it. These are arithmetic examples, not measured gameplay averages.
Longer context, conversation and recovery attempts change actual usage.

Adding Toby, Rowan or future residents does not multiply the shared allowance. They share less
thinking time under the same caps. The controller has a 50-resident ceiling and
a concurrency regression fixture at that size; this is **not** a claim that 50
continuously reasoning agents fit a $20 budget or a production load benchmark.
The environment configuration supports these three residents; each is independently enabled.

Local dollar accounting depends on correct model prices and applies only to
this database's NPC calls. Keep provider-side account controls and inspect
actual provider usage too; other applications, changed pricing, taxes and a
restored older database can differ from local totals. Use one server process
per database. Daily/monthly limits of zero prevent new calls.

## Configuration

All settings are server-only and read at startup:

- `NPC_ENABLED`: exactly `true` enables the resident; otherwise disabled.
- `OPENAI_API_KEY`: required when enabled. Legacy `OPENAI_KEY` is accepted natively.
- `NPC_ID`: stable memory key, default `mabel`. **Keep this unchanged across
  restarts.** A different ID means a different resident, not a rename.
- `NPC_NAME`: initial pilot name, default `Mabel Reed`; must not collide with an
  existing account. Existing resident names remain their saved account names.
- `NPC_WORLD`: existing economy world ID, default `puddlewick`. Changing the world
  of an existing resident is rejected rather than moving assets silently.
- `NPC_PERSONALITY`: optional replacement personality text (10–3,000 characters).
  Changes are journaled. Native environment supports it; add it to Compose's
  environment list if you want an override there.
- `NPC_MODEL`: default `gpt-4.1-mini`. A custom model must support Responses strict
  function tools. Supply both `NPC_INPUT_USD_PER_MILLION` and
  `NPC_OUTPUT_USD_PER_MILLION` with its current rates. Update Compose's rate values
  too when changing its model; those defaults describe only GPT-4.1 mini.
- `NPC_INTERVAL_MS`: minimum 5,000, maximum 300,000; default 15,000.
- `NPC_ACTIVE_ALONE`: default `false`.
- `NPC_MONTHLY_USD`, `NPC_DAILY_USD`: estimated spending caps, defaults 20 and 0.60.
- `NPC_CALLS_PER_HOUR`: global rolling call cap, default 120.
- `DATA_DIR`: same persistent game directory used by the server and operator CLI.

### Toby’s configuration

- `NPC_BAKER_ENABLED`: exactly `true` enables Toby, independently of Mabel.
- `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY`: server-only Claude API key.
- `NPC_BAKER_ID` / `NPC_BAKER_NAME`: defaults `toby` / `Toby Finch`; must differ from Mabel’s ID and name. Names apply when first creating the pilot.
- `NPC_BAKER_WORLD`: defaults to `NPC_WORLD`, then `puddlewick`.
- `NPC_BAKER_MODEL`: default `claude-haiku-4-5-20251001`; `claude-haiku-4-5` alias also has built-in rates.
- `NPC_BAKER_PERSONALITY`: optional replacement personality, 10–3,000 characters.
- `NPC_BAKER_INTERVAL_MS`: default 15,000; range 5,000–300,000.
- `NPC_BAKER_ACTIVE_ALONE`: default `false`; sleeps in an empty parish.
- `NPC_BAKER_INPUT_USD_PER_MILLION` / `NPC_BAKER_OUTPUT_USD_PER_MILLION`: rate overrides; both required for a custom model. The five-minute cache write multiplier is 1.25 and read multiplier 0.1 (conservative for models with cheaper reads).

Daily/monthly caps and call/concurrency limits are shared, not per character.
Disabling one resident leaves the others running and preserves all histories.

## Operator controls and memory

Run from the repository with the server's `DATA_DIR` exported (or use the same
`node --env-file=.env --import tsx scripts/npc.ts ...` form):

```sh
npm run npc -- status
npm run npc -- pause rowan
npm run npc -- resume rowan
npm run npc -- memory rowan
npm run npc -- pause toby
npm run npc -- resume toby
npm run npc -- pause mabel
npm run npc -- resume mabel
npm run npc -- memory mabel
npm run npc -- memory mabel 'blue tractors'
# Search earlier matching entries, before a journal ID from previous output:
npm run npc -- memory mabel 'blue tractors' 1234
```

In Docker, prefix these commands with `docker compose exec aclone`.
Pause/resume is durable and noticed within a second. In-flight results are
ignored when paused; a request already sent can still incur a provider charge.
An in-game moderator kick also pauses the NPC until operator resume. Gagging
uses the normal chat rule. To remove the integration from play, set
`NPC_ENABLED=false` for Mabel or `NPC_BAKER_ENABLED=false` for Toby or `NPC_FARMER_ENABLED=false` for Rowan and restart; saved identities, property and journals remain.

Status shows local cost estimates, caps, recent call count, plan goal and memory
count. Memory output contains private conversations: this CLI is for the host
operator, never a public HTTP endpoint. The in-game status endpoint exposes
identity/personality and generic activity only, not her notebook or journal.

The journal retains visible parish chat, private messages to/from that resident, chosen
plans, completed actions/results, journeys, failures and operator/personality
changes. Other players' private conversations are excluded. Chat captured during
normal game actions and the resident cursor save in the same transaction as the
world. Action results and plan progress are also committed together. Navigation
progress uses the usual five-second world autosave; restarting may repeat a route
but does not replay a committed purchase or job-start step.

Memory lives in `aclone.sqlite` and is included in ordinary game backups.
History is retained indefinitely, so disk use grows with conversation/activity;
monitor the database and backups. There is no automatic pruning or player-facing
erasure tool in this prototype. Deletion requests require operator handling of
the journal, notebook, saved recall excerpts and retained backups together.
Disabling the NPC does not delete memories. Persistent history means retrievable
records, not guaranteed perfect recall by the model.

The visible notice tells players that parish chat and messages to the resident
are saved and relevant excerpts sent to that resident’s provider (OpenAI for
Mabel, Anthropic for Toby). Private conversations are not copied to the other
resident. OpenAI requests set `store: false`; Claude uses stateless Messages
requests with a five-minute cache of stable instructions. Neither setting
replaces the provider’s own data-retention policies.

## Development and validation

`Brain` is an injectable provider interface. `OpenAIBrain` handles the Responses
wire format; `AnthropicBrain` handles Claude Messages and cache usage. Claude’s
full action union exceeds its strict grammar compilation limit, so field limits
are explained in the tool schema and the original Zod validator rejects invalid
turns before any speech or action. Explicit job/work examples prevent confusing
qualified employment with a workhouse task. Both providers use
`turn-tool.ts` and the same locally validated plan; `decision.ts` defines the bounded action vocabulary. `Residents`
manages turns and applies shared `act`/`move` rules. `Navigator` uses cached A*
paths, then ordinary steering/throttle physics. `NpcMemory` owns the journal and
working state; `NpcBudget` reserves usage globally before async requests.

```sh
npm run check
# Optional, paid: school, bread production and private recall; three calls, $0.40 cap:
node --env-file=.env --import tsx scripts/npc-baker-smoke.ts --live
npm run test:e2e -- tests/browser/npc.spec.ts
# Optional, paid: temporary database and synthetic chat, at most two API requests:
node --env-file=.env --import tsx scripts/npc-smoke.ts --live
# Optional, paid: four FAQ questions, up to eight API requests including lookups:
node --env-file=.env --import tsx scripts/npc-guide-smoke.ts --live
# Optional, paid: mill diagnosis, employment/production and custom-recipe blockers;
# synthetic in-memory world, up to six requests, $0.25 conservative cap per run:
node --env-file=.env --import tsx scripts/npc-work-smoke.ts --live
```

Unit tests use deterministic providers: no credentials or API costs. They cover
ordinary driving/wages/supplies, journal retrieval, restart identity, shared
budgets, bounded concurrency, private replies, invalid actions, moderator pause,
provider failure and strict API serialization. The browser fixture uses real
HTTP/WebSocket/UI paths with a deterministic provider, and writes
`test-results/npc-chat.png`. It demonstrates integration, not model intelligence.
The opt-in live smoke test checks a real validated model plan and durable memory;
long-term economic skill still needs playtesting and tuning.

A live GPT-4.1 mini trial verified private chat, driving to the Odd Jobs Office,
three completed labour shifts (13,500 internal currency units earned), and
journal/notebook persistence after reopening the database. That successful
four-minute simulated gameplay trial used one model request, with a locally
estimated cost of $0.0016668. This is one sample, not a long-term cost forecast.
The trial also exposed an unsupported `oneOf` schema emitted by Zod; the adapter
now emits equivalent `anyOf` branches for disjoint action types, and a regression
test checks the wire schema. The smoke runner reports sanitized provider error
codes/parameters on rejection, never the API key or provider error message body.

A separate live guide trial answered controls (M/L/Parp), verified-email password
recovery, owner stockroom transfers and spring coffee planting/60-day growth.
It used four requests with a local estimate of $0.010442 in total. Automated
backup/restore testing also covers identity, private journal, pause and spending
reservations together. These samples do not establish long-term cost or perfect
help accuracy.

The 0.11.1 expanded-knowledge trial used the real model against a synthetic
mill: it identified the absent job and 7.41d capital shortfall, chose employment
and active work after funding, and the normal simulation produced 3 flour from
5 wheat and paid 19.80d net wages. It also identified missing wheat, output space
and wages for a changed recipe. That three-request sample cost approximately
$0.0161 at the configured accounting rates. A further four-question controls,
recovery, ownership and coffee-growing trial passed at about $0.0209. Earlier
iterations exposed misleading hiring advice and a display name used as a travel
ID; explicit actor roles and target-ID instructions were added. These limited
samples demonstrate improvement, not guaranteed advice or long-term reliability.

Prompt structure and contextual examples follow the
[official OpenAI prompt engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering).
The model and existing daily/monthly limits are unchanged. Richer turns cost
more individually; repeated failed attempts also cost money, so judge changes
against successful gameplay and measured usage rather than prompt length alone.

### Claude baker trial (2026-10-01)

An opt-in real Claude Haiku 4.5 trial used a disposable world and synthetic
private chat. Toby selected school training, paid the ordinary 80d tuition,
accepted bakery employment, converted 2 flour into 3 bread at the production
boundary, earned a 19.80d net wage, and recalled the test owner’s favourite loaf
in a private reply. The successful three-request run cost about $0.05063;
later requests hit the 5,482-token stable prompt cache. Fixture positioning
placed him near school/bakery entrances; navigation is tested separately.
The earlier integration trials exposed invalid task/job forms and oversized waits;
these remain rejected, and explicit action examples corrected the live trial.
This demonstrates a short working scenario, not perfect long-term AI judgement.

## Jev farmer trial (2026-10-01)

The live integration trial used a disposable in-memory parish and real Jev/Claude
APIs. It placed Rowan at service entrances and advanced the test crop to ripeness;
it did not modify production saves or grant skills or harvest wages. Four Jev
choices trained farmer for 80d, accepted farm employment, planted potatoes and
harvested 45 into the farm stockroom, earning 19.8d after tax. Two Claude calls
supplied private dialogue. Controller restarts between stages preserved identity
and memory. The successful six-call run cost an estimated $0.030271796; earlier
tuning attempts incurred additional usage. This is an integration check, not a
promise that an unsupervised resident will always make optimal decisions.

To repeat (real API charges; at most four Jev plus two Claude calls and a $0.50
local cap; `.env` must contain both keys):

```sh
node --env-file=.env --import tsx scripts/npc-farmer-smoke.ts --live
```

Automated tests additionally cover watering, fertilizer, seed funding, seasonal
restrictions, wage/storage blockers, owner stock sales, restart memory, invalid
provider output, separate call accounting and continued gameplay when dialogue
fails or hits the budget. Browser tests use deterministic providers without
paid requests and verify all three chat identities and private-message isolation.
