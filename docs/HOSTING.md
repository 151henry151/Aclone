# Hosting and recovery

## Native installation

Install Node.js 24.14+, copy the source, run `npm ci && npm run build`, and start
with `npm start`. No Redis, database service or graphics device is required.

Environment variables:

- `HOST`: bind address, default `127.0.0.1`.
- `PORT`: TCP port, default `3000`.
- `DATA_DIR`: persistent database/assets directory, default `var` relative to the
  working directory. Use an absolute path in a service definition.
- `PUBLIC_ORIGIN`: external public URL, including any deployment prefix, used
  for recovery links and allowed browser origin. Prefer preserving Host at the proxy.
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

For `https://hromp.com/aclone`, build with `BASE_PATH=/aclone npm run build`
and strip the prefix in the proxy. An equivalent Caddy route is:

```caddy
hromp.com {
    redir /aclone /aclone/ 308
    handle_path /aclone/* {
        reverse_proxy 127.0.0.1:3000
    }
}
```

Set `PUBLIC_ORIGIN=https://hromp.com/aclone/` for email links. Keep the trailing
slash redirect: relative browser navigation and assets must stay under the
prefix. Pass WebSocket upgrades through `/aclone/ws`. This configuration must be
merged into the host's existing routes rather than replacing other hosted sites.
For Docker builds, pass `--build-arg BASE_PATH=/aclone` or set Compose's `BASE_PATH`
environment variable before `docker compose up --build`.

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

This alpha has multiplayer regression tests and a configurable 100-client load
probe. It is not a production-scale certification. Worlds share a Node process
and SQLite file. Bounds include 100 worlds per instance, 8 created
worlds per pilot, 500 placed buildings, 128 zones, 256 terrain brushes, 32 uploaded
assets per world, and 2 MiB per upload. Monitor disk usage: retained historical
ledger entries and manual backups are not automatically pruned.

Each request is validated and rate-limited, but anonymous registration is not a
full abuse-prevention service. Deploy additional access control at the proxy
for a private instance. No invasive device fingerprint or raw-machine tracking
is collected. Account-farming detection remains an open security task.

## Accounts and recovery email

Before upgrading, take a database backup. The account-name index migrates schema 1
to schema 2 without changing pilot IDs. Roll back older binaries by restoring a
pre-upgrade backup; old versions intentionally reject the migrated schema.

Passwords are optional; existing pilot keys continue to work. Players set a
password under Pilot & preferences and can add a recovery email when configured.
The email must be verified before it can reset a password. Verification links last
24 hours; reset links last 30 minutes and are single-use. Resetting a password or
signing out revokes the pilot key and disconnects existing sessions. Password
sign-in also rotates the key, so previously exported keys need replacing.

Configure these environment variables in your private service environment:

```sh
PUBLIC_ORIGIN=https://game.example.com/aclone/
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
MAIL_FROM="Aclone <pilots@example.com>"
```

Use your real public URL, including a trailing slash and deployment subpath if
applicable. Links use this configured URL, never a request Host header. Port 587
requires STARTTLS; port 465 uses TLS immediately. Certificate validation stays
enabled. Configure a sender your provider authorizes, including its recommended
DNS records. SMTP is optional: without it the UI still supports passwords and
key export, and explains that email recovery is unavailable. Do not commit these
values. Compose deployments must explicitly pass these variables to the service.
No live email provider is bundled or provisioned by Aclone.

Reset requests have the same public response for unknown and verified addresses;
delivery runs asynchronously and failures produce a generic server log message.
Repeated reset mail to the same account is limited to once per minute. Account
POSTs are limited to 60 per IP per minute; password hashing has four concurrent
slots. Configure a trusted reverse proxy correctly for visitors behind it.
Credentials and recovery-token hashes are separate from publicly streamed game
state. Backups now also contain private email addresses and password hashes.

## Offline progress and capacity testing

