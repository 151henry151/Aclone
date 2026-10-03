# Hosting and recovery

## Native installation

Node.js **24.14+**, `npm ci`, `npm run build`, `npm start`. No external database, Redis or GPU required. Run one unprivileged process per database; dev mode is not public hosting mode.

- `HOST=127.0.0.1`, `PORT=3000`: bind address/port. Use 0.0.0.0 for intentional LAN access.
- `DATA_DIR=var`: database/assets, relative to working directory; use an absolute service path.
- `PUBLIC_ORIGIN`: external URL including deployment prefix/trailing slash, for recovery links and allowed browser origin. Preserve Host at the proxy.
- `BASE_PATH=/`: **build-time** client prefix. Rebuild if changed. Node always serves `/`, `/api/`, `/ws`, `/world-assets/` at root; proxies strip the external prefix.

Native commands inherit exported variables; `.env` needs `node --env-file=.env --import tsx src/server/main.ts` or a service EnvironmentFile. Public template worlds have no player owner; creating a world grants authority only there. Never promote the first anonymous visitor to administrator.

## Docker

```sh
docker compose up --build -d
docker compose logs -f
```

Compose binds loopback, uses a persistent named volume and runs as non-root Node. Add HTTPS proxy; intentionally change mapping to `3000:3000` for direct LAN access. Validate host TLS/permissions. Image health/static delivery/registration/online backup have smoke coverage.

## Reverse proxy

Root-host Caddy example:

```caddy
play.example.org {
    reverse_proxy 127.0.0.1:3000
}
```

For `https://hromp.com/aclone/`, build `BASE_PATH=/aclone npm run build`, set `PUBLIC_ORIGIN=https://hromp.com/aclone/`, and merge this into existing site routes:

```caddy
hromp.com {
    redir /aclone /aclone/ 308
    handle_path /aclone/* {
        reverse_proxy 127.0.0.1:3000
    }
}
```

Keep the slash redirect and WebSocket upgrades through `/aclone/ws`. Caddy supplies TLS; you supply domain/DNS. Docker accepts `--build-arg BASE_PATH=/aclone` or Compose's BASE_PATH environment. Pilot credentials belong in bearer headers/first WebSocket message, never URLs/proxy logs.

Linux service: dedicated user, repository WorkingDirectory, `node --import tsx src/server/main.ts` ExecStart, private environment and writable DATA_DIR. SIGTERM saves gracefully; wait before replacing binaries/restoring data. [Release/deployment checklist](RELEASING.md).

## Backups

Hourly SQLite online backups go to `DATA_DIR/backups/snapshot-TIMESTAMP.sqlite`; retain 24 scheduled copies. Manual copies are not pruned:

```sh
npm run backup
npm run backup -- /path/to/private/backup.sqlite
```

Both use SQLite's backup API safely on a running WAL database. Back up `assets/` separately, copy off-host and periodically test restore. Accounts, credentials/emails, NPC memories and federation keys make backups private.

Restore with the server stopped: preserve existing DATA_DIR, create a new directory, copy the snapshot as `aclone.sqlite` and matching `assets/`, **not old -wal/-shm files**. Start `DATA_DIR=/path/to/restored npm start`; verify health, login, cash, stock/property and ledger before admitting players. Corrupt/unknown schemas fail rather than silently starting a replacement world. Catch-up caps at 30 real days.

## Operational limits

