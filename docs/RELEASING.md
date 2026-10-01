# Release checklist

Publishing requires an explicit request from the project owner. No commit,
push, registry publish, public deployment or GitHub release is implicit in a
build or test command.

## Deploying 0.15.0

Back up the SQLite database, pull the release, run `npm ci`, rebuild with
`BASE_PATH=/aclone npm run build` and restart the existing service. No route changes
are needed. Enable the new fifteen residents with `NPC_POPULATION_ENABLED=true`
in the server environment; `NPC_TIME_ZONE` defaults to `America/New_York`.
Existing identities and memory survive. All residents share the same spending caps.
Mabel stays online, and enabled Toby/Rowan/Elias receive longer scheduled visits.

Offline starvation is now active for all pilots, including restart catch-up.
Provision a home or a booked room before a long absence; empty stores and booking
expiry can lead to death and ordinary estate losses. Ageing and passive property
decay still pause offline. This supersedes older releases' offline protections.

## Release procedure

1. Complete the required behaviour and its regression tests.
2. Run `npm run check`, `npm run format:check`, `npm run build` and the browser
   suite against a fresh disposable instance. Review visual evidence.
3. Test backup restoration and any required schema migration.
4. Move Unreleased entries into a dated `## [X.Y.Z] - YYYY-MM-DD` section and keep
   an empty Unreleased section above it.
5. Bump the semantic version in package.json, package-lock.json, the shared version export (health, startup and UI consume package.json). Update README and relevant docs.
6. Stage only intended source, content and documentation. Inspect for credentials
   and research/private material. Commit with an imperative message and push only
   when explicitly requested. Do not rewrite a published release.
7. Run `npm run package` to build a source archive from the explicit allowlist.
   It excludes the supplied research spec, sources/, tools/, credentials, saved
   worlds, generated client builds and dependency binaries. The archive contains
   the build scripts and lockfile so recipients can build the GPL-covered game.
8. Build/deploy from the release, verify health and a real play session, then
   publish release notes and archive checksums as requested.

0.1.0 was the local bootstrap; 0.2.0 is the first public alpha. Advance minor versions for implemented
milestones and patch versions for fixes. Do not label a release 1.0.0 while
STATUS.md still lists unresolved required milestone features.

## 0.3.0 upgrade notes

Back up the database and uploaded assets before upgrading. This release migrates
account storage from schema 1 to schema 2; a rollback to 0.2.x requires restoring
the pre-upgrade backup. Existing pilots and pilot keys remain usable. Configure
SMTP and PUBLIC_ORIGIN only if enabling email verification and password recovery;
passwords also work without mail delivery. See [hosting and recovery](HOSTING.md).

For a deployment at `/aclone/`, retain `BASE_PATH=/aclone` at build time and the
prefix-stripping reverse proxy. Include the new `public/textures/` files in the
client build. Editable PNG masters in `art/materials/` ship in the source archive,
but are excluded from the runtime Docker build context.

## 0.3.1 upgrade notes

No schema change. Pull and install the locked dependencies, rebuild with the
existing `BASE_PATH` (for hromp.com, `/aclone`), then restart the Node service so
it loads the script-worker changes. Refresh browser clients for the pilot labels.
Existing script errors are chat history; the upgrade does not erase messages or
pilot accounts. A connected test pilot remains a player until its session closes.

## 0.3.2 upgrade notes

No schema or wire-protocol change. Rebuild the browser bundle with the existing
`BASE_PATH`, restart the service to report the new version, and refresh clients.
The movement fix is in the client bundle; pulling source without rebuilding will
continue serving the old movement code. Software rendering can now draw up to
30 FPS, so CPU use may increase on machines without GPU acceleration.

## 0.3.3 upgrade notes

No schema or protocol change, and no new external asset downloads. Rebuild with
the existing `BASE_PATH`, restart the service, and refresh browser clients to load
the character models and walking-camera changes. The editable character source
and capture script are included in the source archive.

## 0.3.4 upgrade notes

No schema or protocol change. Rebuild the browser bundle with the existing
`BASE_PATH` and restart the Node service: rendering and authoritative building
collision share the new footprint definitions. Saved building identities,
positions, ownership and inventory remain intact. A player caught inside a
changed footprint can drive or walk toward its edge to escape. Refresh clients
so displayed geometry matches the server collision model.

## 0.4.0 upgrade notes

Back up first, rebuild with your existing `BASE_PATH=/aclone`, restart the server
and refresh all clients. The additions use optional JSON fields; missing combat
settings and public-market crop listings are filled on load without resetting
accounts, buildings, stock or custom prices. Station supply uses the existing
metadata table. No database schema migration or new service is required.

Farms keep their stock and employment but stop automatic wheat production. Owners
must learn farmer, fund seeds and plant plots. Legacy custom farm production
recipes are retained in the save but no longer executed; other custom recipes are
unchanged. Read [PLAYING.md](PLAYING.md) before upgrading a busy economy.

Production at hromp.com remains an operator-managed pull/rebuild/restart deployment.

## 0.5.0 upgrade notes

Back up, pull, run `npm ci`, rebuild with `BASE_PATH=/aclone npm run build` and
restart using the existing hosting configuration. Refresh clients. There is no new
service or SQL schema migration; optional save fields preserve old accounts,
properties, crops and stock. New public-market items start empty. New industries
and lodging are player-buildable and are not forced into established towns.

