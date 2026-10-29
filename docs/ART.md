# Art and visual verification

Warm, weathered countryside, readable machinery and consistent metre-scale forms. Original-game screenshots informed direction; none of their pixels/models ship. Original procedural geometry, sounds and generated textures use GPL-3.0-or-later. [Texture provenance/prompts](TEXTURE_PROMPTS.md) preserves exact generation instructions and master-export commands.

## Building architecture

`shared/building-architecture.ts` defines five models for each of 48 built-in types. `shared/building-recipes.ts` supplies distinct premises for 42 types, with explicit dimensions and layouts appropriate to each trade; containers, pump houses, spaceports and small props retain specialist generators. Structural volumes drive rendering, collision, placement and navigation; finishes are independent. Expansions add wings or floors. `shared/building-facade.ts` coordinates entrance, canopy, sign and window clearances; `client/building-architecture.ts` renders them and type-specific machinery; `shared/building-features.ts` reserves equipment yards for refinery columns, brewing kettles, mine headgear and other trade cues. Small painted symbols and clock faces use shared 128-pixel textures; cottages have post-mounted mailboxes. `client/shipping-container.ts` uses textured corrugation with simple frame/locking bars. Models stay below 3,500 triangles, except the spaceport with its existing rocket (30,000 budget). Textures remain shared; no new lights or animation loops.

