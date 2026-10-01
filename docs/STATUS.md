# Implementation status

Aclone is a playable development alpha. The supplied design spec describes a
much larger historical game. This page deliberately distinguishes working
systems from unfinished fidelity work; the project is not ready to claim 1.0.

## Playable and covered by tests

- Enlarged parish map (M or click minimap), with named buildings/resources, live player positions, zoom, panning and clickable building details. The directory remains separate.
- Gesture-unlocked engine idle/revs, nearby multiplayer horns and motors, production-driven machinery, stereo/distance attenuation, mute and saved volume; browser tests measure actual mixed audio output.

- Player-built hotels/B&Bs, prepaid bookings, private guest stores, offline meals and safe expiry.
- Finite natural-resource gathering, eight processing businesses, materials and professions connecting crops, industry and hospitality.
- Occupied offline chimneys, varied evening windows, actual street/window illumination, dark nights, thunderstorms, persistent snow and weather-dependent driving.
- Evergreen and deciduous groves, varied tree scales and new building silhouettes. Evergreens now have irregular boughs, needle-covered shoots and original bark textures, with matching shapes in both graphics modes.

- Persistent server-owned cash, inventory, building investment and stock.
- Positive-quantity validation, transaction conservation, taxes and exact
  fractional-denarius wages.
- Input/output production, funding and storage checks, active employment,
  low-efficiency unattended production, timed skills and resource tasks.
- Buying unclaimed properties, listing and selling property to another player,
  construction materials, repair, decay, home supplies and life/death resets.
- Twenty-four vehicle slots, five primary control families, fuel/boost,
  persistent purchased vehicles, walking, disposable robocrows and ostriches.
- Safe-zone/fighting checks, energy or ammunition, charged javelins, bouncing grenades, armed mines, blast damage, armour, and balanced deathmatch/capture/CTF rounds.
- Seasonal crop plots, irrigation, fertilizer, rotation, frost and delayed-harvest quality, with reserved paid harvest shifts and offline completion.
- Seven-system route map, saved jump transit, owned-ship hangars, upgrades, shared station stocks, courier contracts, surveys and alien-ship unlocks.
- Four seasons, deterministic rain/snow, snow cover, seasonal sunlight and sunrise/sunset.
- Seasonal, rotating stars and two nearby moons with persistent phase cycles, cloud occlusion, starlight and moonlight; stronger headlights and broad streetlight pools.
- Six selectable cottage styles, garage tractor paint and occupancy-driven chimney smoke.
- Six-client Hornball, ordered race checkpoints and best laps, bite/reel fishing,
  and an original timing-based two-player Ultrakricket implementation.
- Optional password login, verified SMTP recovery, hashed pilot-key identities, multiplayer chat, command authority, world
  creation and separate per-world progress.
- SQLite persistence, transactional ledger, online backup/restore, bounded
  offline catch-up and atomic planet-cash / universe-credit conversion.
- Galaxy registry, landing, spaceports, systems, jump range, ships and cargo trade.
- Owner settings, terrain brushes, building placement, custom production recipes,
  per-world vehicle physics, safe/no-build zones, Lua and asset uploads.

Browser tests exercise the real rendered client and live server rather than a
mock game state. Unit and integration tests focus on critical invariants; they
do not establish production-scale security or long-term economic balance.

## Graphics and the current working tree

The 0.3.0 renderer uses original generated meadow, gravel, limestone and slate
materials, a detailed glazed tractor cab and treaded wheels, instanced foliage,
cloud layers, a village fountain and textured cottage gables. See [art sources](ART.md)
for prompts and implementation conventions. Adaptive, detailed and performance
modes let players trade dynamic shadows and resolution against GPU cost. These
are visual improvements to the existing game, not additional historical mechanics.

