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
