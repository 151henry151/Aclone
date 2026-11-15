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

## Preserve Hank's operator testing skills — 2026-11-15

Henry explicitly requests that HANK_ROMP have all skills and retain them on death.
The persistent exception is `operatorAllSkills: true` on this verified player's
Puddlewick record, not a world rule, name match or authority-level entitlement.
It grants no permission to edit worlds or other accounts. The skill catalogue
supplies the list, including custom skills; rejoining and deaths refresh it without
duplicates and cancel only a lesson whose skill is already present. Other death
consequences remain active, and all other players keep the normal skill limit and
skill-loss rules. It is not automatically copied to other worlds or new accounts.

Only trusted server maintenance can set the flag; player actions cannot. To revoke
it, remove the flag from the verified player record in a backed-up maintenance
transaction. Existing learned skills remain until the world's usual death rules
remove them; future joins no longer grant skills. No client reset is necessary.

Target: human account `f2a5f340-b270-4960-9a4e-da15c57c1313`, Puddlewick only.
Audit key: `grant:hank-romp-persistent-skills:2026-11-15`.
Applied and verified after restart on live 0.146.6: all 28 catalogue skills are
present without duplicates; `operatorAllSkills` is true; normal world skill limit
remains 3. The idempotency recheck confirms no further changes are needed.
Backup: `/var/lib/aclone/backups/pre-hank-persistent-skills-2026-11-15T235756-332Z.sqlite`.
The transaction asserts that no other player/world data changes; the service is
active and healthy. No announcement was sent. Excluded maintenance script,
dry-run, applied and verification receipts: `output/operator-skills-2026-11-15/`.