Version 0.3.3 replaces the placeholder human and cab driver with a smoothly shaded,
original workwear figure, detailed face and hands, and a seated driving pose.
Walking has articulated legs and arm swing driven by displayed motion, a closer
chase camera and a human-height first-person view. Figures remain stylized;
they are not photorealistic scans. Shared geometry and batched drivers keep the
additional rendering cost bounded. Browser tests cover switching to walking,
moving, changing cameras and returning to the tractor.

Version 0.3.4 adds distinct building footprints and roof forms,
consistent doors and windows, a compact tractor cab, human-scale street furniture,
and footprint-aware movement collision. It changes existing presentation and
navigation without adding historical game systems.

Version 0.4.0 adds timber siding, paint choices, occupied/working chimney smoke,
visible crop growth, seasonal foliage, snow coverage, precipitation and moving
sunlight. Effects and projectiles use bounded batches. See [the player guide](PLAYING.md)
for the new gameplay loops and their deliberately documented balance choices.

Version 0.7.0 adds the fictional night sky, broader vehicle and street lighting,
and first-person vertical mouse-look. Orbital tests cover seasonal movement,
midnight/year continuity and lunar phases; rendered captures compare near-full,
half and crescent moons, overcast skies, and the same ground view under moonlight
and starlight. The sky uses an original simplified orbital model, described in
[the art guide](ART.md).

## Implemented with a smaller scope than the spec

- Worlds are logically isolated simulations in one host process. Independent
  world-server federation and central identity trust are not implemented.
- Flight is arcade climb/descend, without a full lift/bank/pitch aerodynamic
  model. Ground collision uses simple footprints; terrain rolling, water
  buoyancy, trailer physics, balloon handling and robust lag compensation need
  further work.
- Robocrow control uses one built-in drone type rather than eight ranked types.
  Detailed per-vehicle weapon loadouts, additional reward sources and sustained
  competitive balance testing remain to be developed.
- Town membership, a first-candidate mayor and town tax exist. Full scheduled
  elections, leases, war declarations, territorial battles, turrets and
  protected town zoning do not yet have complete gameplay.
- Tribes/families currently store group names. Hitching and item gifts exist in
  the protocol; richer membership permissions, negotiated barter and their
  dedicated UI are unfinished.
- The editor changes live rules, terrain brushes, buildings, recipes and vehicle
  physics. It does not yet import arbitrary heightmaps, paint roads/forests or
  bind uploaded GLB models to building/vehicle definitions. Safe and no-build
  zones enforce rules; other zone types are stored markers.
- Uploaded image/audio assets can be previewed and GLB files downloaded.
  Automatic scene assignment, world radio, welcome images and scripted books
  remain future work.
- Lua supports PlayerLogin, TaskStart and ScriptReload with announcements,
  numeric world variables and reputation changes. The full historical event and
  command catalogue, timers, transaction cancellation and scripted OSD are not
  wired. Worker limits protect the host from runaway handlers.
- Crop plots now have dated harvests and seasonal planting windows. Perennial
  dormancy, livestock, richer diets, exact historical crop balance and precise
  historic death/estate behaviour still need fidelity work.
- Space is a functional map and trading layer, not a real-time cockpit flight
  simulation. Different world processes and public registry registration need a
  federation protocol.

## Deliberately not invented

The supplied spec leaves Bongosquares and Netrek rules unknown. Aclone does not
pretend a new invented game is a recovered original implementation. Historical
prices, crow tuning, civilization triggers and other uncertain numbers should
be changed in the data files as reliable evidence becomes available.

There is no copied original asset, paid membership system, invasive machine
fingerprinting, or dependency on the original game infrastructure. Reference
archives are local research material and are excluded from the public source.

## Before a stable 1.0

Complete required fidelity features above, expand game-module and rendering
boundaries, add save migrations and world export/import, soak-test offline
production and survival over long periods, load-test tens to hundreds of players,
review script/upload/auth abuse resistance and sustained trading load, and playtest the three core scenarios:
a sustainable business after days away, six-player Hornball, and a created world
that friends reach through space. Keep every remaining claim explicit in the
release notes rather than treating a successful build as completion of the spec.