100 worlds/instance, 8 created worlds/pilot, 500 buildings, 128 zones, 256 terrain brushes, 32 assets/world at 2 MiB each. Historical ledger/manual backups grow without pruning. Creator/GLB bounds are in [World building](WORLD_BUILDING.md#practical-limits-and-extension-points).

Anonymous registration/rate limits are not full abuse prevention. Private hosts should add proxy access controls. No invasive device fingerprinting; account-farming detection remains open. Test capacity on your hardware before raising the 128-WebSocket default; independent communities should use independent instances, never multiple writers to one database.

## Accounts and recovery email

Passwords are optional; existing keys work. Players configure passwords and verified recovery email in Pilot & preferences. Verification lasts 24h; reset links are single-use/30m. Reset/logout revoke keys and disconnect sessions; password sign-in rotates keys too. Exported keys then need replacing.

Private service environment:

```dotenv
PUBLIC_ORIGIN=https://game.example.com/aclone/
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
MAIL_FROM="Aclone <pilots@example.com>"
```

Links use PUBLIC_ORIGIN, never untrusted Host. Port 587 requires STARTTLS; 465 immediate TLS; certificate validation stays on. Authorize the sender/DNS with your provider. Compose must pass mail variables explicitly; no provider is bundled. Without SMTP, passwords/key export still work and recovery is marked unavailable.

Unknown/verified reset addresses get the same public response. Delivery is async with generic failure logs, max one mail/account/minute. Account POSTs cap at 60/IP/minute; hashing at four concurrent slots. Configure trusted proxy addressing correctly. Credential/recovery hashes are separate from streamed game state. Schema 1→2 migration preserves pilot IDs; rollback requires a pre-migration backup.

## Offline progress and capacity testing

Disconnect stops motion/saves; heartbeat detects loss within ~one minute (not instant combat immunity). Needs/starvation continue; stocked shelter feeds occupants. Offline ageing/passive decay pause, but jobs/production/study/tasks advance. Graceful stop saves all; hard failure can lose ~5s movement/simulation, while acknowledged actions are transactional/FULL-sync. SIGKILL durability tests cover this, not disk corruption/loss/operator mistakes.

## Connection and multiplayer checks

Run locally, not on a live host:

```sh
npm run test:load
npm run test:network
LOAD_CLIENTS=3 LOAD_NPC=1 LOAD_SECONDS=25 npm run test:load
```

Load probe defaults: 100 clients, 10s, 20 Hz stress input (more than normal browser duplicates). `LOAD_CLIENTS=1–128`, `LOAD_SECONDS=2–300`, `LOAD_PROTOCOL=2` for old-wire comparison (default 3), `LOAD_PARKED=1` for idle tractors, `LOAD_NPC=1` for one free deterministic resident. It owns a temporary DB and separate server process; reports wire/decoded traffic, frames, disconnects and event-loop latency. No paid AI, heavy trading, hashes, Lua soak or first-load asset benchmark.

Network test shapes compressed TCP to 64/16 kbit/s down/up, 200ms latency plus ≤150ms jitter each way. It checks driving/stopping/chat/ACK recovery and unaffected fast peers, without .env or AI. Byte order is preserved; radio loss/retransmission is not modeled. Browser tests compare one/three tractors and shaped input/chat; FPS is diagnostic, not a universal threshold.

Protocol 3 shares deltas and keeps three outstanding snapshots/peer; slow peers resume from current state, excessive send queues reconnect. Older clients still work. Deploy client/server together; reconnect starts full private-filtered state. [Wire details](PROTOCOL.md#compact-delivery-protocol-3-0110).

For complaints collect ping/FPS, graphics mode, device/browser and nearby players, alone/together. Inspect `uptime`, `nproc`, `free -m`, `vmstat 1 5`, `/proc/pressure/{cpu,memory,io}` and service CPU/RAM. Full swap/host pressure can stall scripts/pings even with small game RAM. Reduce competing workloads or add capacity; graphics changes cannot fix host starvation. Short probes do not certify production capacity or an ISP.

## Optional AI resident

[NPC setup](NPCS.md) owns keys, enable switches, schedules, budgets and CLI. Keep the same DATA_DIR for server/CLI; SQLite backups include memory/usage. No proxy changes. `NPC_POPULATION_ENABLED=true` enables fifteen more; default timezone America/New_York, original IDs/budgets retained. Provision homes before absences: offline starvation applies during normal play and catch-up.

## Connected galaxies (0.20.0)

Optional `GALAXY_URL`, `GALAXY_NAME`, `GALAXY_PEERS_FILE`; unset URL disables federation. [Galaxies](GALAXIES.md) owns trust, key pinning and recovery. Signing keys stay in private SQLite backups, never clients. Local progress needs no peers.

## Default parish services (0.21.2)

Only default server-owned Puddlewick receives missing stonemason/waterworks plus one-time cleanup of accidental excess public starters. Purchased/custom properties are preserved; active occupants/tasks defer cleanup. Completion records prevent restocking/recreation, blocked sites retry later; other worlds retain layouts. [Player service guide](PLAYING.md#puddlewick-services) and [migration scope](RELEASE_NOTES.md#puddlewick-cleanup-scope).
