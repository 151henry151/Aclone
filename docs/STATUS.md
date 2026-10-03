# Implementation status

Aclone is a playable development alpha, not complete historical parity or a stable 1.0. [Release notes](RELEASE_NOTES.md) retain feature history and historical test evidence; current instructions live in the topic guides.

## Playable and covered by tests

- **Economy:** authoritative integer cash, tax/ledger conservation, inventory, investment, stock, production, wages, active/unattended work, skills, tasks, banks and budgeted parish procurement. Player cash gifts and carried-Fuel roadside help have independent world rules. Private business statements, return reports and structured personal history explain activity after the reporting upgrade.
- **Property/survival:** construction, materials, repair, sales, home provisions, death/estates, hotels/B&Bs, prepaid rooms and private pantries. Offline needs and starvation continue; ageing/passive property decay pause.
- **Countryside:** seasonal crops, finite gathering grounds, material industries, shoreline waterworks, rotating crop families, irrigation, compost/drainage, delayed harvest quality and saved harvest tasks.
- **Vehicles/activities:** 24 vehicle slots, five main control families, purchased fleets, fuel/boost, walking, robocrows, ostriches, six-player Hornball, racing/lap records, fishing and two-player Ultrakricket.
- **Combat:** six weapons, armour, safe zones, energy/ammunition, charged javelins, grenades/mines, blast damage, deathmatch/capture/CTF, teams and respawns.
- **Space:** seven systems, routes, saved jumps, ships/upgrades, shared station stocks, credit conversion, courier contracts, surveys and alien-ship unlocks. Trusted-host federation carries identity with separate local progress.
- **Creator tools:** presets, terrain, buildings, zones, world-local goods/professions/templates, recipe diagnostics, vehicle tuning, uploaded/primitive visuals, interactive objects, visual rules, ordered quests, pre-action requirements, persistent Lua progress and portable designs.
- **Presentation:** original scenery, varied buildings/trees, animated humans, industrial spacecraft/robocrows, storms, snow/traction, stars/twin moons, local lights, smoke and synthesized positional audio.
- **Interface/accounts:** named map, directories, chat scrollback, saved form drafts, desktop/touch layouts, optional passwords, verified-email recovery, pilot keys, backups and bounded restart catch-up.
- **Optional AI:** 19 distinct residents, shared adaptive Jev decisions, OpenAI/Claude conversation, durable scoped memory, schedules, supplies/homecoming, validated delivery/employment agreements and shared spending limits.

Current defaults and operations: [Playing](PLAYING.md), [Economy](ECONOMY.md), [World building](WORLD_BUILDING.md), [NPCs](NPCS.md).

## Implemented with a smaller scope than the spec

- Each host runs one process/SQLite economy; federation is explicit peer trust, not a central registry, distributed ledger or wealth transfer.
- Flight is arcade climb/descend. Full aerodynamics, buoyancy, terrain rolling, trailers, balloons and robust lag compensation remain open.
- Robocrows use one built-in drone type, not eight ranks. Detailed vehicle weapon loadouts, extra reward systems and sustained competitive balance need work.
- Town membership, first-candidate mayor and tax exist; full elections, leases, wars, territory, turrets and protected town zoning are incomplete. Tribes/families store names; richer membership, negotiated barter and dedicated hitch/item-gift UI are unfinished.
- Creators cannot paint roads, upload heightmaps/animated character rigs, run shader scripts or arbitrary client JavaScript. Uploaded audio is preview/download only; world radio and scripted books remain open.
- Lua lacks asynchronous transaction cancellation, custom OSD, cutscenes, arbitrary admin commands and the full historical event catalogue.
- Farming lacks livestock, perennial dormancy and exact historical crop/diet/death balance. Waterworks abstract fuel-powered pumping; no plumbing, purity or reservoirs. Homes/rooms use exterior shelter, not interior maps.
- Space is a map/trading layer, not cockpit flight. NPC candidates cover ordinary action families but bounded quantities/routes, not exhaustive plans or expert combat. General errands, loans and autonomous negotiation are not executable chat agreements.

## Deliberately not invented

Bongosquares and Netrek rules are unknown in the supplied spec. Uncertain historical prices, crow tuning and civilization triggers remain data/fidelity work, not claimed reconstructions. The climate, crop balance and Ultrakricket timing include original choices.

No original-game assets, paid membership system, invasive machine fingerprinting or dependency on original infrastructure. Research archives are excluded from public releases.

## Before a stable 1.0

Finish required fidelity gaps; strengthen migrations/module boundaries and design portability; soak-test survival, production and trading; review script/upload/auth abuse resistance; measure capacity on real hosts. Chromium emulation does not establish physical Android/iOS keyboard, toolbar or thermal behavior.

Deterministic NPC tests prove mechanics, privacy and budgets—not human realism, profitable autonomy or perfect advice. Short paid trials are documented in [NPC validation](NPCS.md#development-and-validation); a 50-resident scheduler fixture is not a production benchmark.

Playtest sustainable businesses after days offline, six-player Hornball, and friends reaching a created world through space. A passing build alone is not completion of the spec.
