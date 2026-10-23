# Security

This is a development alpha, not a hardened public MMO service. Current fixes
are made against the latest development version. Do not publish pilot keys,
database snapshots or private research exports in issues.

For a suspected vulnerability, contact the instance operator privately. For code
issues, use the repository's private vulnerability-reporting feature if enabled;
otherwise ask the maintainer for a private reporting channel without disclosing
the exploit publicly. There is no invented security email address.

Include the version, a minimal reproduction, expected and observed behaviour,
and impact. Use disposable test pilots. We will verify the report, add a
regression test, fix affected paths and document the correction in the changelog.

Operators should use HTTPS, restrict filesystem access to the data directory,
keep private backups, install dependency updates deliberately, and never expose
Vite development mode publicly. Pilot keys are bearer credentials; a lost key
cannot be recovered from the hash stored in SQLite. Regular backups protect
world state, not the secrecy of a key already disclosed elsewhere.

The 0.3.0 account system uses salted asynchronous scrypt (N=32768, r=8,
p=3), a four-hash concurrency cap, and random 256-bit recovery tokens stored as
SHA-256 hashes. Email addresses must be verified before recovery. Recovery tokens
expire, are consumed transactionally, and revoke existing pilot keys. The browser
receives recovery links in a URL fragment and clears it before further navigation.
SMTP uses TLS and configured public URLs. Tests use a fake mail transport; a real
provider must be configured and delivery verified by the operator.

The recovery design follows the [OWASP forgot-password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
The browser's automatic sign-in key is still a bearer secret in local storage;
protect the host from cross-site scripting and serve public instances over HTTPS.
Password reset and sign-out revoke keys, so old exported recovery keys stop working.

The optional AI resident uses a server-only OpenAI key and `store: false` API
requests. Model tools are allowlisted game actions with bounded schemas and
ordinary authority, ownership, proximity and currency checks; there is no shell,
filesystem, arbitrary HTTP or administrator tool. Chat is untrusted input and
cannot grant the NPC extra permissions. NPC accounts cannot authenticate as
human pilots. Local journals include private messages addressed to the resident;
operator CLI output and backups must stay private. Players see AI labels and a
memory/provider notice. See [NPC data handling and budgets](docs/NPCS.md).

## Optional federation and creator content (unreleased)

Galaxy connections use operator-pinned Ed25519 keys. A trusted host can assert
visiting identities whose passports it has seen, but cannot authenticate native
home accounts. Keep the signing key/database private; do not connect untrusted
servers as peers. Visitors do not import currency, privileges or inventory. See
[the trust and recovery guide](docs/GALAXIES.md).

World creators may install bounded Lua and uploaded visual content in their own
world. GLB uploads reject external media references, node cycles and unsupported
animation/extension paths; dimensions and geometry budgets limit resource use.
This does not make arbitrary scenes cheap to render. Scripts remain isolated
from networking, filesystem access and account operations. Only validated bounded
effects return to the simulation. Designs never import account or player records.

## Runtime and dependency security updates

Use Node.js 24.22.1 or a newer patched 24.x LTS release. The
[October 2026 Node.js advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
includes Brotli decoding memory corruption and DNS/TLS validation fixes. `npm audit`
checks npm packages, not Node's bundled libraries or OS packages; a clean audit
is not evidence that the running server is fully patched. Serving precompressed
Brotli files does not itself invoke the decoder, but outgoing HTTP clients may
decode compressed responses.

Check the actual running executable as well as the installed Node version. After
upgrading Node, restart the game service gracefully and verify its health and
runtime version; an existing process keeps running the old executable. Apply the
same runtime update to other Node services such as the Discord publisher. Keep
backups and an explicit rollback procedure. Manually installed Node binaries are
not updated by Debian's unattended package upgrades.

Run `npm audit` for the full dependency tree, including development tools: hosting
retains `tsx` and other development dependencies even though production mode does
not expose the Vite development server. Rebuild containers with `docker compose
build --pull` after a base-image update. Keep the Dockerfile, CI Node version,
package engine requirement and operator documentation aligned when updating the
supported runtime. Do not infer vulnerability status from nginx's upstream version
alone: distributions backport security fixes without changing that version.
