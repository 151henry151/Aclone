# Development backlog

## Planned — Alternate road routes and gradual city paving

- Add useful loops to the growing road network instead of stopping as soon as every destination is connected. Compare the shortest existing road journey with the cost/distance of a safe proposed connection; grow an extra route only when it saves substantial travel or removes a significant detour, with a minimum benefit threshold and a limit on redundant parallel roads.
- Evaluate towns and important destinations such as the spaceport as connection candidates. A Puddlewick–spaceport connection may be worthwhile alongside Toby's Reach–spaceport and Toby's Reach–Puddlewick; Mabel's Reach can continue routing through Puddlewick when a separate direct road offers little benefit. These are examples, not hard-coded routes.
- Score proposals using actual terrain-aware paths, including hills, rivers, property and existing junctions. Re-evaluate as settlements grow; construct qualifying roads incrementally with the existing road-growing behaviour.
- Define a configurable city threshold from sustained development (occupied buildings, businesses and population). Calibrate it above present-day Puddlewick, which is approaching city size; all other current towns remain below it. Use hysteresis so a temporary population change does not repeatedly change status.
- Only qualifying cities begin paving, very slowly, outward along existing roads from their centre **toward the highest-density concentrations of buildings**. City status does not pave every road inside the town boundary. Paving should take much longer than ordinary dirt-road growth, with persistent progress and per-world thresholds/rates.
- Score local development density along each proposed street corridor and at its destination, using nearby occupied buildings/businesses rather than the administrative town radius or the acreage of farm fields. Prioritize connected streets serving compact urban clusters; farms, scattered homes and other sparsely developed rural areas retain dirt access roads even inside a qualifying city. Avoid leapfrogging isolated buildings or turning a long farm access lane into pavement solely because its owner belongs to a city.
- Use configurable density thresholds, sampling radius and sustained-development timing so gradual growth can eventually qualify a former rural area, without short-lived construction changes repeatedly flipping eligibility. Existing pavement persists if density later falls, consistent with road persistence.
- Only after a connected urban paved route reaches a city's boundary may an intercity paved route begin growing toward another qualifying city. Reaching one suitable boundary exit is sufficient; there is no requirement to pave the whole town, every district, or its perimeter first. An eligible intercity trunk can traverse open countryside, but that does not qualify adjoining farm lanes or rural branches for paving. Never extend intercity pavement just to connect a smaller town; its ordinary roads remain available.
- Test useful triangle/loop connections, rejection of pointless detours, gradual town development, density-directed paving, persistent dirt farm lanes inside cities, one-exit boundary-first paving, city-to-city eligibility, restart persistence and configurable timing. Choose final numerical thresholds through a survey of live settlements before implementation.
- This is future work, separate from the current northern island expansion.

## Planned — River crossings, bridges and highway haulage

### Persistent roads and distinct river-crossing rules

- Established dirt and paved roads persist when a new route opens. Adding a shortcut, bridge or intercity highway must not erase an older usable route. Only explicit changes such as rerouting around a building/field/obstruction, demolition or an owner-authorized edit may retire the affected segment. Preserve old ford roads when a bridge is built.
- When a dirt-road project connects towns on opposite sides of a river, search along the river for the nearest **usable ford**, then snake the road to that crossing and onward to the destination. Evaluate an actual connected route, not just proximity to a river centreline: the whole crossing and approaches must meet ground-vehicle depth, width, gradient and bank-clearance limits. Prefer the nearest feasible ford that makes geographic sense for the journey; never grow a dirt road across an impassably deep reach.
- Make the ford search work at the enlarged island's scale, including a town founded far across a river. Use a river/ford graph or staged route search instead of a single enormous fine-grid search. Cache surveys and invalidate them when terrain, water rules, bridges or obstructions change.
- Paved roads have a different policy: they may lead directly toward a river and stop safely at its bank while awaiting a bridge. They **must not detour to a ford or pave an existing ford crossing** merely to claim a continuous paved connection.
- When a usable bridge exists, paved-road routing can select it and connect across it, taking reasonable approach detours. The paved network's connectivity must count bridges but exclude dirt fords, even where the ordinary vehicle road network is already connected.
- Where unfinished paved approaches stop on opposite banks, allow dirt feeder roads to grow from their ends toward a usable ford, preserving an interim cross-river route. A later bridge can complete the paved route while those older dirt feeders remain.
- Integrate these rules with the separate city-paving backlog: sustained city qualification, slow centre-outward paving toward dense urban areas, dirt-only rural/farm access lanes, boundary-first expansion, and intercity destinations only. Paved crossings do not grant smaller towns city status or trigger paving toward them.

