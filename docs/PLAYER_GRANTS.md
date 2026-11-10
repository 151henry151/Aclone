# Requested player grants

## Restore Hank's testing skills — 2026-11-10

At Henry's explicit request, restore HANK_ROMP's full Puddlewick skill set after
his death removed the earlier testing grant. Verify the existing human account
`f2a5f340-b270-4960-9a4e-da15c57c1313` and derive all 28 skills from the live world's
catalogue, including any custom skills. The pre-change skill list is empty.

Dry-run and apply assertions prove that only the target player's skills and an
already-redundant lesson may change; there is no active lesson to cancel. Stop
the service, take a SQLite backup, apply the idempotent transaction, restart,
and verify all 28 skills without duplicates. Normal skill limits, death rules,
other players and all other world state remain unchanged. This is a restoration,
not a permanent exemption from skill loss on death.

Audit key: `grant:hank-romp-all-skills:2026-11-10`.
Backup: `/var/lib/aclone/backups/pre-hank-skills-2026-11-10T182625-566Z.sqlite`.
Verification: service active; public health healthy at 0.144.1; 28 of 28 skills
present, normal world skill limit still 3. Excluded receipts and scripts:
`output/hank-skills-2026-11-10/`. The original 2026-11-09 grant is documented in
[the backlog execution record](BACKLOG_PLAN.md).