Disconnecting stops movement and immediately saves the world. Hunger, thirst,
ageing and property decay pause while offline; jobs, production, lessons and
pending tasks still advance. A lost connection is detected by heartbeat within
roughly a minute, so this is not a way to pause combat instantly. A graceful
server stop saves all worlds. A hard process/host failure can lose up to five
seconds of movement or ongoing simulation; acknowledged economic actions are
saved transactionally with full SQLite synchronization. An automated test kills a
child server with SIGKILL after a purchase acknowledgement and verifies the
restored ownership and cash. Backups remain necessary
for disk loss, corruption and operator mistakes.

## Connection and multiplayer checks

Run `npm run test:load` for 100 real connections, 20 input messages per second per
client, and ten seconds of measurement. Override `LOAD_CLIENTS` (1–128) and
`LOAD_SECONDS` (2–300). `LOAD_PROTOCOL=2` selects the previous wire format for
comparison; the default is protocol 3. `LOAD_PARKED=1` keeps every tractor parked.
The probe intentionally retains 20 Hz input to stress the server (the browser
now sends fewer duplicate controls). It creates and deletes its own temporary database. The
server runs in a separate process from synthetic clients. Output reports wire
traffic, decoded state volume, frames, disconnections and server event-loop
latency. This is a movement/broadcast probe, not a certification of heavy trading,
hundreds of simultaneous password hashes, Lua workloads or long-term stability.

The instance defaults to 128 simultaneous WebSocket connections. Protocol 3
shares field-level entity deltas and permits only three outstanding snapshots per
client. Slower peers resume with current state without slowing fast peers; large
send queues still trigger a reconnect. Older protocol 1/2 clients remain supported.
Deploy server and built client together, then reload clients to negotiate protocol 3.
No database migration or network setting is required.

Run `npm run test:network` to exercise real compressed WebSocket traffic through
a local TCP shaper: 64 kbit/s download, 16 kbit/s upload, 200 ms latency each way
and up to 150 ms extra jitter each way. It checks driving, stopping, chat, recovery
after withheld ACKs and an unaffected fast peer, on its own temporary database.
It neither reads the operator's `.env` nor enables the AI resident. The shaper
preserves TCP byte ordering; it does not simulate radio packet loss/retransmission.
The browser suite also measures one versus three nearby tractors and exercises
controls/chat over that shaped link. FPS depends on the test machine; it is
recorded as diagnostic evidence rather than enforced as a universal threshold.

For reports from real players, collect the in-game ping and FPS, graphics mode,
device/browser and number of nearby players, preferably both alone and together.
Compare server event-loop timing locally with the load probe. These short probes
exclude paid AI calls, active trading load and first-visit asset downloads; they
cannot establish production capacity or diagnose a particular ISP by themselves.
Full reconnects always receive complete state; private player fields stay private.
Capacity depends on host CPU, storage, active worlds and player behavior. Measure
on deployment hardware before raising the connection ceiling or promising a
particular concurrency level. Scale separate communities on independent instances;
multiple processes must not write to the same database.

## Optional AI resident

The NPC prototype is disabled by default. See [AI neighbours](NPCS.md) for the
server-only OpenAI key, one-resident configuration, spending caps, native and
Compose startup, privacy notice and operator controls. The same persistent
SQLite database stores resident identity, memories and usage reservations, so
include it in normal backups. Use the same DATA_DIR for the server and NPC CLI.
No changes to the `/aclone` proxy routes are required.

Set `LOAD_NPC=1` on the local load probe to include one resident using a free,
deterministic decision double, exercising real navigation, labour, persistence
and script events without OpenAI calls. A useful reproduction is
`LOAD_CLIENTS=3 LOAD_NPC=1 LOAD_SECONDS=25 npm run test:load`. This measures the
controller and gameplay work, not provider latency or the live AI's decisions.

A healthy game process can still stall on an overloaded host. Check `uptime`,
`nproc`, `free -m`, `vmstat 1 5` and `/proc/pressure/{cpu,memory,io}` alongside the
game service's memory and CPU. Full swap plus high memory pressure can stall Lua
startup, snapshots and pings even when Aclone uses little RAM. Reduce competing
workloads, limit their memory, or provide more capacity; changing graphics cannot
fix server scheduling starvation. Avoid running load probes on the live host.
