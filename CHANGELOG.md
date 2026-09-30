# Changelog

All notable changes to Aclone are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.1] - 2026-09-30

### Changed

- Standardize default non-harbour selling prices to the item reference price. Harbour stores pays 3% more for deliveries and sells at a higher price, so there is no profitable buy-back loop within one store. Untouched saved defaults migrate once; custom quotes, cash and stock remain intact.

### Fixed

- Wheeled vehicles steer naturally while reversing, based on actual movement direction even while braking. Walking and aircraft controls retain their existing turn direction.
- Owners cannot trade with, take employment at, refresh shifts at, or start workplace tasks at their own property. The interface directs them to Stockroom and Building Admin instead.
- Purchasing your workplace clears your employment there. Legacy owner-employees and reserved self-paid harvest wages are removed; owners can still tend their own farm plots without wages.
- Seasonal capture fixtures now find the relocated cottage, farm and spaceport instead of using old coordinates.
- Run browser checks sequentially so competing software WebGL renderers do not cause input and connection timeouts on CI.

## [0.6.0] - 2026-09-30

### Changed

- Spread the starter town across roughly eight times its previous area, with winding connected lanes, branches and loops instead of a compact crossroad layout. Buildings, vehicles and characters retain their metre scale.
- Road textures, roadside vegetation, streetlights and the parish map now share the same street plan; terrain accommodates the expanded town while preserving the coast and terrain edits.
- Existing untouched starter lots move once on load, preserving ownership, prices, inventory and residents. Edited and player-built properties remain in place; occupied destinations are skipped, and pilots parked on newly occupied lots are placed outside the walls.

## [0.5.1] - 2026-09-30

### Fixed

- The “At home · Go outside” button now accepts clicks that overlap live world updates, allowing residents and guests to leave reliably. Nearby-building and fishing prompts also retain keyboard focus between unchanged updates.
- Focused buttons respond to Space and Enter instead of triggering the horn or chat shortcuts.

## [0.5.0] - 2026-09-30

### Added

- Player-built bed & breakfasts and hotels with three or eight prepaid rooms, configurable hourly rates, food service trading, protected personal pantries, offline meals and durable checkout.
- Eight processing businesses: composting yards, brick kilns, concrete works, furniture workshops, wineries, kitchens, tea blending houses and coffee roasteries. Their materials, professions, input/output recipes and construction costs connect gathering, farming and hospitality.
- Finite woodland, stone, gravel and topsoil gathering grounds, with saved depletion, gradual replenishment and forestry/excavation qualifications.
- Persistent snow accumulation and thaw, wet roads, thunderstorms with lightning, blizzards, and reduced ground-vehicle speed and grip in poor conditions.
- Occupied evening windows with varied bedtimes, all-night street lighting, real light on the ground, and dark countryside that needs headlights. Nearby lighting uses a fixed rendering budget.
- Evergreen, birch and broadleaf groves, varied tree sizes, distinctive guesthouses and industrial building silhouettes.
- Gravel drainage, compost fertilizer and topsoil restoration for farm plots; crop-specific frost and waterlogging responses and downstream uses for all six crops.

### Changed

- Residents left at home keep their chimneys active and consume stored food and drink after logout. Offline ageing and health loss still pause.
- Production shift lengths now follow each business's cycle duration while respecting the world owner's production-speed setting.
- Manual logging and quarry work move to gathering grounds, with tool requirements, cargo checks and persistent completion.

### Security

- Guest pantry contents are visible only in their owner's private snapshot. Other guests and property owners cannot withdraw them; occupied or stocked lodging cannot be demolished.

## [0.4.0] - 2026-09-29

### Added

- Balanced team deathmatch, capture-point and capture-the-flag rounds, protected respawns, ammunition refits, server-timed javelin charges, bouncing grenades, armed mines and optional treasury kill rewards.
- A seven-system galaxy route map, saved jump journeys, ship hangars and upgrades, shared station inventories, courier contracts, surveys, alien-ship discovery unlocks and stranded-pilot rescue.
- Four seasonal farm plots with six crops, planting windows, rain and irrigation, fertilizer, family rotation, frost effects, dated harvests and funded harvest shifts that finish safely after disconnecting.
- Four seasons, moving sunlight, sunrise and sunset, rain, snow, autumn foliage and winter coverage on ground and buildings. Ten-minute days and the 365-day calendar are aligned at default speed.
- Six stone and timber cottage styles, seven garage paint finishes, and chimney smoke driven by online occupants or nearby active workers.
- A detailed player guide, persistence and multiplayer regression coverage, and reproducible seasonal gameplay captures.

### Changed

- Farms produce scheduled crops instead of automatically adding wheat every production cycle. Existing stock is retained; planting and harvest care now determine future output.
- Bound smoke, precipitation and projectile rendering in shared pools; crop visuals update by growth stage without rebuilding the village.

### Fixed

- Prevent fast shots crossing safe-zone boundaries, friendly fire in arena teams, duplicate harvest collection, and repeated match-result rewards.
- Commit station stock and pilot cargo together, preserving both on failed writes and completing saved journeys after reconnecting.

## [0.3.4] - 2026-09-29

### Changed

- Re-proportion tractors around a full-size adult driver: lower and narrower glazing, a compact roof, matching mirrors and exhaust, corrected cockpit eye position and wheel rotation.
- Give buildings distinct metre-scale footprints and silhouettes: cottages, two-storey pubs and banks, awning-front shops, schools, barns, workshops, a mill wheel and a spaceport control tower. Door and window sizes stay consistent between buildings.
- Reduce oversized street lamps, fountain benches, grass and garden hedges; fit planting and fences to building footprints while retaining varied mature trees.

### Fixed

