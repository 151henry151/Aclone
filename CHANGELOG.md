# Changelog

All notable changes to Aclone are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
