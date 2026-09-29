# Hosting and recovery

## Native installation

Install Node.js 24.14+, copy the source, run `npm ci && npm run build`, and start
with `npm start`. No Redis, database service or graphics device is required.

Environment variables:

- `HOST`: bind address, default `127.0.0.1`.
- `PORT`: TCP port, default `3000`.
- `DATA_DIR`: persistent database/assets directory, default `var` relative to the
  working directory. Use an absolute path in a service definition.
- `PUBLIC_ORIGIN`: optional exact external origin when the reverse proxy's Host
  header differs from the browser origin. Prefer preserving Host.
- `BASE_PATH`: public URL prefix baked into the client at build time, default `/`.
  Set it when the game is mounted under a path (`BASE_PATH=/aclone npm run build`).
  The Node process still serves `/`, `/api/`, `/ws`, and `/world-assets/` at its
  own root. The reverse proxy must strip that prefix before forwarding. Rebuild
  after changing `BASE_PATH`.

The operator's filesystem owns the instance, but public template worlds have no
player owner. Create a world through the client to obtain in-game owner access.
Do not turn the first anonymous visitor into an administrator.

## Docker

```sh
docker compose up --build -d
docker compose logs -f
```

The compose file binds only to loopback and uses a named persistent volume.
Place an HTTPS reverse proxy in front. To allow LAN clients without a proxy,
explicitly change the port mapping to `3000:3000`. The image runs as the Node
non-root user. The container build, health endpoint, static client delivery, registration and
live SQLite backup have been smoke-tested. Validate TLS and storage permissions
on your own deployment host.

## Reverse proxy

Example Caddy configuration for your own hostname:

```caddy
play.example.org {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy handles TLS and WebSocket upgrades. The hostname and DNS must be yours.
This is a configuration example; the repository does not provision a domain.
Do not put pilot credentials in proxy logs. HTTP authentication uses a bearer
header and WebSocket authentication uses the first message, not query strings.

For a Linux service use a dedicated unprivileged user, the repository as the
working directory, `node --import tsx src/server/main.ts` as ExecStart, and a
writable DATA_DIR. Send SIGTERM to stop; wait for graceful shutdown before
replacing binaries or restoring data. Run a single process per database.

## Backups

The server saves an online SQLite backup every hour under
`DATA_DIR/backups/snapshot-TIMESTAMP.sqlite` and keeps 24 scheduled snapshots.
Manual backups use SQLite's backup API too, so a running WAL database is safe:

```sh
npm run backup
# Or choose a destination:
npm run backup -- /path/to/private/backup.sqlite
```

Manual backups are not removed by scheduled retention. Copy backups off-machine
and periodically restore one into a test DATA_DIR. Keep the `assets/` directory
alongside database backups: uploaded binary assets are separate files. Pilot key
hashes and account names live in the database; treat backups as private.

To restore:

1. Stop the server cleanly.
2. Preserve the existing DATA_DIR as a rollback copy.
3. Create a **new** DATA_DIR and copy the chosen backup to `aclone.sqlite`.
4. Restore the corresponding `assets/` directory. Do not copy old `-wal` or
   `-shm` files over a database backup.
5. Start with `DATA_DIR=/path/to/restored npm start` and verify health, pilot
   login, cash, inventory, buildings and the ledger before allowing players in.

The server catches up at most 30 real days after downtime. A new world is not
silently substituted for a corrupted database or unknown schema version.

## Operational limits

This alpha has a six-client integration test, not a hundreds-of-users load
certification. Worlds share a Node process and SQLite file. Suggested initial
use is small trusted groups. Bounds include 100 worlds per instance, 8 created
worlds per pilot, 500 placed buildings, 128 zones, 256 terrain brushes, 32 uploaded
assets per world, and 2 MiB per upload. Monitor disk usage: retained historical
ledger entries and manual backups are not automatically pruned.

Each request is validated and rate-limited, but anonymous registration is not a
full abuse-prevention service. Deploy additional access control at the proxy
for a private instance. No invasive device fingerprint or raw-machine tracking
is collected. Account-farming detection remains an open security task.