### Player-built bridges

- Add a major, deliberately expensive bridge construction project: the user's initial target is **about 800s plus substantial materials**, with final quantities/prices calculated against the economy. Costs should reflect span length and design; avoid a trivial cheap crossing of a broad navigable river.
- Survey and preview a valid bank-to-bank span, stable approaches, foundations, safe deck grade and sufficient clearance above the river. Account for water levels and retain boat passage where the river is navigable; supports, vehicle collision and rendered decks must agree.
- Define ownership, construction permission, footprint reservations, contribution of money/materials, completion and maintenance/removal rules. Persist unfinished projects and prevent double charging or simultaneous overlapping bridge builds. Decide public-access/toll policy before implementation rather than assuming one.
- Connect the bridge's road anchors to the ordinary and paved road graphs only when the bridge is safely usable. Pending construction should not let traffic drive into the river. A bridge elsewhere on the river can attract reasonable paved approaches without deleting established roads.
- Give bridge building a clear multiplayer purpose: players fund the expensive missing link needed for a genuinely paved intercity transport corridor. No automatic free bridge should bypass that investment.

### Proper tractor-trailers / articulated highway trucks

- Add a separate class of beautifully modelled road haulage vehicle: detailed tractor units and full-size articulated semitrailers, distinct from agricultural tractors and their existing trailers. Include realistic scale, cab/interior, lights, mirrors, wheels, fifth-wheel coupling, articulation and suitable animations.
- Target approximately **45 mph on dirt roads and 65 mph on paved roads**. Off-road travel must become extremely slow, making investment in roads and bridges valuable. Tune loaded/empty acceleration, braking, turning radius, grades, fuel use and cargo weight; avoid letting trucks exploit a narrow patch of pavement or jump between disconnected road classifications.
- Provide several meaningful semitrailer types: refrigerated trailers for fish/perishables, enclosed box trailers for general goods, open/stake or log trailers for timber, and additional types only where there is a real cargo/economic role. Determine whether refrigeration consumes fuel/power and how it affects existing spoilage rules before implementing it.
- Calculate real dimensions, cargo capacities, compatible goods, prices, fuel cost, operating cost and earnings per trip. Model each trailer in detail, with visible loads and cargo-appropriate restraint. Use realistic articulated steering/reversing and continuous collision for the whole rig, including bridges, gate widths, towns and tight approaches.
- Define purchase/ownership, manufacture-to-delivery flow, coupling/uncoupling, parking, loading/unloading, fleet persistence, death/recovery and permissions. Reuse existing cargo/trading systems where appropriate without treating every trailer as an unlimited generic inventory.

### Late-game automotive manufacturing industry

- Tractor-trailers must be manufactured by a new **automotive factory** industry, rather than appearing as unlimited cheap shop stock. Plan how completed tractor units and trailer variants become purchasable vehicles and how orders, factory output and deliveries are represented.
- The factory should require a very large initial investment in both cash and construction materials, explicitly including substantial metal, gravel and wood. Set costs high enough to be inaccessible in early play and attainable only through extended saving, trading and economic development; calculate final figures instead of treating the initial idea as a finished balance sheet.
- Operation should consume large quantities of metal and appropriate other inputs, require working capital/staffing and take meaningful production time. Integrate upstream mines, smelters, steel mills and other existing businesses; define production recipes, inventory limits, sales and export interactions, and NPC buying/selling behaviour.
- Balance vehicle prices and factory margins against the value of high-capacity 65 mph haulage and the capital tied up in bridges and paved corridors. Preserve useful livelihoods for ordinary tractors, small transporters, boats and existing manufacturers.
- Make city thresholds, paving/growth speeds, bridge costs/materials, truck performance, trailer capacities, factory construction costs and recipes configurable per world, with portable designs and validated limits.

### Implementation order and acceptance checks

