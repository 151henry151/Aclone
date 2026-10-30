# Releasing and deploying

Publish, commit, push or deploy only when explicitly requested. Builds and tests do not authorize publication. [Release notes](RELEASE_NOTES.md#upgrade-archive) retain older migrations and validation records; [CHANGELOG](../CHANGELOG.md) records dated changes.

## Upgrade 0.108.0

Back up and deploy server and client together, then publish the website and reload clients. Public Puddlewick moves its existing public spaceport to a clear remote site, retaining its identity, stock and finances. The saved site adds an access road, terrain grading, a 600-metre-radius fence and a one-kilometre no-build reservation. Verify the site, road and preserved property against the backup. Other worlds are unchanged. Keep the matching database backup for rollback: older clients do not understand the graded spaceport terrain.

Check launch/landing exhaust, raft flare lighting and storm-water motion after reloading. The graphics changes preserve boating rules, wave strength and fishing economics.

## Upgrade 0.107.0

Back up and deploy server and client together, publish the website, and reload clients. Public Puddlewick receives saved `additionalResources` and `resourceExpansionVersion: 1`; verify eight clusters and the woodland/cliff additions against the backup. Existing nodes, depletion and gathering tasks must remain unchanged. Portable world designs retain the added coordinates. No account or property reset is required.

Procedural underwater terrain changes, so all clients need the same version for matching soundings and fishing. Custom heightmaps remain authoritative. Check a boat's depth reading, bay map shading, distant terrain and lighthouse flashes. Test returning from another window and HUD preferences after a reload. Keep the pre-deploy backup for rollback of the additive resource migration.

## Upgrade 0.106.0

Deploy normally and publish the updated website, then reload clients. No data migration is required. Check the map scale while zooming between local and island views, the 500% maximum zoom, and names appearing without hover above 350%.

## Upgrade 0.105.0

Back up and deploy client and server together, publish the website, and reload clients. Existing livestock farms acquire the first available dry, unoccupied pasture parcel. If none fits, no animals are deleted and base production continues, but herd growth remains blocked. Inspect crowded farms and retain the pre-deploy backup; older versions do not recognize expanded pasture capacity or extended vehicle overrides.

Vehicle overrides preserve slot IDs and are included in world exports. Existing default vehicles are unchanged. Test a saved custom vehicle, pasture management, and map zoom away from the player after deployment. No player grants or manual database migration are required.

## Upgrade 0.104.0

Back up and deploy client and server together, publish the website, and reload clients. The charter boat appends vehicle slot 31 without changing existing slots. Charter invitations, tickets and escrow persist in the saved world; preserve these fields across restarts. No reset or manual migration is required.

Verify purchase/boarding, accepted fares, passenger rod fishing and return settlement. Check independent tractor light switches from two clients. Retain the pre-deploy backup for rollback; older code does not understand charter boats or fare escrow.

## Upgrade 0.102.0

Back up and deploy client and server together, then publish the website and reload clients. No world reset or manual data migration is required. Existing loans preserve their funding source (legacy loans use savings); existing farms have no staff restrictions until their owner sets them. Private businesses without a discount policy now inherit modest default tiers; an empty tier list explicitly disables discounts. Public import/export outlets do not inherit defaults.

Verify persistent loan warnings, source selection at the bank, discounted purchase quotes, and staff policy saving. Keep the pre-deploy backup: the new optional loan source and business policies must be understood by both client and server. Observe lighthouse lighting from land and offshore; the distant beacon remains independent of the softer local light.

## Upgrade 0.101.1

Use the normal backup, build and restart procedure and publish the website version. Reload clients for incremental terrain and woodland preparation. No data migration or world reset is required. Verify driving through new scenery, including snowy woodland and coastal cliffs, and check that older terrain remains visible while replacement tiles load. Compare long frame pauses as well as average FPS in the affected Firefox session.

## Upgrade 0.101.0

Back up and deploy client and server together; reload clients for matching cliff collision and terrain. The public Puddlewick migration upgrades `lighthouseVersion` to 2, saves 15 `coastalBluffs`, and moves/relevels the three named public lights. Harbour light is about 780 m from town. Ownership, employees, stock and working capital remain; housed keepers move with their lighthouse. Candidate footprints skip other buildings and people outside homes. A blocked migration retries missing sites on a later restart without duplicating completed headlands. Custom worlds are not reshaped.

Verify all three lighthouse IDs, 12 `natural-headland-` entries, and the migration marker. Retain the pre-deploy database backup: rolling back code alone would remove terrain support beneath the elevated lights. Preview the production layout read-only before deployment; check normal properties keep their heights. Test cliff approach/reverse, cliff-top construction rejection/acceptance, sea-visible flashes and land occlusion. New world exports include the bluffs and island extent.

## Upgrade 0.100.0

Back up and deploy client and server together, then reload clients for the new trading controls and matching shoreline prediction. No balance, inventory or world migration is required. Check a partial sale at a buyer with limited funds and verify the remaining inventory count updates without closing the shop.

Check a boat approaching shore forward and astern: minor hull damage, zero throttle, recoil and no repeated damage while the input remains held. Confirm reverse remains available and dock boarding/disembarking still work.

Vite ignores generated output, browser traces and reports so writing HTML capture files does not trigger a page reload during a test. Browser release checks verify remote lighthouse discovery through the directory; map screenshots allow up to 60 seconds on software-rendered CI workers. The waypoint fixture omits unrelated animated scenery and allows five minutes for its three full client loads and two captures. Gameplay assertions retain their existing timeouts.

## Upgrade 0.99.1

Restart after updating and verify `lighthouseVersion: 1` plus all three lighthouse IDs. This corrects the ownership check for public worlds administered by a player. No manual database edit is needed.

## Upgrade 0.99.0

Back up the database and deploy client and server together, then publish the
website and reload clients. A one-time public Puddlewick migration saves
`oceanVersion: 1`, `tidalRange: 0.6` and `oceanWaves: 1`; subsequent restarts
respect owner edits. Other worlds default to zero tides and natural waves.
The same upgrade places three lighthouses on safe coastal sites and saves `lighthouseVersion: 1`. They begin publicly owned, for sale, with open keeper jobs. Placement preserves existing buildings and retries missing sites if blocked. Inspect all three IDs (`parish-west-light`, `parish-east-light`, `parish-harbour-light`) after restart. No player balance grants or world reset are required.

Verify health and the migration marker, then check boat heave/pitch/roll, cabin
and chase cameras, submerged net visibility, and shoreline access. Existing
boatyard landing identities remain stable through the tide cycle. Fixed piers
sit above high tide and floating jetties follow the water. Preserve the normal
pre-upgrade backup for rollback.

## Upgrade 0.98.0

Use the normal database backup, build and restart procedure, and publish the
website version. No data migration is required. Reload clients for the rebuilt
trawl rig, angle-dependent water transparency, full-net alerts and compass fix.
Existing catches, fuel, boats and fishing economics remain unchanged.

Verify deployed and paused nets, retrieval/lifting/emptying/stowing, the underwater
view and the persistent full-capacity indicator with controls collapsed. The
hauling animation is cosmetic; catch transfer still happens immediately.

## Upgrade 0.97.0

Use the normal database backup, build and restart procedure, and publish the
website version. No data migration or terrain change is required. Reload clients
to load smooth map shorelines and the topographic overlay.

Open the map with M, zoom out to the island and check the **Contours** toggle.
Minor lines mark 10-metre intervals above sea level; stronger lines and labels
mark 50-metre intervals. Check map navigation, landmarks and the minimap coastline.
The preference is stored per browser; no new world rule is needed.

## Upgrade 0.96.4

Use the normal database backup, build and restart procedure, and publish the
website version. Deploy client and server together and reload browsers so their
collision checks agree. No world reset or data migration is required.

Verify that tractors can leave overlapping worksite walls and equipment yards
without driving through neighbouring buildings. Fishing controls must show paused
towing for a retained net, and stowed nets after hauling; refuelling alone must
not restart fishing. This release does not repeat any individual rescue or grant.

## Upgrade 0.96.3

Use the normal backup, build and restart procedure, and publish the website version.
No world reset or data migration is required. Players must reload for the client
movement and frame-scheduling fixes. Check steady driving in a fast tractor after
refreshing, including turns and slopes; compare motion consistency as well as FPS.

## Upgrade 0.96.2

Use the normal database backup, build and service restart. No world reset or
manual migration is required; existing NPC memories and agreed buying pauses
remain compatible. Scheduled business owners also reassess previously saved long
absences. Publish the website so its displayed version matches the game.

After deployment, verify service health and observe owner maintenance journals,
reopened supply bids, actual supplier payments, production and paid employment.
Track surplus withdrawals together with their subsequent purchases or expansion.
The 48-hour mechanical regression uses scripted trading partners; it does not
establish long-term autonomous Jev results. No paid accelerated test is required
or started by this release.

## Upgrade 0.96.1

Deploy client and server together and reload browsers. No world migration is
required. Check buying and boarding from dry land throughout the boatyard's
40-metre menu range, plus collapsed and expanded fishing controls above the
driving readout on desktop, phone portrait and phone landscape layouts.

## Upgrade 0.95.0

Back up the database and deploy client and server together, then reload browsers.
Preserve the saved `terrainMapSize`, `fishingVoyageVersion`, crew agreements,
provisions, voyage accounts and hidden trawl state when moving or restoring worlds.
Existing boats, paint, fuel, property and island terrain remain in place; the
higher purchase prices apply to new purchases only.

A one-time public Puddlewick migration expands navigable ocean by 6,000 metres
(up to a 20,000-metre world), preserving the original terrain domain. It enlarges
the public boatyard's storage to 4,000 and supplies working capital of at least
500s after paying for its initial delivery of up to 512 Fuel. These are recorded
transactions; the migration does not repeat on restart. Verify the migration
marker, terrain extent, ocean extent and yard stock after deployment.

Check wider dock arrivals, continuous towing and hauling, private catch snapshots,
crew boarding/settlement, provisions and the working wheelhouse compass. Economic
simulations cover loss-making trips and occasional full holds; actual earnings
still depend on player prices, buyers' cash and selling time. Publish the website
separately so its release summary matches the game.

## Upgrade 0.94.0

Back up the database, deploy client and server together, and reload browsers for
boathouses, dock-only boarding, lifeboat rescue and commercial fishing. Puddlewick
receives a public boatyard on a clear shoreline site; a blocked site is left alone
and retried on startup. Existing property and terrain are preserved. Verify the
new yard and its fuel supply after deployment. New seafood quotes are added
without overwriting existing player prices.

Keep saved moorings, boat rescues and trawl progress when moving worlds. The main
boat and cargo remain offshore during a rescue. Newly purchased boats start with
empty tanks; bring fuel. Validate boarding at the yard and pier, empty-tank rescue,
returning to the same boat, and a single catch delivery after trawling. Publish the
website separately to add the boathouse to its 49-type building gallery.

## Upgrade 0.93.2

Deploy client and server together and reload browsers. The starter town’s circular
gravel square now shares its surface footprint with driving traction and snow
rendering. No world migration or weather reset is required. Verify that tractors
cross the circle at road speed without leaving snow tracks, while adjacent snowy
ground still slows travel and records tracks.

## Upgrade 0.93.1

Client-only camera and sign-rendering fixes; no additional world migration or player
data changes. Reload browsers after deploying. Verify the seated tractor view on
uphill, downhill and cross slopes and the complete Flying Club sign lettering.
Browser CI retains eight single-renderer shards and per-test deadlines, with a
20-minute whole-suite limit and 25-minute job limit for setup and diagnostics.

## Upgrade 0.93.0

Back up before deployment. On startup the default public Puddlewick gets a safe
western airfield, including a level runway, hangar and apron. Placement checks
private buildings, farm plots, creator obstacles, water and town limits. A blocked
site is left unchanged and retried on a later startup. The live town’s 310-metre
radius accommodates a 240-metre runway; a fresh 300-metre parish uses 220 metres.
No buildings or town boundaries move. A few public gathering spots are relocated
beside the strip, retaining their IDs and depletion state. Preserve the saved
airfield and relocation fields when moving or restoring worlds.

Reload clients for hangar boarding, runway markings and crash effects. Only
biplane boarding changes location; existing owned planes retain their fuel,
paint and condition. Spare airframes are a persisted count (`spareBiplanes`);
commissioning one at the hangar consumes a spare and starts with an empty tank.
Do not put duplicate vehicle IDs in `fleet`. In Puddlewick the hangar replaces
the garage aircraft desk. Worlds without a completed hangar retain garage boarding
and do not automatically receive an airfield.

Validate the hangar’s four-airframe count, clear-apron requirement, takeoff and
controlled landing within the runway, and destruction of one plane while reserves
survive. Crash effects consume authoritative position-stamped events; old crashes
do not replay when joining. The particle pool is bounded to 256 particles, and
runway paint and edge markers are batched rather than adding dynamic lights.

## Upgrade 0.92.0

Reload browsers for the continuous character mesh, recorded walk/run animation
and corrected biplane keyboard pitch (Down raises the nose; Up lowers it). No world
reset or data migration is required. Back up the database before deploying as usual.
Preserve the CMU motion attribution in `THIRD_PARTY_NOTICES.md` and
`art/motion/README.md` when distributing source or compiled clients.

Check forward walking, jogging, stopping, reversing and seated drivers. The human
suite covers mesh connectivity, skin weights, separate skeletons, foot contact,
knee stability and rendering budgets. Flight coverage includes delayed-input
landings and a real keyboard/server/browser takeoff using the corrected controls.

## Upgrade 0.90.0

Reload browsers for the rebuilt hovercraft, engine-driven fan and seated cockpit.
No world reset or data migration is needed. Paint, fuel, prices and handling are
unchanged. Validate ground clearance, fan animation and cockpit instruments; the
focused hovercraft browser check and production build cover these changes.

## Upgrade 0.89.0

Reload browsers to load the rebuilt biplane and its working cockpit instruments.
Existing aircraft, fuel, paint and physics remain compatible; no world reset or
data migration is needed. Back up before deploying as usual. Validate the grounded
and airborne views, engine-controlled propeller and first-person instruments.

## Upgrade 0.88.0

Back up the database and reload browsers after deployment. Six tractor designs
use slot 0 and newly appended slots 24–28; existing vehicles and creator slots
8–23 retain their identities. No world reset or manual migration is needed.
Old shared fuel is adopted once when switching legacy vehicles; new specialist
purchases start empty, and each parked tank then preserves its own fuel. Old
paint is retained by already-owned machines when the first purchase or repaint
migrates it; future purchases start in their factory colours. Retain the backup
for rollback: older versions do not understand the new slots or per-machine state.

Check the garage's six model previews, purchase/recall controls and independent
paint choices. Verify first-person instruments and model-specific fuel capacity.
Validation: 948 unit/integration tests, desktop and phone garage checks, corrected
creator/parish browser checks, and visual review of all six exteriors and cockpits.

## Upgrade 0.87.2

Back up the world database before starting this version. Startup repairs duplicated
town meeting-place references and restores Puddlewick's missing public fountain
and benches on a clear nearby lot. Existing town borders, governments, money and
property remain unchanged; no world reset is needed. Restoration runs once, retries
on later startups if no safe lot is available, and respects later deliberate removal.
Verify that Puddlewick and Mabel's Reach each reference their own physical town centre.
Validation: all 938 tests and the production build passed, followed by a migration
rehearsal on a copy of the live world and a browser check of the restored centre.

## Upgrade 0.87.1

Upgrade the host's Node.js runtime to **24.22.1 or a newer patched 24.x LTS**
before deploying. Updating npm dependencies alone does not fix the Node runtime.
Back up the live database and preserve the previous executable for rollback;
replace the binary atomically, then gracefully restart Aclone. Verify the actual
running process version and public health endpoint. Other Node services, including
the Discord changelog publisher, must also use the patched runtime. Rebuild Docker
images with `--pull`; this release pins the security baseline in Docker and CI.
No world reset or database migration is needed. Validation: all 931 tests and the
production build passed under Node 24.22.1; an isolated startup on nogits passed
with a disposable database. The full dependency audit reports no known advisories.

## Upgrade 0.87.0

Reload browsers for **F9 → Statistics**. No world reset is needed. Personal
activity counters start with this upgrade and survive death; existing death totals
are retained. The new `player_playtime` table persists connected time across sessions.
Before the first startup, install any recovered connection history as
`<DATA_DIR>/statistics-history.json`; see [the import format](DATA.md#player-statistics-and-historical-playtime).
Nogits already has its recovered backup evidence staged there. Each account's
historical estimate imports once, separately from newly tracked time; retain both
the database and the evidence file in backups. Existing money/material/building
activity is explicitly marked incomplete rather than guessed.

## Upgrade 0.86.0

Reload browsers for hillside furniture, tractor tilt and distant terrain. Existing
worlds gradually plan town connections and bypass obstructed roads at the next
game-day boundaries; no reset is required. Road plans and retired stretches persist
in world saves, so retain the pre-upgrade database backup for rollback. Validation:
920 unit/integration tests, the real-game hill-town/road browser check and production build.

## Upgrade 0.85.4

Reload browsers for the snow-edge and thaw corrections. No data migration,
world reset or weather recalculation is required. Validation includes type checking,
eight focused snow-geometry tests, a full-town thaw regression with screenshots at
4 cm, 1 cm, 3 mm and zero snow, and the production build.

## Upgrade 0.85.3

Refresh the game after deployment to load the snow-depth graphics. Existing
saved snow depths immediately control roof caps, roadside banks, obstacle drifts
and tyre-rut relief. This is a client rendering update; it needs no migration,
world reset, snowfall recalculation or player-data changes. Validation includes
906 unit/integration tests, 19 focused snow/track checks, and two browser checks
covering road visibility, tyre tracks and a full town at several snow depths.

## Upgrade 0.85.2

Refresh browsers after deployment for adaptive graphics and startup fixes. No
world migration or reset is required. Detailed mode remains an explicit choice;
use F9 → Options & pilot key to select Adaptive or Performance. Validation includes
897 unit/integration tests, the production build, and focused browser checks for
snow rendering, full-town weather, cold startup and the loading-screen fallback.

## Upgrade 0.85.1

Deploy the entire built `dist/` directory, including `.br` and `.gz` sidecars.
HTML revalidates; fingerprinted assets can stay cached for a year. No data migration
or reset is required. This improves downloads, not steady-state rendering FPS.

## Upgrade 0.85.0

Natural snowfall now favours shallow packs. Existing natural snow deeper than
12 cm is reduced to 12 cm once when the world next advances; later storms are
not capped. Creator-forced weather is preserved. Back up before deploying and
refresh clients for matching snow visuals. No reset or ownership changes are needed.
The terrain uses its existing vertices to show depth; roads stay exposed and
tracks/contact shadows follow the snow surface.

## Upgrade 0.84.0

NPC financial facts and owner-business agreements require no reset or manual migration.
Existing private memories and delivery/job agreements remain readable. Recent operating
cash-flow tracking starts with the next money movement; earlier recent history is
unknown. Agreed withdrawals protect operating reserves and investor claims. No prices,
player balances or world settings are changed by deployment.

### Snow state introduced in 0.83.0

Snow depth and the protected winter base are persisted with climate state. Existing saves convert their old snow coverage to a thin layer (at most 4 cm); they do not gain deep drifts. No world reset or manual migration is needed. Roads stay exposed, and players and NPCs share depth-dependent off-road handling. Weather and sunny-day thaw remain consistent through save/reload and offline catch-up.

### Business controls introduced in 0.82.0

No data reset or manual migration is needed. Missing paid-job limits resolve to
ideal staffing minus a working owner (farms: 16). Existing employees stay employed;
only explicit dismissal removes them. NPC owners may choose smaller crews using
estimated hourly margins. Human-owned prices, wages and rosters are preserved.
Pushing alone does not restart nogits or publish its Discord notes; deployment
requires separate authorization.

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
