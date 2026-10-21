# Releasing and deploying

Publish, commit, push or deploy only when explicitly requested. Builds and tests do not authorize publication. [Release notes](RELEASE_NOTES.md#upgrade-archive) retain older migrations and validation records; [CHANGELOG](../CHANGELOG.md) records dated changes.

## Release procedure

The reserved starter world named Puddlewick (economy template, original public
harbour) received Government necessities on a vacant dry lot. Bread, water and fuel
safety-net imports follow that world id and template even when a player holds
world-owner rights. Back up first. Player-owned buildings, contents, prices and
wages are preserved; custom world IDs/names are untouched. If terrain/buildings
leave no suitable lot, placement retries next startup and the shop still sells
on demand.

1. Finish behavior and regressions. Run `npm run check`, `npm run format:check`, `npm run build` and browser checks against a disposable instance; review relevant visuals and backup/migration tests.
2. Move Unreleased entries to a dated `## [X.Y.Z] - YYYY-MM-DD` section, leaving Unreleased at the top. Use SemVer: minor for compatible features, patch for fixes. Never alter a published release.
3. Update `package.json` and both version fields in `package-lock.json`. `src/shared/version.ts` imports that version for health/startup/UI. Refresh README and affected guides.
4. Review the staged diff for secrets, saved state and research material; commit with an imperative message and push when requested.
5. `npm run package` creates a source archive from an explicit allowlist. It includes sources, build scripts, lockfile and editable art; excludes research spec, `sources/`, `tools/`, credentials, saves, generated client builds and dependency binaries.
6. Deploy as authorized, verify health and real play, then publish notes/checksums if requested.

0.1.0 was the local bootstrap; 0.2.0 the first public alpha. Do not claim 1.0 while required [status gaps](STATUS.md) remain.

## Discord changelog publisher

The publisher posts one message per dated `CHANGELOG.md` release to the official
server's `#changelog`, oldest first. It ignores `[Unreleased]`. Every run scans
that bot's channel history, so retries skip already published versions. Existing
posts are not rewritten when an old release is edited. Keep the same bot identity
and retain its messages; deleting a release post makes it eligible for reposting.
Notes over Discord's embed limit get a preview and complete Markdown attachment
in the same message. Mentions and push notifications are suppressed.

### One-time setup

1. Create **aclone-bot** in the [Discord Developer Portal](https://discord.com/developers/applications).
   Install its bot in your server with the `bot` scope. In `#changelog`, grant
   **View Channel, Send Messages, Embed Links, Attach Files, Read Message History**.
   For a read-only channel, explicitly allow these permissions for the bot role in the channel overrides. Administrator and privileged gateway intents are unnecessary. You may limit
   its role to this channel. This is a REST publisher, not an always-online chat bot.
2. On nogits, store its bot token in `/etc/aclone-discord.env`, owned by root with
   mode `0600`, as `DISCORD_CHANGELOG_BOT_TOKEN=...`. Add the verified numeric
   `#changelog` ID as `DISCORD_CHANGELOG_CHANNEL_ID=1562183806478327980` and
   `DISCORD_CHANGELOG_GUILD_ID=1562183434254680175`. Use a dedicated bot token,
   never the personal research-export token. Never commit or print credentials.
3. From a workstation, run `bash scripts/deploy-discord.sh` when deployment is
   authorized. It installs the publisher separately in `/opt/aclone-discord`,
   creates an unprivileged service account, and enables a systemd timer. It runs
   an initial backfill and checks `/opt/aclone/CHANGELOG.md` every five minutes and
   after server reboot. Future game deployments bring new notes onto the server;
   the bot posts any missing dated releases. It does not announce unpushed local
   edits or certify that the game deployment passed its health checks.

This bot runs **on nogits**, independently of laptops and GitHub Actions. Node 24
executes its TypeScript directly; it needs no npm packages, AI calls, gateway
connection or privileged intents. Systemd reads the root-only environment file
and gives only the bot service its token. The bot may appear offline in Discord
because it uses the REST API only; this does not prevent posting.

```sh
# On nogits (root), inspect or trigger the one-shot publisher:
systemctl status aclone-discord.timer
systemctl start aclone-discord.service
journalctl -u aclone-discord.service -n 30 --no-pager
# Pause automatic publishing without affecting the game:
systemctl stop aclone-discord.timer
```

For a preview, use `npm run changelog:discord -- --preview` in a source checkout.
Without a token this is entirely offline. With `DISCORD_CHANGELOG_BOT_TOKEN` and
`DISCORD_CHANGELOG_CHANNEL_ID` set, it checks permissions and history without
posting. An ignored local `.env` is optional for development, never required for
production. `DISCORD_CHANGELOG_PATH` can select the deployed changelog explicitly.
The service uses `--send`; trigger production sends through systemd so they cannot
overlap. Do not run a separate publisher alongside it.

Failures retain progress in channel history and retry on the next timer run.
Stable Discord nonces also guard near-simultaneous retries. The publisher verifies
Read Message History before scanning: without it Discord can return empty history.
A replacement bot cannot authenticate an old bot's posts; migrate deliberately.
No game restart is needed to install or update this separate bot service.
See Discord's [message API](https://docs.discord.com/developers/resources/message)
and [rate limits](https://docs.discord.com/developers/topics/rate-limits).

## Deployment

Production is operator-managed. Keep the same persistent DATA_DIR and private environment:

1. Back up SQLite **and uploaded assets**; keep a rollback copy.
2. Pull the release and run `npm ci`.
3. Build with the existing prefix: `BASE_PATH=/aclone npm run build` (omit BASE_PATH for root hosting).
4. Restart the service gracefully and refresh clients. Update client and server together: collision, protocols and shared catalogs must match.
5. Check `/api/health`, login, movement, chat, property, stock and affected features. Use the public prefix when probing through a proxy.

For the nogits.com instance, `scripts/deploy-nogits.sh` performs steps 1–5 over SSH from a workstation once `main` is pushed: it refuses a server checkout with local changes, takes a pre-deploy SQLite backup in `/var/lib/aclone/backups`, fast-forwards `/opt/aclone` to `origin/main` as the `aclone` user, runs `npm ci` only when the lockfile changed, builds with `BASE_PATH=/aclone/`, restarts `aclone.service`, and checks that the public page loads JavaScript from `/aclone/assets/` and `/api/health` reports the pushed version. It never reads the server's `.env`. Uploaded assets are not copied; back them up separately before migrations.

See [Hosting](HOSTING.md) for service/proxy details. A code rollback cannot undo migrations or recover removed stock: restore the matching pre-upgrade database/assets too. Do not share a database between processes.

## Current upgrade: 0.81.0

Back up before restarting, and refresh browsers for the trading controls, tax
breakdowns and smooth chat scrolling. On loading saved worlds, zero/negative
buying offers become paused and positive buying offers below 1d become 1d.
Paused quotes remain saved but cannot accept deliveries. Selling at 0d remains
an explicit free offer. Past trades, stock, balances and tax rates are unchanged;
there is no compensation, flour rollback or world reset. NPCs retain their homes;
the duplicate-home check prevents future purchases/construction, not existing ownership.

### 0.80.1

Refresh browsers after deployment to load the distant-scenery fog fix. Tree
positions, terrain, resource reserves and game rules are unchanged. No data
migration or world reset is required.

### 0.80.0

Publish the illustrated guide, landing-page link and gallery with
`bash scripts/deploy-website.sh`. The guide uses the same Markdown source as
GitHub. Its screenshots show the 0.78.0 editor; gameplay is unchanged.
No migration or reset is required.

### 0.79.0

Install the optional Discord publisher with `bash scripts/deploy-discord.sh`.
Its token stays in the protected server environment. No game-data migration is required.

### 0.78.0

Back up the database and uploaded assets. Update client and server together for
predicted movement, repeat gathering and slope foundations, then refresh browsers.
Publish the marketing page separately with `bash scripts/deploy-website.sh`.
No reset, price migration, grants or provider-budget changes are required.

Existing buildings retain their heights. Courses and phase cycles require creator
setup; leases and auctions default off. Maintenance is only entered explicitly by
the owner/caretaker. Preserve a 0.78.0 backup before any rollback once contracts or
prize escrow have been funded: older code cannot settle these new obligations.
See [fidelity validation](FIDELITY_PLAN.md#remaining-validation) for measured limits.

### 0.77.2

Chat allowance accounting excludes unclassified legacy calls from the chat-only limit, while retaining all historical charges against global limits. Budget/context refusals expire after three local checks. Preserve the same database and environment; restart normally. No accounting reset or world migration is required.

### 0.77.1

NPC owners manage input buffers and actual payroll through ordinary actions; career recovery improves without changing player permissions or prices directly. Preserve the existing database and provider budgets, back up and restart normally. No reset or paid experiment is included.

### 0.77.0

Publish the interactive building gallery with `bash scripts/deploy-website.sh`, which includes the bundled viewer and textures under `assets/building-viewer/`. Refresh browsers for the popup controls. The gallery uses no game connection or AI calls and retains image links without JavaScript or WebGL. Deploy the game normally for the shared preview code; no data migration or reset is required.

### 0.76.0

Selected architectural models gain trade-specific layouts and corrected details. Existing model IDs, ownership, stock, investments, capacities and saved construction bills are preserved; buildings without a selected model keep their legacy layouts. Update client and server together for matching footprints, then refresh browsers. Publish the refreshed gallery with `bash scripts/deploy-website.sh`. No world reset is required.

### 0.75.0

Generated countryside gains rolling hills while the original town square and custom heightmaps stay unchanged. Update client and server together and refresh browsers for matching terrain and slope-aware driving. No world reset is required.

### 0.74.0

Publish the gallery and website links with `bash scripts/deploy-website.sh`. `/buildings/` is static and requires no additional service or proxy rule on the existing nogits host. The script backs up the site and stages assets before replacing HTML. When upgrading from 0.71.0, also deploy the game normally for the building and driving changes below.

### 0.73.0

Motorized ground vehicles now use the visible road network for weather-sensitive off-road speed limits. Existing climate accumulation and road speeds are preserved. No save migration or reset is required; restart normally.

### 0.72.0

New construction supports architectural models independently of finishes and sizes. Existing buildings keep their legacy shapes, except supply caches now render as containers and completed cottages gain mailboxes. Ownership, stock, investments and existing material bills remain unchanged. Update client and server together for matching footprints and refresh browsers. No reset is required.

### 0.71.0

Building designs add optional style/size fields and save the chosen rotation, capacity and material bill. Existing property ownership, stock, investment and construction bills are preserved; no reset or price migration is required. New construction checks the complete rotated footprint, including service yards. Update client and server together and refresh browsers for the designer. NPC cottage plans now budget their selected materials and can gather raw supplies. Use the normal backup/build/restart procedure; no paid experiment is started.

### 0.70.0

NPC planning adds a durable gameplay/chat accounting lane and compatible optional memory fields. Existing charges remain counted; chat can use at most half of the total budget by default (`NPC_GAMEPLAY_BUDGET_SHARE=0.5` reserves the other half for gameplay). Preserve the server environment and existing total limits. No world reset, stock grant or price migration is required. Back up database/assets, build and restart normally; refresh clients for the included 0.69.0 caretaker archives. Deployment does not run paid experiments.

### 0.69.0

F6 archives public messages and notices in SQLite and provides owner-only paginated history. Private messages are excluded. Take the normal database/assets backup and refresh clients after restarting. Existing history is available only to the extent it was previously retained; this cannot recover already discarded messages.

### 0.68.0

NPC household recovery, complete earning routes, protected business procurement and informed surplus pricing use ordinary game actions. Existing memories remain compatible; no world reset, money grants, blanket price edits or provider configuration changes are required. This includes the 0.66.5 farm-supply fix and 0.67.0 Puddlewick employment migration: take the normal pre-deployment backup and refresh clients. No paid accelerated experiment is started by deployment.

### 0.67.0

Existing Puddlewick saves receive a one-time policy migration: activeWork=false and ownerOperation=true. Stock, property, prices, wages and balances are preserved. Subsequent creator changes remain authoritative. Back up before restarting; refresh clients for continuous-employment and owner-qualification messages. Other worlds keep their employment rules.

### 0.66.5

Farm care uses stored materials first, then carried supplies. Existing permissions and stock are preserved. Refresh clients for the revised labels; no data migration is needed.

### 0.66.4

NPCs respect requests for silence and distinguish direct addresses from incidental
mentions. Dismissal persists across restarts and suppresses outstanding replies;
accepted gameplay agreements remain active. Deploy with the normal backup/build/
restart procedure. No world reset or provider configuration change is needed.

### 0.66.3

CI maintenance only: the two-client social test uses a compact world while retaining
all mail, family and trade assertions. No gameplay changes, migration or world reset
are required. If deploying, use the normal backup/build/restart procedure.

### 0.66.2

Server shutdown now closes unused HTTP preconnections so restarts do not hang.
Deploy with the normal backup/build/restart procedure; no migration or world reset
is needed. The remaining changes stabilize browser and NPC regression checks.

### 0.66.1

CI maintenance only: browser readiness, current gameplay expectations, smaller
test groups and website coverage. No game or website deployment, service restart,
migration or world reset is needed.

### 0.66.0

Publish the standalone marketing page with `bash scripts/deploy-website.sh` after
pushing. The script backs up the existing site and leaves the game service and
player data untouched. See [website hosting](HOSTING.md#public-marketing-site)
for preview, screenshot refreshes and rollback. This release requires no game
migration or reset.

### 0.65.0

Refresh clients for the new building finishes and simpler bay-door and awning
geometry. No world migration or reset is needed; cottage styles and building
footprints are preserved.

### 0.64.1

Refresh clients for smooth streetlamp ground glows in coloured fog and corrected
cloud perspective near the horizon. This graphics patch needs no world migration
or reset and retains the existing light and draw-call budgets.

### 0.64.0

Back up before restarting. The authorized one-time Puddlewick rebalance resets
standard business buy/sell quotes and wages to the new catalogue **including
player-owned businesses**. It preserves ownership, cash, inventories and progress;
custom building templates and other worlds are excluded. Later owner edits remain
intact. No world reset is needed. Public ports clear bounded surplus shipments;
regular labour pays 1d with means-tested meal relief. Refresh clients for the
updated payment notices. NPC provider credentials and spending limits stay as
configured; deployment does not start an accelerated paid experiment.

### 0.63.4

Winter now kills crops still in the fields, including ripe crops. On upgrade,
existing plots that have already crossed a winter since planting are cleared on
the next tick. Stored goods, farm money, ownership and permanent drainage remain.
Harvests completing at or after winter's start fail without wages; those completed
before it still count during catch-up. Back up before deploying and refresh
clients for corrected notices. No world reset or provider changes are needed.

### 0.63.3

This maintenance release updates the garage browser check for contextual controls;
it adds no save changes. It includes the client fixes below.

### 0.63.2

Refresh clients for corrected waypoint direction. Arrows follow the actual camera
view, including camera orbit and view changes. Saved map destinations remain
compatible; no migration or world reset is required.

### 0.63.1

Refresh clients for seasonal farm notices and automatic planting-menu updates at
season changes. This changes presentation only; crops and planting rules are
preserved. No migration or world reset is required.

### 0.63.0

Public group invitations select at most one interested online resident, with a
persisted 30-second cooldown. Restart the server for routing and updated NPC
guidance; existing memories and agreements remain compatible. No reset, SQL
migration or provider configuration change is required.

### 0.62.1

Refresh clients for contextual action controls. Property owners manage their own
buildings through the normal panel; world administrators explicitly enter
caretaker management from Editor → Buildings. Ordinary outside investment now
records the administrator’s personal stake unless caretaker mode is selected.
Existing property, investments and player data are preserved.

### 0.61.0

Automatic producers resolve ideal active crew sizes from their building type or
custom template. Existing properties receive the staffing curve without resetting
stock, wages, prices, employee rosters or fractional production progress. No SQL
migration or world reset is needed. Refresh clients to see active/ideal staffing.
A lone miller now runs at 50% speed; two millers run at 100%, and three at 67%.
Wages remain per completed batch, so review payroll against sales: ideal speed
does not guarantee ideal profit. Seasonal farms retain their manual plot rules.

### 0.60.0

NPC household reserves, persistent career projects and business upkeep replace
several retry loops. Existing saves and NPC memory remain compatible; missing
career metadata initializes lazily. No world reset, stock injection or SQL
migration is required. Keep the existing NPC provider configuration and budgets.
Refresh clients for the new Inventory discard control. See [NPC recovery](NPC_RECOVERY.md)
for test evidence and the remaining economic-stability gates.

### 0.42.2

0.42.1 corrects chat position after loading; 0.42.2 updates browser regression checks. Alcohol state introduced in 0.42.0 is an optional field in existing world saves; everyone starts sober on upgrade. No reset, stock migration or SQL change is required. Update clients and server together for steering and visual feedback. Visual comfort settings are local to each browser. The preceding 0.41.1 model changes need no world migration.

## Earlier upgrades

### 0.35.0

0.35.0 adds player-built dairy supply chains and opt-in custom nutrition effects. Existing characters retain their normal 60000 health ceiling. Only missing new-goods quotes at government Harbour/spaceport outlets are added once; existing prices, privately owned shops and stocks are preserved. No new buildings are inserted into Puddlewick.

0.34.0 adds opt-in landscape authoring and saved four-step undo. Existing terrain and scenery remain unchanged until edited; no reset or SQL migration is required.

0.33.1 corrects construction access-rule enforcement; no migration is needed. 0.33.0 adds opt-in world catalogues, building templates and production diagnostics. Existing worlds retain their standard goods, prices and professions; no reset or new Puddlewick custom content is introduced. Definitions persist in existing world JSON.

0.32.1 stabilizes browser verification without gameplay changes. The 0.32.0 feature release adds opt-in creator quests, action requirements and per-player Lua progress. Existing worlds receive empty quest/requirement lists; Lua progress resets on death by default. No existing character economy or property is reset.

The 0.31.0 procurement upgrade enables bounded hourly parish orders in existing server-owned Puddlewick once, without resetting stock or changing owned prices. Other worlds opt in through settings.

The 0.30.0 reporting upgrade adds business statements and private return/history reports. Existing stock, cash and ownership stay unchanged; accounting starts with newly recorded activity. SQLite receives an optional ledger-details column. Back up the database and uploaded assets before upgrading; a rollback to an older executable needs its matching database backup. Restart the server and refresh clients together. The preceding NPC fix restores replies while preparing to leave; world-rule defaults remain unchanged.

For older upgrades, review the [upgrade archive](RELEASE_NOTES.md#upgrade-archive), especially schema 2 (0.3.0), seasonal farms (0.4.0), town relocation (0.6.0), offline starvation (0.15.0), pricing (0.15.3/0.16.0), and starter-property cleanup (0.21.2). NPC manuals are bundled runtime inputs: restart after editing FAQ, Playing or Economy.

### Illustrated world-building guide

Edit `docs/WORLD_BUILDING_GUIDE.md` and its screenshots in `docs/screenshots/world-building/`. The website build uses Marked at build time to render that same source at `/world-building/`; no Markdown runtime is shipped to players. Keep the guide tied to verified editor controls and capture examples in a disposable local world. `build-world-guide.ts` checks image and local-document references. Review desktop/mobile layout and links before `scripts/deploy-website.sh` publishes the guide alongside the landing page and building gallery.