1. Survey current settlements and haulage economics; define the road-surface/city/ford/bridge data model and configurable defaults.
2. Implement persistent alternate routes and deterministic ford-aware dirt-road growth; prove a new town beyond a river eventually gains a traversable route.
3. Implement slow, density-directed city paving and bank-ending paved projects, including dirt feeders to fords. Demonstrate that rural/farm lanes remain dirt within a city and that a dirt connection does not falsely count as paved connectivity.
4. Implement costly player bridge construction and road integration. Demonstrate paved approaches joining a completed bridge while original dirt ford routes survive.
5. Add the automotive factory's construction, supply chain and manufactured vehicle inventory; then detailed trucks and specialised semitrailers, articulated driving and cargo integration.
6. Test blocked/absent fords, multiple rivers and bridges, tides/water configuration, terrain edits, new obstacles, bridge removal, town growth/shrinkage, concurrent builders, server restarts and world import/export. Test loaded truck speeds on each surface, bridge clearance, reversing, trailer persistence and long-run profitability.

This entire transport/industry programme is **backlog only**. The current island expansion supplies rivers and physical shallow/deep crossings; it does not implement automatic ford-routing, paving, bridges, highway trucks or automotive manufacturing.

## Planned — River trade

- River docks (0.114.0) board and moor small craft only. Cargo transfer, delivery settlement and fuel at river berths, and recovery of a boat stranded upriver, are not defined yet; they should stay consistent with boatyard and pier behaviour.

## Planned — Forestry and logging

- Replace static wood-patch harvesting with individual forest trees that can be felled and cleared for building.
- Persist tree age, growth, harvesting and regrowth over meaningful in-game seasons/years; define replanting and sustainable forest management.
- Design logging equipment, vehicles, hauling and processing as a complete, balanced livelihood, with satisfying felling/loading animations and multiplayer ownership rules.
- Keep this separate from the northern island expansion; the expansion adds forests but does not introduce logging mechanics.

## Completed in 0.109.0 — 2026-10-30

- Walking flashlight and appropriate controls; no engine controls/readouts for walking or the emergency raft.
- Lifeboat capacity 10 and nearby-only stranded-boat reboarding.
- Vessel scale audit using real three-week trawler voyages; 24.5 m trawler, 16.8 m tug and 4.3 m motorboat with human-scale crew and helms.
- Tugboat purchase, paid rescue consent/escrow, physical towing, free self-recovery, docking settlement and cancellation/restart/death handling.
- Seven distinct trailers with purchase, ownership, cargo restrictions, trading, livestock transfers, persistent parking, articulated reversing, collision, load effects and detailed models.
- Spaceport relocation to about 1.25 km from Puddlewick, preserving property and replacing the old site's fences, reservation and access roads.
- Runways excluded from the road network, with growth reconnecting isolated branches around the airfield.
- Twice the maximum tractor third-person zoom range.
- Cheap outboard motorboat, empty-tank rowing, rod fishing and fuel-delivery/tender-towing recovery; canal boat price increased to 60s.
- Free town teleport removed while genuine death respawns and caretaker recovery remain.
- Cape lighthouse road search fixed; new roads prefer gentler grades and use modest deterministic curves. Existing construction rate and safe clearance rules remain.

Design references, economic calculations and usage: [Boats, rescue and haulage](HAULAGE.md). No remaining items from this batch are deferred.

## Completed in 0.105.0

- Livestock: fenced grazing parcels, roaming/grazing animations, adjoining expansion, herd capacity, breeding checks and production/input/staffing scaling. World owners can adjust capacity and expansion prices.
- Maps: building-type icons, hover/focus names, sparse close-up labels and navigation that preserves a distant viewed location through zoom and snapshots.
- Vehicle editor: per-world movement, handling, fuel, cargo, price, passengers/crew, provisions, death/recovery, trawling, tyre footprints, tread artwork, cockpit instruments, lamp lenses and Workshop components. Portable designs retain these configurations.

## Completed in 0.104.0

- Charter fishing boat, paid trips, passenger fishing and settlement.
- Independent synchronized tractor headlights, including lamp faces and nearby beams.
- Random rod-fishing bites at the configured average rates.

The completed release sections describe shipped work.
