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

## Deployment

Production is operator-managed. Keep the same persistent DATA_DIR and private environment:

1. Back up SQLite **and uploaded assets**; keep a rollback copy.
2. Pull the release and run `npm ci`.
3. Build with the existing prefix: `BASE_PATH=/aclone npm run build` (omit BASE_PATH for root hosting).
4. Restart the service gracefully and refresh clients. Update client and server together: collision, protocols and shared catalogs must match.
5. Check `/api/health`, login, movement, chat, property, stock and affected features. Use the public prefix when probing through a proxy.

For the nogits.com instance, `scripts/deploy-nogits.sh` performs steps 1–5 over SSH from a workstation once `main` is pushed: it refuses a server checkout with local changes, takes a pre-deploy SQLite backup in `/var/lib/aclone/backups`, fast-forwards `/opt/aclone` to `origin/main` as the `aclone` user, runs `npm ci` only when the lockfile changed, builds with `BASE_PATH=/aclone/`, restarts `aclone.service`, and checks that the public page loads JavaScript from `/aclone/assets/` and `/api/health` reports the pushed version. It never reads the server's `.env`. Uploaded assets are not copied; back them up separately before migrations.

See [Hosting](HOSTING.md) for service/proxy details. A code rollback cannot undo migrations or recover removed stock: restore the matching pre-upgrade database/assets too. Do not share a database between processes.

## Current upgrade: 0.66.5

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
