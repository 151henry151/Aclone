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
