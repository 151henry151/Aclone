# Hosting a galaxy and visiting other servers

Every Aclone server hosts a galaxy containing its own worlds. Federation is an
optional connection between explicitly trusted hosts. It is disabled until the
operator configures a public galaxy URL. Version 0.20.0 supports
character visits and return journeys through the existing galaxy directory.

## What travels

A character carries a signed passport identifying its home galaxy, permanent
home account ID and display name. The destination creates a persistent visiting
pilot for that identity. Returning visits resume the same local progress.
**Cash, galactic credits, ships, inventory, skills, health, property and NPC
memories remain in the galaxy where they were earned.** Cross-galaxy trade or
wealth transfer is not implemented. A visitor begins with that host’s ordinary
starting pilot and world rules, just as a first visit to a new local world does.
This prevents a custom or compromised host from minting money in another galaxy.

World characters left behind still follow normal offline survival rules. Stock
and enter a home before leaving a character unattended, or take off normally.
Federation does not freeze abandoned characters or automatically supply them.

## Player journey

1. Take off at a spaceport to enter the galaxy directory. Finish any local star
   jump first.
2. Under **Other galaxies**, choose a connected destination. Travel opens that
   host’s game page. Your passport ticket expires after two minutes.
3. Check the displayed character/home and choose **Continue as …**. Arrival is
   explicit; opening a link alone does not replace the current browser session.
4. Choose a world there and play. To return, take off and choose your home galaxy.
   Your home pilot key saved in that browser completes the return. On a different
   browser, sign in to the home account or restore its pilot key first, then
   complete the pending arrival. A foreign host cannot sign you into your native
   home account.

Keep your normal pilot-key backup/password. The browser preserves a native pilot
key separately when switching to a visiting character. Only one visiting session
for an identity remains active on a host: a fresh arrival rotates its visitor
key and closes the previous connection. A nickname suffix is used internally to
avoid local name conflicts; that unique visitor name is also used in world chat,
so private-message addressing cannot be confused with a native resident. The
galaxy directory shows the original passport name.
If a ticket expires or the response is lost, return to the source directory and
start another trip. Progress is saved independently of the short-lived ticket.

## Connect two hosts

First install each server normally using [Hosting](HOSTING.md), with HTTPS and
its own persistent data directory. Do not share a SQLite file across servers.
Use separate origins for separate instances; browser account storage is scoped
to the origin. Choose a stable URL including the deployment path:

```sh
GALAXY_NAME="Hearth Galaxy"
GALAXY_URL="https://hearth.example/aclone"
GALAXY_PEERS_FILE="/srv/aclone/galaxy-peers.json"
```

Supply these variables to the service’s environment. An empty peers file is
simply `[]`. Restart the service, then open:

```text
https://hearth.example/aclone/api/federation
```

The public response includes `protocol: 1`, name, canonical URL and an Ed25519
**public** key. Exchange this descriptor with the other operator through a
trusted channel; verify the URL and fingerprint/key independently. Neither API
keys nor account tokens should be shared. Put the other host’s descriptor in
each host’s peer file (extra descriptor fields are ignored):

```json
[
  {
    "name": "Orchard Galaxy",
    "url": "https://orchard.example/game",
    "key": "REPLACE_WITH_ORCHARD_PUBLIC_KEY"
  }
]
```

Configure both directions and restart each service. The directory displays the
configured destinations. For multi-hop travel, the destination must trust both
the immediate departing host **and** the character’s original home host. Trust
is not automatically transitive. Up to 32 peers can be configured per host.
Removing a peer stops new tickets from that issuer/home; it does not delete saved
visitor characters or automatically revoke already authenticated sessions.

`GALAXY_URL` must use HTTPS, except loopback HTTP for local testing. `BASE_PATH`
still controls the client build; e.g. `BASE_PATH=/aclone npm run build`. Your
proxy must strip `/aclone` before forwarding, including `/api/federation` and
all other existing routes. No cross-origin API/CORS exception is needed because
the browser navigates to each destination before calling its API.

### Docker Compose

The standard Compose file passes galaxy settings through. For the peers file,
add an override beside your deployment compose file:

```yaml
services:
  aclone:
    environment:
      GALAXY_PEERS_FILE: /app/galaxy-peers.json
    volumes:
      - ./galaxy-peers.json:/app/galaxy-peers.json:ro
```

Run with both files, for example
`docker compose -f compose.yaml -f compose.galaxy.yaml up --build -d`.
`GALAXY_NAME` and `GALAXY_URL` can come from Compose’s `.env`. The public peer file
contains no credentials; protect it against unauthorized edits because it defines
which hosts are trusted.

## Trust, storage and recovery

This is a private federation of trusted operators, not a permissionless public
identity network. A trusted departing server can impersonate visiting identities
whose passports it has seen. It still cannot authenticate a native home account.
Only connect servers whose operators and security you trust. Visitors receive
ordinary accounts and world permissions; no authority is imported in tickets.

The server generates its signing key once in the database’s `meta` table. Normal
SQLite backups preserve it, visitor mappings, progress and consumed ticket IDs.
Enabling federation restricts the database and its existing SQLite journal files
to mode 0600, readable/writable by the service account. Run backup tooling as that
account and keep exported backups private. Keep the database backed up. Replacing the database/key or changing
the canonical URL changes galaxy identity: peers must pin the new key, and old
passports may no longer work. Do not regenerate keys casually. Restore the same
database/key to resume the same galaxy.

Tickets use an issuer signature, audience URL, UUID nonce, issuance/expiry and a
separately signed home passport. Destinations pin keys locally, verify both
signatures, reject wrong audiences/expired tickets, and consume each ticket once
in the same SQLite transaction that creates or resumes the visitor. Tickets
travel in a URL fragment, which is removed immediately and is not sent in HTTP
requests/referrers. Treat an unused ticket as sensitive until its two-minute
expiry. Native pilot keys never go to another galaxy. Hosts do not fetch URLs
supplied by visitors, so travel cannot be used as a server-side network proxy.
Keep server clocks synchronized; issuance permits 30 seconds of forward skew.

Independent servers remain authoritative over their local economy. There is no
global registry service, single shared inventory, distributed transaction ledger,
automatic peer discovery or guarantee that a peer will be online. If a peer is
down, the original host and all saved local progress remain available.

## Developer checks

`tests/federation.test.ts` covers identity/progress across three hosts, native
return authentication, tampering, replay, expiry, untrusted keys, restart keys
and database rollback. `tests/browser/federation.spec.ts` travels between two
real local servers, checks explicit arrival, native-key preservation and saved
progress on repeat visits. These tests use temporary databases and no AI APIs.
