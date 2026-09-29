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
