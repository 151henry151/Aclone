# Release checklist

Publishing requires an explicit request from the project owner. No commit,
push, registry publish, public deployment or GitHub release is implicit in a
build or test command.

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