Residents left inside now consume provisions while offline. Health loss and ageing
remain paused offline. Manual logging/quarry tasks move to the Resources grounds;
carry tools. Read [ECONOMY.md](ECONOMY.md) for the new material chains, professions,
soil care and guest protections. Light and weather changes apply in every graphics
mode. The screenshots are local staged worlds, not evidence of a production deploy.

## 0.5.1 upgrade notes

No save, schema or protocol changes. Rebuild the client with the existing
`BASE_PATH`, restart the service and refresh open clients. This fixes the
Go outside button losing clicks during world updates, and restores native
Space/Enter activation for focused buttons.

## 0.6.0 upgrade notes

Back up the database and assets, pull, install dependencies, rebuild with your
existing `BASE_PATH=/aclone`, restart, and refresh clients. The town footprint
is about eight times larger (area, not eight times each dimension). Building
models, player size, speed, map boundaries and activity locations remain unchanged.

On first load, starter buildings still at their original coordinates relocate
to the new parish plan. Ownership, prices, stock, plots, employment and IDs stay
intact; nearby grounded pilots and residents move with their building. Edited
starter positions and player-built lots are preserved. A destination occupied
by another retained property is skipped. Such customized worlds can retain
some compact lots alongside the expanded street network. Terrain brushes remain
additive over the wider flat parish; coastal water remains south of town.

The optional saved `townLayout` field prevents a second move. A rollback should
restore the pre-upgrade backup so old clients do not show old roads over new lots.
No production deployment is performed by the release scripts.

## 0.6.1 upgrade notes

Back up, pull, rebuild with the existing `BASE_PATH` and restart; refresh browser
clients for the owner controls. Saved accounts, stock, money and property IDs are
preserved. Default buy/sell quotes matching the 0.6.0 data pack migrate once to
the delivery pricing model; other saved quotes are kept. The optional saved
`tradePricing` field prevents future loads from overwriting subsequent edits.

Owner-employees are removed from their own payroll on load and property purchase.
Existing self-paid harvest reservations become unpaid; the produce still goes to
the farm. Other staff and employment at other buildings remain intact. Workplace
tasks already in progress can complete; new tasks at one's own building are blocked.

## 0.7.0 upgrade notes

No save, database-schema or wire-protocol changes. Pull, rebuild with the existing
`BASE_PATH=/aclone`, restart the service and refresh browser clients. The stars
and lunar surfaces are generated by the client; no external sky assets or new
services are required. Sunrise, sunset and moon phases share the saved calendar.
The nearby moon pair follows a 28-game-day phase cycle, continuing across years.

This release also broadens headlights and street lighting and makes clear nights
more navigable by starlight and moonlight. Cloud cover still dims natural light.
In first-person view, drag vertically to look up. Night-sky and lighting capture
scripts use disposable local worlds; their screenshots do not represent a
production deployment. Production remains an operator-managed pull/rebuild/restart.

## 0.8.0 upgrade notes

No database migration, new dependency or external audio files are required. Pull,
rebuild with `BASE_PATH=/aclone npm run build`, restart the Node service, and
refresh clients. Restarting is necessary: snapshots now include public motor
and production activity fields used by the new client audio. Saved accounts,
property, inventories and settings remain intact.

Sound starts after a click, tap or keypress. Previously saved mute preferences
are respected; use the Sound button to enable it and Pilot & preferences to
adjust volume. New browser profiles default to sound enabled. Hidden tabs,
disconnected clients and space travel are silent. Audio samples are synthesized
locally and cached; there are no audio download paths to configure for subpath
hosting. Production remains an operator-managed pull/rebuild/restart.

## 0.8.1 upgrade notes

Rebuild the client with the existing `BASE_PATH=/aclone`, restart the service
and refresh browsers. Evergreen geometry, bark and needle textures are generated
locally; no new downloaded assets or dependencies are needed. There are no save,
schema or protocol changes. Grove locations and other scenery placement are
preserved. Performance mode keeps the same branch layout with fewer small sprays.

## 0.9.0 upgrade notes

No database or wire-protocol changes. Rebuild with the existing `BASE_PATH`
(`BASE_PATH=/aclone npm run build` for hromp.com), restart the service to report
its new version, and refresh browser clients. M now toggles an enlarged map;
Parish Directory keeps its separate buttons. Existing worlds, custom properties
and resource reserves are unchanged. Production remains an operator-managed
pull/rebuild/restart deployment.

## 0.10.0 upgrade notes

Back up the database, pull, run `npm ci`, rebuild with `BASE_PATH=/aclone npm run build`, and restart the Node service. Refresh browser clients for AI identity,
private chat and the memory notice. Existing accounts and worlds are preserved;
four additive NPC tables are created when the optional controller is enabled.
SQLite backups include its memories, pause state and usage reservations.

Enable **one** Mabel with `NPC_ENABLED=true` and `OPENAI_API_KEY` in the server's
private environment. The development machine's `.env` is deliberately not pushed:
configure the production host separately. Native `npm start` does not read `.env`
automatically; use the service's EnvironmentFile or `node --env-file=.env --import tsx src/server/main.ts`. Docker Compose passes the listed settings from its `.env`.
Keep `NPC_ID=mabel` stable and keep the same DATA_DIR across restarts. See
[NPCS.md](NPCS.md) for spending limits and pause/usage commands.

Ship `docs/FAQ.md`, `docs/PLAYING.md` and `docs/ECONOMY.md` with the server; they
power the local help lookup. Docker and the source archive include them. The API
key stays server-side; no browser build variable should contain it. Production
remains an operator-managed pull/rebuild/restart deployment.
