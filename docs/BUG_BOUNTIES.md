# Bug-report reward record

Record operator-authorized rewards here after verifying their persisted audit
receipts. These are one-time awards, not automatic payments on deployment.

## 2026-11-09 — Lightmun: farm crop selections

- **Report:** saving hops and coffee together could fail after switching tabs or
  reopening farm controls because checkbox drafts shared an identity.
- **Fix:** release 0.137.1 preserves each crop checkbox separately.
- **Authorization:** Henry requested another bug-report reward and documentation.
- **Award:** 5 sheckles (500 denarii; 50000 internal units), matching the previous
  rewards. Lightmun's recorded bug-bounty count increases from three to four.
- **Receipt key:** `grant:lightmun-farm-crop-selection-bug-bounty:2026-11-09`.
- **Verification:** persist the reward and receipt atomically with the service
  stopped, then verify the receipt, single award ID and fourth reward after
  restart. Ledger entry 140493 records the 50000-unit payment. Check the cash
  delta against the pre-award backup; retain other player and farm state.
- **Backup:** `/var/lib/aclone/backups/pre-lightmun-farm-bounty-1794251609724.sqlite`.
- **Announcement:** https://discord.com/channels/1562183434254680175/1565527790785404968/1569429833123889153

The stable receipt key prevents the same report from being paid again on retry.