- Match building picking and movement collisions to rotated building volumes instead of one fixed-size box/circle. Pilots caught inside a changed footprint can move toward its edge.

## [0.3.3] - 2026-09-29

### Fixed

- Replace the faceted walking placeholder and blocky cab driver with one original, smoothly shaded human model: shaped face, hair and cap, cloth detail, articulated hands, trousers and boots. The cab driver has a seated pose with arms reaching the steering wheel.
- Animate walking with jointed arms and legs and planted-foot motion driven by displayed travel. Bring the walking camera closer, use human eye height, and hide the local figure in first-person views to prevent face clipping.
- Share character geometry between pilots and keep seated drivers batched into three material draws, with automated geometry, independent-animation, draw-budget and foot-clearance checks. Add reproducible in-game character captures and browser coverage for walking and returning to the tractor.

## [0.3.2] - 2026-09-29

### Fixed

- Smooth driving between server updates using timestamped movement history instead of repeatedly easing toward stationary snapshots. Camera direction, headlights and wheel animation now follow the same displayed motion.
- Remove the artificial 10 FPS software-rendering cap; software and performance modes now target up to 30 FPS, with consistent frame pacing. Actual frame rate still depends on hardware.
- Reset visual motion on large teleports, vehicle changes, world changes and long pauses, and stop at the last known position when updates run out.

## [0.3.1] - 2026-09-29

### Fixed

- Start the Lua execution deadline after the isolated worker has loaded its runtime, with a separate bounded startup deadline, to avoid false script timeouts on busy hosts.
- Pause failing automatic world scripts for 60 seconds after one chat notice. Successful editor reloads allow an immediate retry; stale failures from replaced scripts are discarded.
- Distinguish other pilots from landmarks with compact, rounded PILOT nameplates instead of oversized building-style signs.

## [0.3.0] - 2026-09-29

### Added

- Scenery view: press H to hide the HUD and H or Escape to restore it.
- Optional password sign-in for existing pilots, recovery email verification, expiring single-use password reset links, and sign-out across devices. SMTP is configured by the operator.
- Repeatable load probe with real WebSocket clients in a separate process and disconnect/restart regression coverage.

### Changed

- Rebuilt countryside graphics around original meadow, gravel, limestone and slate textures, softly worn road verges, leafy trees, garden fences, a village fountain, layered clouds and warmer lighting. Cottages have textured gables and industrial annexes.
- Redesigned tractors with glazed cabs, rounded bonnets, detailed grilles, mirrors, wheel hubs and animated chevron-tread tyres. Static bodies and wheels are batched separately.
- Added a detailed graphics setting alongside adaptive and performance modes. Performance mode retains material textures and contact shading; detailed mode retains dynamic shadows. Texture assets respect subpath hosting and are documented with their generation prompts.
- Protocol 2 sends changed world fields and players, shares serialized frames across recipients, and compresses WebSocket traffic. Legacy full-state clients remain supported.
- Disconnected pilots pause hunger, thirst, ageing and property decay. Production, wages, lessons and pending tasks continue, without erasing an absent player's estate.
- SQLite uses full synchronous durability and an indexed normalized pilot-name lookup. Existing saves migrate automatically.

### Fixed

- Replaced connections lose authority immediately, so a stale socket cannot keep playing after sign-in elsewhere or password recovery.
- Unclaimed starter businesses no longer decay out of existence while nobody is playing.

### Security

- Passwords use salted asynchronous scrypt; recovery tokens are stored hashed and expire. Verified email is required for recovery, and password resets revoke existing pilot keys and connections.
- Bounded password hashing, account-request throttling, reset-email cooldowns, connection limits and slow-client disconnection bound resource use.

## [0.2.1] - 2026-09-29

### Added

- Prefix client API, WebSocket, and uploaded-asset URLs with the Vite base so a production build can be mounted under a path such as `/aclone/`.
- Count pilot registrations by `X-Real-IP` when the connection comes from loopback, so a reverse proxy does not share one registration limit across every visitor.

## [0.2.0] - 2026-09-29

### Added

- First public development alpha, with original procedural countryside, tractors, a village and a browser interface.
- Persistent multiplayer worlds with validated input, public and private chat, authority checks, recoverable pilot identities and SQLite backups.
- Building trading, exact currency accounting, taxes, stockrooms, investments, funded production and wages, skills, tasks, construction, survival and home supplies.
- Data-defined vehicle slots, weapons and production chains; Hornball, circuit racing, fishing, robocrows and an original two-player Ultrakricket interpretation.
- Galaxy directory, world creation, local-to-galactic exchange, jump range, ships and station trading.
- Live owner editor for rules, terrain, building placement, zones and isolated Lua scripts, plus original asset uploads.
- GPL-3.0-or-later licensing, contributor guidelines, end-user guide, hosting and recovery instructions, developer documentation, CI and automated tests.
- Player-to-player property listings, persistent vehicle fleets, per-world vehicle physics and editable per-building production recipes.
- Original gameplay screenshots, a source-release packaging script, Docker/Compose deployment and a performance rendering mode.

### Fixed

- Reject invalid trade quantities without changing balances or stock.
- Accept negative sea levels when applying the default world settings.
- Preserve player state when a fishing join request fails validation.
- Run Lua using an isolated worker with the supported TypeScript registration API.
- Separate uploaded world assets from the production client bundle routes.
- Reject fractional cash/count settings and prevent purchasing seeded business capital for profit.

### Security

- Store pilot credentials as hashes, validate world actions and enforce owner authority on server-side edits.
- Save credit conversions and local cash changes atomically, isolate Lua workers, and bound uploads and request rates.

The local 0.1.0 bootstrap was not published. This first public version advances
to 0.2.0 for the implemented multiplayer and editor functionality. It is an alpha;
remaining specification work is documented in docs/STATUS.md.