The public [building gallery](https://nogits.com/buildings/) shows every type. Click a sheet for an interactive orthographic preview of the real model, with model, finish and size selectors. Drag to orbit, scroll or pinch to zoom, or use the labelled buttons. Arrow keys rotate the focused preview; +/− zoom, Home resets and Escape closes. The spaceport opens on its terminal, with a toggle to include the launch pad and rocket. Scale stays fixed across model, finish and size selections; previews render only when changed and release their renderer when closed. `npm run screenshots:buildings` refreshes its committed WebP sheets; `npm run build:website` builds the searchable page.

The designer uses one reference camera scale per building type. Run `npx tsx scripts/building-architecture-preview.ts` for same-scale model contact sheets in `output/building-architecture/`; spaceport sheets show the terminal campus without the distant rocket. Buildings without a saved model choice keep their legacy architecture, except containers. Existing model choices use the revised geometry without changing their location, stock, capacity or saved construction bill.

For a complete visual sweep:

```sh
GALLERY_QC=1 SCREENSHOT_OUTPUT_DIR=output/building-qc CHROMIUM_PATH=/usr/bin/chromium npx tsx scripts/building-architecture-preview.ts
```

Each sheet shows five models × six finishes, five rear views and one largest-size view at a common scale. Inspect roof joins, equipment supports, signage, windows and entrances as well as each trade’s silhouette. These use the real renderer in a temporary world without live data or model calls. Geometry tests cover all models, finishes and sizes, with regressions for signage clearances, clock towers, upper windows and container orientation.

## Rolling countryside

`shared/terrain.ts` blends broad downs and smaller rolling shoulders beyond the original 500m village square. Lower noise octave counts keep sampling inexpensive; smaller islands use lower relief, and harbour foothills prevent steep banks. Render tiles, maps, resource positions and authoritative movement use the same height function. Custom heightmaps override generation. `npx tsx scripts/hills-preview.ts` captures real game views in a disposable world under `test-results/hills/`.

## Natural gathering grounds

`client/resource-scenery.ts`: a grove/felled tree/firewood, chipped boulders/spalls, gravel hollow/wheelbarrow and exposed soil/roots/shovel. Original procedural bark/grain/foliage/rock/soil textures; shared seasonal materials, terrain-following geometry, clear surrounding vegetation. Stable variants use ≤5 batches and <5,000 detailed triangles/site, fewer in Performance.

`shared/resources.ts` places 24 grounds ≥20m from road edges, ≥35m from starter centres, ≤150m from a road. Map/HUD/NPCs share coordinates. Stable IDs preserve reserves/regrowth/tasks; custom terrain/buildings can obstruct sites. Client/server must update together. `tests/resource-scenery.test.ts` checks geometry, placement/navigation and save compatibility.

![Woodland clearing](screenshots/woodland-clearing.png)
![Stone outcrop](screenshots/stone-outcrop.png)

## Industrial robocrows (0.19.0)

`client/robocrow.ts`: 5.2m mechanical wings, overlapping feathers, actuators/spars, ducted fans, camera lenses, vents, fasteners, battery, split tail, claws and asymmetric service cover/antenna. Seven body draws + two rotating fans, 6,228 triangles; no extra lights/downloads/per-frame allocation. Used by local/remote and custom robocrow-mode slots; gameplay unchanged.

## Industrial spaceport (0.19.0)

`client/spaceport.ts`: ~193m cargo launcher (six times its earlier size), 120m apron, asymmetric panels/plumbing, ~158m truss/umbilicals, service tank, five engine bells and hydraulic legs. Crew hatch stays 2m. The industrial terminal adds cargo, control and utility wings. Shared materials join static batches; the launch kit remains below 45,000 triangles without new lights or animation. Shared footprints keep solid hardware and the walkable pad inside the starter map.

Shared collision/picking covers rocket/tower/tank; apron is walkable, label/entrance stay at terminal. Trapped saved pilots can move outward. The rocket is scenery: terminal Take off handles travel. [Day](screenshots/industrial-spaceport-day.png), [night](screenshots/industrial-spaceport-night.png).

## Spaceport apron (0.18.0)

Historical design, replaced in 0.19.0: 10m lathed retro hull, fins, struts/nozzle, blue windows and teal/orange livery; circular marked pad, gantry, amber emissive beacons and metal terminal cladding. Static original geometry without extra dynamic lights; shared footprint left the pad walkable. [Archived day](screenshots/spaceport-day.png), [night](screenshots/spaceport-night.png).

## Synthesized sound

`sound-synthesis.ts` generates mono PCM diesel pulses/harmonics/noise, two-tone horns and saw/mill/hammer/furnace/pump loops; cached/loop-blended per AudioContext. `audio.ts` ramps gain/rate, pans, applies saved master volume and compresses crowds. No external samples/licenses.

`sound-scene.ts` caps 16 continuous voices +8 horns (brief fading tails may overlap); engine/horn/industry ranges 110/150/90m. Listener follows displayed player position and camera direction, not zoom height; remote sounds interpolate with models. Indoors muffles outside; no geometric wall occlusion. Server `sound-state.ts` shares production predicates. Honks baseline on arrival/while muted, preventing replay. Gesture-unlocked contexts allocate only audible sources. Browser audio tests measure mixed PCM after compression with real remote sockets.

## Night sky

`starfield.ts`: seeded atlas of 4,600 varied-magnitude/color stars. `sky.ts`: procedural cratered lunar discs shaded from normals/sun, behind the same clouds in one draw. `astronomy.ts`: fictional 45°N observer, 23.4° tilt, 365-day year, 28-day synodic and five-day mutual moon cycles. Lunar radii 1.1°/0.56° exaggerate readability. Shared calendar preserves continuity. Moonlight reuses the sun light; `sky-weather.ts` samples matching cloud texels. Cloud coverage and shading use a curved-layer projection with continuous horizon perspective, avoiding stretched vertical texture columns; it adds no geometry or noise samples. Not an N-body or recovered historical model.

## Evergreen woodland

`evergreen.ts`: three seeded spruce/fir profiles, curved tapering trunks, staggered drooping boughs, lateral shoots and terminal sprays. Canvas needles/axes and fissured bark need no downloads. Twisted crossed alpha-tested planes avoid sorting; modest backlight uses scene lights, not glow. Seasonal shader cache identity is preserved; green autumn needles gather snow on top.

At most six instanced meshes (wood/needles per profile), <11,000 triangles/tree detailed; Performance removes secondary sprays/reduces branch segments to <80%, keeping trunk/bough layout. Seeded size/lean/rotation varies trees; grove/deciduous/grass placement remains stable.

## Renderer conventions

- `materials.ts` owns shared maps for page lifetime; disposal must preserve them. URLs respect BASE_PATH. Four WebPs total ~2.7 MiB; full PNG masters ship in source archives, not browser bundles.
- Metre-based UVs; albedo luminance gives uncalibrated bump. Meadow repeats at 5m, gravel 6m, noisy verge/shore transitions following shared roads.
- `noise.ts` precomputes noise; `sky.ts` uses it for clouds/halo. `scenery.ts` seeds instanced grass/leaf cards/trees/gardens/contact shade, keeping routes/sports clear; incidental scenery has no authoritative collision/economy.
- `tractor.ts` batches body/animated axles and seats `human.ts`; normalize indexed/non-indexed geometry before merging. Opaque batches key on texture/surface, not just color; glass stays separate.
- Contact shade remains without dynamic shadows. Antialiasing is detailed-only; software fallback can reduce cost without recreating WebGL. Dynamic shadows default off, separately opt-in outside Performance.

## Human figures

`human.ts` supplies an original continuous, watertight workwear character, replacing intersecting primitive body parts. `scripts/human-mesh.ts` bakes a smoothly joined implicit sculpt into `client/generated/human-mesh.json`; no meshing runs in the browser. The 10,228-triangle surface has a single connected shell, smooth normals and shared skin weights across UV seams. `human-surface.ts` supplies one shared clothing/face texture: pockets, stitching, buttons, boot laces and facial details add no geometry. No scanned likeness or third-party model downloads.

Walkers use an independently cloned 17-bone skeleton over shared geometry/materials. `human-gait.ts` blends recorded walking and running from the CMU Graphics Lab Motion Capture Database, retargeted offline by `scripts/human-motion.ts`. Real weight shifts, hip/shoulder counter-motion, elbow timing and knee recovery replace a uniform sine-wave cycle. See [motion sources and permission](../art/motion/README.md) and [third-party notices](../THIRD_PARTY_NOTICES.md) for attribution.

Distance drives stride phase; speed adjusts stride length and blends walk/run. Separate waist, neck and wrist joints carry overlapping movement. Two-bone leg constraints retain restrained captured knee variation without allowing backwards knee bends, keep soles above ground and hold feet during the loaded part of a step, including turns. Moving and idle poses blend on start/stop; reverse travel mirrors the step direction. This is a visual rig, not a change to player physics. Ground contact is relative to the character's ground plane; per-foot sampling of uneven terrain is not yet implemented.

Walkers and seated drivers each use one material draw; seated drivers bake the same surface into a static pose and do not keep a live skeleton. Skeleton GPU textures belong to each walker and are disposed when it leaves the scene. First-person hides local occupants; eye height 1.68m. Respect shared-resource flags on disposal.

Regenerate the sculpt with `npx tsx scripts/human-mesh.ts` and the clips with `npx tsx scripts/human-motion.ts`. Capture walking, jogging, front/back/side and seated views with `npx tsx scripts/walking-preview.ts`. `HUMAN_PREVIEW_PROFILE=true` selects a side view, and `HUMAN_PREVIEW_TRANSITIONS=true` adds start/walk/stop/reverse frames. Tests check surface connectivity/watertightness, matching weights at UV seams, independent animation, foot contact/clearance and rendering budgets.

## Scale and architecture (0.3.4)

One unit = 1m. Adult ~1.8m; tractor 2.85m high/2.6m wide, cockpit eye 2.5m; seated humans retain scale. Doors 2.1m, cottage/two-storey eaves 2.7/5.4m, workshop doors 3.2m, lamps 4m, bench seats 0.5m, mature trees 7–15m. Stylized proportions, not manufacturer replicas.

`shared/building-shapes.ts` supplies deterministic volumes for render/collision/picking/clearance; variants depend on stable IDs. `buildings.ts` supplies roofs/wings/joinery/awnings/bays/mill wheel and civic/industrial silhouettes. UVs retain metre tiling; details join static batching. Check first-person after seat/cab changes.

## Seasonal and customization work (0.4.0)

`appearance.json` defines cottage siding/paint; saved styles select board seams/gables. Chimney tips are model emitters; occupancy is authoritative, smoke visual. Seasonal uniforms affect terrain/upward surfaces/foliage; sun/sky share trajectory. Bounded rain/snow/smoke pools, four-stage instanced crops and one bounded projectile draw avoid per-frame allocations.

## Living villages (0.5.0)

Merged window panes have separate emissive control. Twelve pooled window/street spotlights (four Performance) aim outward/down without extra shadows; budgets do not scale with players. Distant streetlamps share one additive ground-glow mesh. Its fog shader attenuates light toward black so coloured fog cannot expose rectangular mesh edges; no additional lights or draw calls are needed. Dark nights retain headlights/natural sky light. Lightning combines cloud flash/bolt. Seed regions group evergreen/birch species; birches have procedural markings/narrow crowns and varied sizes.

## Reviewing visual changes

Use disposable worlds, never concept art presented as screenshots. `CHROMIUM_PATH` chooses Chromium. Captures default to SwiftShader; `SCREENSHOT_GPU=1` selects supported hardware and reports the actual device. `SCREENSHOT_QUALITY=low|balanced|high` selects Performance/Adaptive/Detailed; `SCREENSHOT_OUTPUT_DIR` changes output. Software timings do not predict GPU performance.

- `TEST_URL=... npm run screenshots`: creates pilot/world, checks browser errors, captures game/trade/editor. `SCREENSHOT_HERO_ONLY=1 SCREENSHOT_QUALITY=high` captures H-key scenery only.
- `npx tsx scripts/walking-preview.ts`: deterministic frames of the actual walking/jogging rig in `output/walking/`; encode `frames/%04d.png` at 30 fps for a motion preview. `tests/human-animation.test.ts` covers clone isolation, draw/triangle budgets, foot clearance and stopping.
- `npm run screenshots:characters` and `npx tsx scripts/streets.ts`: disposable TEST_URL server, real walking/driver/cottage/pub/mill/shop/school/scale actions.
- `npm run screenshots:town`: isolated expanded-town/service-access check.
- `npm run screenshots:seasons`: owned disposable server, staged dates/crops, real harvest and space actions.
- `npm run screenshots:living`: booking/gathering and night/headlights/snowstorm comparisons.
- `npm run screenshots:resources`: all four grounds and HUD gathering; defaults `test-results/resources`.
- `npx tsx scripts/evergreens.ts`: seeded real-tree front/side/close/distant/snow views, errors/render counts; defaults `test-results/evergreens`.
- After build, `npx tsx scripts/night-lighting.ts`: real L toggle, midnight/day and rainy sunrise/sunset comparisons; defaults `test-results/night-lighting`.
- `npx tsx scripts/night-sky.ts`: full/half/crescent/overcast/day, two hours' movement, same ground under moon/stars/cloud; defaults `test-results/night-sky`.
- `npm run test:e2e -- tests/browser/spaceport.spec.ts` and `tests/browser/robocrow.spec.ts`: real takeoff/dock scale and drone deployment/flight/return; `TEST_GPU=1` requests hardware.

Check driving-height and distant views, terrain edits, UVs/road edges, all cameras, root and `/aclone/` builds, both graphics modes. Canvas `data-draw-calls`/`data-triangles` expose counts. Textures should load once, not per snapshot. Captures fail on browser errors; geometry tests guard finite vertices/budgets/layout. Script-specific output directories live under `test-results/` unless overridden.

## Screenshot gallery

Actual renderer captures; many use staged disposable worlds. They demonstrate visuals, not production deployment. NPC chat capture uses a scripted reply; historical live API trials are in [release notes](RELEASE_NOTES.md#historical-npc-provider-trials).

- [Character](screenshots/character.png)
- [Cottage](screenshots/cottage.png)
- [Crescent moons](screenshots/crescent-moons.png)
- [Dark countryside](screenshots/dark-countryside.png)
- [Dock fishing desktop](screenshots/dock-fishing-desktop.png)
- [Dock fishing phone](screenshots/dock-fishing-phone.png)
- [Driver](screenshots/driver.png)
- [Editor](screenshots/editor.png)
- [Evening inn](screenshots/evening-inn.png)
- [Evergreen close](screenshots/evergreen-close.png)
- [Evergreen](screenshots/evergreen.png)
- [Farm plots](screenshots/farm-plots.png)
- [Farming](screenshots/farming.png)
- [Galaxy routes](screenshots/galaxy-routes.png)
- [Galaxy](screenshots/galaxy.png)
- [Gather hud desktop](screenshots/gather-hud-desktop.png)
- [Gather hud phone](screenshots/gather-hud-phone.png)
- [Gathering](screenshots/gathering.png)
- [Guesthouse](screenshots/guesthouse.png)
- [Headlights](screenshots/headlights.png)
- [Human scale](screenshots/human-scale.png)
- [Industrial robocrow](screenshots/industrial-robocrow.png)
- [Industrial spaceport day](screenshots/industrial-spaceport-day.png)
- [Industrial spaceport night](screenshots/industrial-spaceport-night.png)
- [Lodging](screenshots/lodging.png)
- [Mill](screenshots/mill.png)
- [Mobile landscape](screenshots/mobile-landscape.png)
- [Mobile portrait](screenshots/mobile-portrait.png)
- [Moonlit ground](screenshots/moonlit-ground.png)
- [Night town](screenshots/night-town.png)
- [Npc chat](screenshots/npc-chat.png)
- [Parish map](screenshots/parish-map.png)
- [Parish](screenshots/parish.png)
- [Pub](screenshots/pub.png)
- [Scenery](screenshots/scenery.png)
- [School](screenshots/school.png)
- [Shops](screenshots/shops.png)
- [Snowstorm](screenshots/snowstorm.png)
- [Spaceport day](screenshots/spaceport-day.png)
- [Spaceport night](screenshots/spaceport-night.png)
- [Sprawling town](screenshots/sprawling-town.png)
- [Starlit ground](screenshots/starlit-ground.png)
- [Stone outcrop](screenshots/stone-outcrop.png)
- [Sunset](screenshots/sunset.png)
- [Task countdown desktop](screenshots/task-countdown-desktop.png)
- [Task countdown phone](screenshots/task-countdown-phone.png)
- [Town overview](screenshots/town-overview.png)
- [Trading](screenshots/trading.png)
- [Twin moons](screenshots/twin-moons.png)
- [Village](screenshots/village.png)
- [Walking](screenshots/walking.png)
- [Winter](screenshots/winter.png)
- [Wood cottage](screenshots/wood-cottage.png)
- [Woodland clearing](screenshots/woodland-clearing.png)
- [Woodland](screenshots/woodland.png)

## Livestock

Original articulated cow, sheep, pig and chicken meshes use smooth anatomy, procedural coat/fleece/feather detail and shared instanced rendering. No downloaded animal assets. `CHROMIUM_PATH=/usr/bin/chromium npm run screenshots:livestock` captures close-ups of the actual meshes with preview lighting in `test-results/livestock/`; the browser livestock test captures the live game.

## Geometry and texture budgets

Grilles, tread, wheel bolts, doors, siding and window frames use cached procedural textures. Window emissive masks keep frames dark and panes lit. Animal coats share one atlas; limbs remain separately animated. No per-frame texture generation or extra downloads.

`npm run profile:models` measures triangles before scenery batching: tractor with driver 14,262 (formerly 29,824); cow 5,704, sheep 3,916, pig 4,156 and chicken 4,044 (formerly 13,464–15,768); sample cottage 248 (formerly 1,514). These geometry counts are not FPS promises. `CHROMIUM_PATH=/usr/bin/chromium npm run screenshots:models` captures tractor/cottage/day/night close-ups in `test-results/models/`. Preview lighting includes shadows; game shadows remain optional.

Cow anatomy is baked from original blended volumes by `npx tsx scripts/cow-surface.ts` into `src/client/cow-surface.json`; run Prettier after rebaking. Torso and legs share a closed surface, with weighted vertex deformation for walking. `npm run screenshots:livestock` includes a side view. Reference photographs guide proportions only; no reference pixels are shipped.

### Biplane

`src/client/biplane.ts` replaces the built-in aircraft's box primitives with an
original civilian mail-plane design. A tapered shell has a real opening for the
pilot, staggered wings have shaped tips and a cockpit cutout, and the undercarriage
uses a tail-down resting stance that levels off after leaving the ground. Bracing,
landing gear, windscreen, padded cockpit rim and propeller are simple geometry;
fabric weave, rib tapes, seams, registration, radiator fins, wood grain and instruments
are cached canvas textures. Garage paint tints the fabric and fuselage while retaining
the dark trim. Creator-supplied models still override the built-in aircraft.

The propeller stops when the engine is off. Only the visible local cockpit updates
its instrument texture, at most ten times a second, with airspeed in mph, attitude,
altitude in metres above sea level, heading, climb rate and throttle-derived RPM.
Fuel and height above ground remain visible. The moving yoke and throttle quadrant
use separate material batches; gauges and needles are drawn into one canvas texture.
The seated eye and camera up-vector follow pitch and bank without detaching from the
cockpit. The current development model has 12,306 triangles and 19 meshes including
the pilot. These are geometry budgets, not FPS guarantees. See [Flying](FLYING.md)
for the accompanying physics and controls.

Run `npx tsx scripts/biplane-preview.ts` for front, rear, side, overhead and seated
views plus a review sheet in `output/biplane/`. The focused browser check is
`npm run test:e2e -- tests/browser/biplane.spec.ts`.

### Canal boat

`src/client/canal-boat.ts` builds the Parish Carrier: a 13.5-metre steel canal
boat with rounded swim ends, a submerged lower hull, cambered cream roof, narrow
side decks and open bow/stern working decks. Cached textures provide cabin
windows, portholes, signwriting, door panels, deck grain, hull seams and waterline
bands. Rails, ventilators, mooring cleats, fenders and a lifebuoy supply silhouettes.
Paint changes the hull and cabin without tinting window glass or gold lettering.
The standing skipper and stern camera share a real helm position; the tiller turns
with visible heading changes. Static fittings are batched by material.

Rod racks, bow seating and extra fenders complement the stern tiller. Navigation
lamps use view-dependent sectors; cabin-window emission uses a cached texture mask.
Deck and cabin illumination share the existing three-light marine pool.

The model has 14,677 triangles and 23 meshes including the skinned skipper, with
four 1024×512 texture designs plus a window mask cached by finish/paint. This is a geometry budget,
not an FPS guarantee. Existing speed, capacity, fuel use and
world boundaries are unchanged; collision clearance now matches the larger hull. This design is an Aclone interpretation; archived
original documentation establishes boat control mode 3 and configurable models,
but does not establish a specific historical canal-boat design.

Run `npx tsx scripts/canal-boat-preview.ts` for factory renders from the bow, stern,
side, overhead and helm, plus a review sheet in `output/canal-boat/`.
`npm run test:e2e -- tests/browser/canal-boat.spec.ts` checks hull orientation,
waterline placement, paint, steering animation, helm sightline and geometry budget.

### Hovercraft

`src/client/hovercraft.ts` builds the Marsh Courier, a small enclosed utility
hovercraft with a continuous rounded skirt, sloped windscreen, cargo lockers,
rear duct, safety mesh and turning fan. Rubber folds, panel seams, maker lettering,
non-slip deck pattern and instrument faces use cached textures. The fan guard is
an alpha-tested texture rather than a lattice of individual geometry. Each craft
retains independent garage paint; creator-provided models still take precedence.

The model accounts for the physics engine's 0.5-metre hover offset, leaving its
skirt just above the surface. Static geometry is batched by material. Including
the seated driver, it stays below 15,000 triangles and 24 meshes. These budgets
are not a measured FPS guarantee. Speed, cargo capacity, fuel use and water/land
handling are unchanged. The engine controls the fan; only the visible local
cockpit updates its speed/fuel texture, at most four times a second.

Run `npx tsx scripts/hovercraft-preview.ts` for actual factory renders and a review
sheet in `output/hovercraft/`. Run `npm run test:e2e -- tests/browser/hovercraft.spec.ts`
for paint, engine animation, skirt normals, ground clearance, instrument updates
and geometry-budget checks.

### Building finishes

`building-finishes.ts` supplies shared 512px masonry, timber, plaster and roofing maps plus 256px door, awning and window details. Profiles distinguish food shops, civic buildings, agricultural sheds and industry; existing stone and cottage siding remain in use. Brick joints, grain, fasteners, shutter ribs, bread displays and leaded glass are baked into textures. Roof courses follow the eaves and corrugations run downhill. Original footprints and cottage style choices are unchanged.

No building gains triangles. For the preview IDs, garage 366 → 58, farm 574 → 84 and bakery 610 → 346; the cottage remains 248. The finite texture library is generated once, shared across buildings/rebuilds and mipmapped; its base RGBA data stays below 11 MiB (mipmaps add about one-third). Window quads retain their existing emissive mask and light batching. More material families can add static material batches; geometry savings are not an FPS guarantee.

`CHROMIUM_PATH=/usr/bin/chromium npx tsx scripts/building-preview.ts` captures the actual bakery, bank, school, garage, farm, pump house, mill and cottage in `test-results/buildings/`, with browser-error checks. `tests/building-finishes.test.ts` checks geometry budgets, texture reuse, cottage customization and window batching.

### Boatyard and commercial fishing

The shoreline boatyard uses the existing building finishes, a large repair hall,
separate stores and an open lifting hall over the water, with tall doors, crane
slings and side jetties. Each architectural model has three distinct boats on
stands: 15 named craft with different hull proportions, cabins, rigs and deck
fittings. Shared small plank textures supply surface detail. All five complete
yards remain below 3,500 triangles, including their repair boats. It adds no
high-poly imported assets.

The 20.4-metre North Star commercial fishing boat has a flared hull, forward wheelhouse,
textured instruments and glazing, stern gantry, net drum, fish boxes, mast and
fenders. Its trailing net is an alpha-tested texture. Static geometry is batched
by material. Including its seated driver and the furnished wheelhouse, the preview
reports about 17,050 triangles before repeated fish instances; its human-sized controls are separate from the
enlarged hull (hidden deployed gear included). The wheelhouse uses textured lining,
rubber floor, a radio and chart desk, with batched window frames, chair and controls.
The mounted compass and speed/fuel/throttle panel have private canvas textures,
updated only for the local first-person skipper, at most ten times per second and
only when readings change. Compass bearings use geographic north, matching the HUD;
gauges show knots, throttle magnitude and fuel percentage. The lever shows ahead or
astern throttle, and the panel reports an empty tank. Emissive faces keep readings
visible at night without adding lights. Radio and paper chart are decorative.
`npm run test:e2e -- tests/browser/fishing-wheelhouse.spec.ts` checks readings,
texture isolation, forward sightline and model budget, and captures day/night and
look-around views. The emergency lifeboat
uses orange inflatable tubes, timber seats and animated oars. All are actual
Three.js game models; no generated concept images are used for review.

See [boating](BOATING.md) for controls, economy and reproduction commands.

### Fishing lights (pending release)

`fishing-lights.ts` supplies six sector-aware emissive navigation lenses, batched
floodlight fixtures, a window-only emissive mask and the cabin fixture material.
Each visible vessel updates its own lenses/windows. A scene-wide pool of two
shadow-free aft/down deck spots and one cabin downlight serves the closest lit
vessel within 80 metres and fades out over the final 20 metres. Additional boats
retain their visible lamps/windows without adding dynamic lights. The existing
single player searchlight remains independently controlled. Navigation glints
have bounded distance scaling for readability; no strobe or bloom pass is added.

### Complete commercial trawl rig

`trawl-rig.ts` replaces the pointed cone with an open, forward-facing mouth,
forward wings, tapered body and closed trailing codend. Two otter boards spread
the bridles; headline floats and a weighted footrope frame the opening. Eight
reinforcing seams follow the deforming skin. Knotted diamond twine is an original
procedural alpha-tested texture, not individual strand geometry. The skin uses
825 vertices and 1,536 triangles; boards, floats, fish and draining water use
instancing. No new dynamic lights, cloth solver or physics bodies are needed.

Towing responds to speed and steering; paused gear sags. A twelve-second visual
haul retrieves the rig, raises the gathered bag under the gantry, drains and
empties it, then winds it onto the drum. This does not add a server-side wait or
change catch rates, carrying limits or fuel use. Visible fish and bag swelling
use only the existing coarse activity cues. The sea material uses viewing-angle
transmission, leaving submerged gear dimmer than objects above the water.

References consulted for structure and operation (not copied into game assets):

- [NOAA: midwater trawls](https://www.fisheries.noaa.gov/national/bycatch/fishing-gear-midwater-trawls) — mouth, spreading doors and codend.
- [FAO: bottom otter trawls](https://www.fao.org/fishery/docs/CDrom/ARTFIMED/ArtFiWeb/descript/Gear/geartype/gt306.htm) — wings, floats and footrope.
- [Seafish: underwater net photograph](https://www.seafish.org/responsible-sourcing/fishing-gear-database/selective-device/benthos-release-panel/) — enclosing panels, mesh and taper.
- [NOAA Teacher at Sea: trawl operations and photographs](https://noaateacheratsea.blog/tag/trawl-net/) — stern gantry and suspended codend.

The game compresses towing distance/depth and handling time for visibility; it
does not simulate seabed contact or a full-scale commercial fishing operation.
Use `npx tsx scripts/trawl-preview.ts` for actual-model stills and animation.

## Ocean rendering and hull motion

The ocean uses shared deterministic spectral waves for GPU displacement and
server/client hull sampling. The surface has a denser central grid and a coarser
outer band (18,432 triangles, or 8,192 in Performance mode), an opaque far-water
background (two triangles), and a bounded 192-drop spray pool. There is no extra
scene render, reflection pass or depth framebuffer. Underwater material shading
uses exponential attenuation along the submerged viewing path. New terrain tiles
and boat materials receive the same shader extension. Existing material hooks,
instancing and skeletal transforms are preserved.

World-space phase prevents waves sliding with the camera. Bathymetry samples are
refreshed only when the ocean grid moves to another 16-metre origin, reusing a
bounded four-metre survey cache with bilinear interpolation. Hull physics still
samples exact terrain. Shallow water
damps displacement and gets moving surf foam; storm crests get textured whitecaps.
Hull samples span each boat's length and beam. The trawl's trailing geometry stays
in the sea while its fairleads stay aboard the pitching hull. Hull reaction is a
kinematic buoyancy approximation with encounter-dependent resistance and spray,
not a full six-degree-of-freedom naval dynamics solver.

Tides share the astronomical moon's 28-day elongation and combine lunar/solar
semidiurnal components. See [NOAA tide frequency](https://oceanservice.noaa.gov/facts/tidefrequency.html),
[NOAA spring/neap tides](https://www.nesdis.noaa.gov/about/k-12-education/oceans-coasts/what-causes-tides)
and [NOAA waves](https://www.noaa.gov/jetstream/ocean/waves). These describe the
physical behaviour; the game uses its fictional moon period and tuned coastal range.

Checks cover optical depth with actual rendered pixels, tide periods/ranges,
boat response and camera clearance, storm versus calm rendering, and shoreline
boarding throughout a full tide cycle. `scripts/ocean-preview.ts` captures the
full production renderer in a disposable world for visual review.

### Coastal lighthouses

Five lightweight tower-and-cottage models use shared masonry/timber finishes, a glazed lantern, balcony rail and identification band. Navigation flashes are separate from model/terrain draw distance. `LighthouseLights` uses a narrow horizontal lobe, terrain line-of-sight checks, weather attenuation and a geographic horizon: 2.08 nautical miles times the sum of square roots of focal and eye heights in metres, capped at 16 NM. Distant sprites project inside the camera far plane. Day flashes are subdued and observers beneath the horizontal beam see little light. A single nearby shadowed spotlight illuminates surfaces; its shadow refresh is bounded to four times per second. Only misty precipitation/storms show a faint atmospheric shaft. No whole-island geometry is drawn just to show the signal.

### Rocky headlands and surf

Saved `coastalBluffs` define a scalloped lip, a roughly two-metre-wide drop of 28–44 metres at the centre, a submerged foot and a broad inland blend. The same height function drives terrain, maps, construction and movement. Local tiles use finer geometry around headlands; exposed faces use rock shading rather than stretched grass, with small instanced rim outcrops. Seeded folds and tapered shoulders replace broad flat crowns; only a small footing beneath each public lighthouse is levelled. Partly submerged sea boulders are part of the shared heightfield, with exposed-rock shading and boat collision. A spatial index avoids testing every headland for ordinary inland/ocean samples.

`CoastalSurf` budgets at most 36 local breaker strips and 648 spray points. Shoreline sampling follows tidal height. A beach cross-section leans, overturns, collapses and washes inland; a cliff impact rises and falls ballistically in broken sheets and droplets. These are visual approximations, not a fluid solver. Existing swell sampling still governs boat motion. Nearly flat seas suppress surf. `scripts/coast-preview.ts` captures the real GameScene in clear weather, storms, darkness and from offshore; the browser regression checks animated geometry and beacon direction without shader errors.

References inspected for this design:

- [Northern Lighthouse Board: Neist Point](https://www.nlb.org.uk/lighthouses/neist-point/) — photograph of grass-covered headland and sheer rock faces; 43 m focal elevation, 19 m tower, flashing white and 16 NM range. Our fictional rotation remains 16 seconds, rather than copying Neist Point’s five-second characteristic.
- [IALA G1094](https://www.iala.int/product/g1094/?download=true) — geographic visibility calculation using observer/signal height and atmospheric refraction. Daymark geometry supplies the horizon model, not a claim about lamp brightness.
- [National Park Service: coastal waves](https://www.nps.gov/articles/coastal-processes-waves.htm) — spilling, plunging and surging breakers as shore slope changes.
- [National Park Service: coastal erosion](https://home.nps.gov/articles/coastal-processes-erosion.htm) — wave impact and reflection against steep coasts.
