# Releasing and deploying

Publish, commit, push or deploy only when explicitly requested. Builds and tests do not authorize publication. [Release notes](RELEASE_NOTES.md#upgrade-archive) retain older migrations and validation records; [CHANGELOG](../CHANGELOG.md) records dated changes.

## Release procedure

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

See [Hosting](HOSTING.md) for service/proxy details. A code rollback cannot undo migrations or recover removed stock: restore the matching pre-upgrade database/assets too. Do not share a database between processes.

## Current upgrade: 0.32.1

0.32.1 stabilizes browser verification without gameplay changes. The 0.32.0 feature release adds opt-in creator quests, action requirements and per-player Lua progress. Existing worlds receive empty quest/requirement lists; Lua progress resets on death by default. No existing character economy or property is reset.

The 0.31.0 procurement upgrade enables bounded hourly parish orders in existing server-owned Puddlewick once, without resetting stock or changing owned prices. Other worlds opt in through settings.

The 0.30.0 reporting upgrade adds business statements and private return/history reports. Existing stock, cash and ownership stay unchanged; accounting starts with newly recorded activity. SQLite receives an optional ledger-details column. Back up the database and uploaded assets before upgrading; a rollback to an older executable needs its matching database backup. Restart the server and refresh clients together. The preceding NPC fix restores replies while preparing to leave; world-rule defaults remain unchanged.

For older upgrades, review the [upgrade archive](RELEASE_NOTES.md#upgrade-archive), especially schema 2 (0.3.0), seasonal farms (0.4.0), town relocation (0.6.0), offline starvation (0.15.0), pricing (0.15.3/0.16.0), and starter-property cleanup (0.21.2). NPC manuals are bundled runtime inputs: restart after editing FAQ, Playing or Economy.
