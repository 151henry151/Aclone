# Changelog

All notable changes to Aclone are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
