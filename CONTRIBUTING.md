# Contributing to Aclone

Aclone is a GPL-3.0-or-later community project. Small, well-tested changes are
welcome. All gameplay content and assets must be original or demonstrably
license-compatible. Do not extract anything from the original game.

## Development setup

Use Node.js 24.14+ and `npm ci`. Run `npm run dev`, open the printed URL, and
create a test world to access the editor. Keep a separate `DATA_DIR` for
experiments that alter an economy. Data files are plain JSON; no authoring tool
is required. The server runs on Linux without a display.

Read the architecture and data guides before changing simulation code. Keep
presentation in `src/client`, deterministic rules in `src/shared`, and I/O,
identity and persistence in `src/server`. New features should be small modules
rather than additional unrelated responsibilities in the request handler.

## Test-driven workflow

1. Describe the player-visible behaviour, including failure cases and authority.
2. Write a failing test first, or add the test alongside the smallest change.
3. Implement the behaviour with server validation. Never trust client totals,
   positions, ownership, completion timestamps or permissions.
4. Run the targeted test, then `npm run check`, `npm run format:check` and
   `npm run build`. Run browser tests for interface or connection changes.
5. Add a human-readable Unreleased changelog entry. Review README and relevant
   guides. Document any inferred rules or historical-fidelity tradeoffs.

Economy tests should assert conservation, rounding, failure atomicity, storage
limits and duplicate-request behaviour. Tests that merely repeat an assignment
are not useful. Timer tests should advance the simulation rather than sleep.
Network tests should use a real headless server and fake WebSocket clients.

Use `npm run format` for the source, tests and maintained docs. Do not reformat
research archives. TypeScript is strict. Use SPDX headers on new code files.
JSON and other files that cannot contain comments are covered by COPYRIGHT.

## CI browser checks

CI limits unit-test concurrency to two and runs browser checks on separate runners. Each browser shard uses one software renderer; `--shard=1/2` or `--shard=2/2` reproduces the split. A separate `/aclone/` job runs `game.spec.ts` and `expansion.spec.ts` against the prefixed production build; other browser suites start isolated servers themselves. Server health must succeed before tests start. Failures/cancellations retain screenshots, traces and server logs.

Use performance graphics for functional tests on software rendering; `TEST_GPU=1` enables detailed capture where supported. Wait for observable UI state after a server mutation or viewport resize. Hold finite task fixtures until assertions finish, then explicitly test completion; do not depend on screenshot speed or add retries to conceal a failure.

For cold-load diagnostics, run `npm run build` then `CHROMIUM_PATH=/usr/bin/chromium npm run profile:startup`. This creates a disposable parish with eight extra tractors and saves CPU, frame, resource and readiness timings under `test-results/startup`. `PROFILE_GPU=1` requests hardware rendering; inspect the recorded renderer before comparing results. `PROFILE_SECONDS=25` shortens the default minute. Browser entry assertions allow up to 60 seconds for preparation; ordinary interaction waits remain unchanged.

## Sending changes

Open an issue describing substantial changes, then a focused pull request with
what changed, why and how it was tested. Include screenshots for visible UI
changes. Do not include a saved pilot key, `var/`, `.env`, research exports,
binaries, `node_modules`, or `dist`.

By contributing, you confirm you can license your contribution under
GPL-3.0-or-later. No contributor license agreement or copyright assignment is
required. Credit contributors in release notes when publishing releases.

## Versions and releases

The local bootstrap was 0.1.0; the first public alpha is 0.2.0. Minor versions add compatible features;
patch versions fix bugs. Version 1.0.0 requires stable completion of the six
specification milestones, not simply a working demo. Never rewrite a published
release. Keep Unreleased at the top of CHANGELOG.

Only commit, push, or publish when the project owner explicitly requests it.
The release checklist is in `docs/RELEASING.md`.

## Community expectations

Be kind and concrete. Critique code and ideas, not people. Respect privacy,
accessibility needs and different levels of experience. Harassment, threats,
identity-based attacks and posting private information are not acceptable.
Report security issues privately using the process in SECURITY.md.

Visual capture commands and options live in [Art](docs/ART.md#reviewing-visual-changes). Browser checks use software rendering by default; `TEST_GPU=1` selects supported hardware. Do not run CPU-heavy unit/load suites alongside software browser tests, and never target production with staging scripts.
