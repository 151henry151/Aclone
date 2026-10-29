# Development backlog

## Completed in 0.104.0

- Charter fishing boat: implemented and validated, including exterior/interior previews.
- Headlight visibility bug: each tractor's visible lamps and nearby beam now match its own synchronized switch on other players' screens; all six tractor models checked.

## Next: livestock pastures and roaming (requested 2026-10-28)

Start after the charter boat and headlight fix are complete.

- Give livestock farms a fenced grazing area suited to their animal species.
- Allow owners to buy additional adjacent pasture plots. Expansion enlarges the usable fenced area rather than merely increasing a number.
- Have cows, sheep and other livestock roam within the actual pasture, pause to graze, turn naturally, and use species-appropriate walking/grazing animations.
- Let farms purchase additional animals only when pasture capacity permits; account for breeding and existing herds in that same capacity limit.
- Scale production with healthy herd size, alongside corresponding feed, water, staffing and running costs. Balance against existing businesses; prevent free production from unfed or overcrowded herds.
- Handle terrain, fences, farm buildings and roads cleanly. Keep rendering economical with shared meshes/materials and bounded update work; test large herds and multiple farms.
- Explain acreage, herd capacity, expansion cost, livestock cost and ongoing requirements in the farm UI. Keep rules configurable for world builders where appropriate.

## Deferred

- Advanced vehicle editor: configurable movement, handling, capacity, passengers/crew, survival/death rules, trawling, lights, instruments and uploaded component models. Preserve this as a separate substantial project.
