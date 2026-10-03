# Connected galaxies

Each server hosts its own galaxy/worlds. Federation is opt-in, between explicitly trusted hosts; unset `GALAXY_URL` keeps it disabled.

## What travels

Signed passports carry home-galaxy identity, permanent account ID and display name. Repeat visits resume the same destination pilot. **Cash, credits, ships, inventory, skills, health, property and NPC memories stay in their original galaxy**; visitors start under destination defaults. No cross-server wealth minting/transfer. Characters left planetside still need offline provisions; stock/enter shelter or take off normally.

## Player journey

1. Take off at a spaceport, finish any pending jump, choose **Other galaxies**.
2. The destination opens; confirm **Continue as …** within the ticket's two-minute life. Opening a link alone does not replace your session.
3. Play there; return via its galaxy directory. Native home access requires your saved home key or ordinary home login (on another browser, authenticate then finish arrival).

Keep password/key backups. Browser storage preserves a native key separately from the visitor key. New visitor arrival rotates its key and closes the previous connection. Visitor nicknames gain a conflict-avoiding suffix used in local chat; the directory shows the original passport name. Lost/expired tickets require another departure, not lost progress.

## Connect two hosts

Install each with HTTPS, a distinct origin and persistent database—never share SQLite; browser keys are origin-scoped. Set privately:

```dotenv
GALAXY_NAME="Hearth Galaxy"
GALAXY_URL="https://hearth.example/aclone"
GALAXY_PEERS_FILE="/srv/aclone/galaxy-peers.json"
```

Start with peers `[]`; restart and read `https://hearth.example/aclone/api/federation`. It returns protocol 1, name, canonical URL and Ed25519 **public** key. Exchange/independently verify descriptors through trusted channels; never exchange account/API secrets. Each host pins the other:

```json
[
  {
    "name": "Orchard Galaxy",
    "url": "https://orchard.example/game",
    "key": "REPLACE_WITH_ORCHARD_PUBLIC_KEY"
  }
]
```

Extra descriptor fields are ignored. Restart both. Up to 32 peers; multi-hop requires trust in both the departing and original home host—trust is not transitive. Removing a peer prevents new tickets, not deletion of saved visitors or automatic revocation of active sessions.

URLs require HTTPS except loopback testing. Build BASE_PATH normally and strip the prefix at the proxy, including federation routes. Travel navigates to destination before API calls, so no CORS exception is needed. [Hosting](HOSTING.md#reverse-proxy).

### Docker Compose

Compose forwards galaxy settings; mount the peer file read-only with an override:

```yaml
services:
  aclone:
    environment:
      GALAXY_PEERS_FILE: /app/galaxy-peers.json
    volumes:
      - ./galaxy-peers.json:/app/galaxy-peers.json:ro
```

`docker compose -f compose.yaml -f compose.galaxy.yaml up --build -d`; name/URL can use Compose .env. Peer descriptors are public, but prevent unauthorized edits to this trust policy.

## Trust, storage and recovery

A trusted departing host can impersonate visitor identities whose passports it has seen, but cannot authenticate a native home account. Visitors import no authority. This is trusted-operator federation, not permissionless identity.

Signing keys, visitor mappings/progress and consumed ticket IDs live in SQLite backups. Enabling federation sets database/existing journal files to 0600; run backup tools as the service user. Restoring the same database/key preserves galaxy identity. Changing URL/key requires repinning and may invalidate old passports; do not regenerate casually.

Tickets carry issuer signature, audience URL, UUID nonce, issue/expiry and separately signed home passport. Both signatures/keys/audience/expiry are checked; consumption and visitor creation/resume share one transaction. Tickets travel in URL fragments, removed immediately (not HTTP/referrers); treat unused tickets as sensitive. Native keys never leave home. Servers never fetch visitor-supplied URLs. Synchronize clocks; at most 30s forward skew allowed.

No global registry, shared inventory, distributed ledger, automatic discovery or peer-availability guarantee. A down peer does not lose original-host progress.

## Developer checks

`tests/federation.test.ts`: three-host identity/progress, native authentication, tamper/replay/expiry/trust, restart keys and rollback. `tests/browser/federation.spec.ts`: two real servers, explicit arrival, preserved native keys and repeat-visit progress. Temporary databases, no AI charges.
