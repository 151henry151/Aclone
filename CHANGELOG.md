# Changelog

All notable changes to Aclone are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Puddlewick automatically eats and drinks from inventory and selected home/private-room stores anywhere, online or offline. Configure each source and the indoor needs multiplier per world; home estimates include eligible carried supplies.

- Configure boat loss on death, cargo spoilage and fuel retention per world. Puddlewick loses all owned boats on death; recovery worlds allow a lifeboat or passenger ride back to an offshore vessel.

### Added

- At-home provision estimates show real time until food or drink runs out, whichever comes first, excluding starvation and death time.

- Add steady fishing-boat navigation signals and separately controlled deck, cabin and search lighting.

### Changed

- Start fishing controls collapsed in a compact corner strip, with a persistent full-net notice.

### Fixed

- Keep the boat camera above the ocean surface during orbiting and smoothing.

## [0.95.0] - 2026-10-25

### Added

- A furnished North Star wheelhouse with a working mounted compass, live speed/fuel/throttle gauges, moving engine lever, low-light instrument faces, chart desk, radio, seating, floor and ceiling lining. The first-person seating position leaves the horizon and instruments visible together.
- Commercial fishing expeditions with two voluntary deckhand berths, agreed shares of realised profit, shared boat provisions, dockside settlement and saved crew agreements. Deckhands eat automatically online or offline; online captains must eat manually.
- Animated fish activity in the nets, a hauling-and-dumping sequence, visible landed fish piles and a heading compass in the fishing-boat HUD.

### Changed

- Commercial nets catch continuously during actual towing. Inspect catches by hauling at any time; there is no completion timer or numerical preview of unhauled fish. Separate net and hold limits preserve earned catches.
- The North Star now costs 300s and carries 3,200 weight with a 3,200-unit tank, supporting 21 Puddlewick days of towing plus an offshore return journey. The canal boat costs 24s. Existing owners retain their vessels and fuel.
- Offshore fishing starts beyond roughly 150 metres of coastal clearance. Conditions improve gradually towards open ocean, with persistent good and bad spells and substantial risk of loss. Fuel and cargo weight affect the commercial boat’s speed and fuel consumption.
- Puddlewick gains navigable ocean around its unchanged island, with public boatyard storage, working capital and paid fuel shipments sized for the larger expeditions. Seafood resale margins and funded, real-cargo exports remain in place.

### Fixed

- Visible ocean water follows boats offshore instead of remaining frozen near their starting location.
- Boatyard arrivals accept stopped boats across a 30-metre waterfront area instead of requiring five-metre alignment with one point. Menus and server checks agree, and intervening land still prevents remote disembarking.

## [0.94.0] - 2026-10-24

### Added

- Shoreline boathouses with open lifting halls extending over water, stores and floating jetties. Each of five architectural models has distinct boats on repair stands, from sailing craft and wooden launches to working fishing boats and cruisers. Puddlewick gains a public boatyard when a clear shoreline site is available. Board and leave boats at boathouses or the fishing pier; boats left at the pier remain visibly moored.
- An orange emergency rowing lifeboat for empty tanks. Leave the main boat and cargo offshore, row to a dock for fuel, then return to reboard and refuel. Moorings and rescue progress survive restarts.
- Deep-water Atlantic cod, halibut and bluefin tuna, caught by rod from boats or with the new 70s, 20.4-metre North Star commercial fishing boat. Its persistent throttle, large tank, twelve-minute trawl, saved catches and variable hauls make commercial fishing a risky active livelihood.
- A coastal fish trade: cheaper boatyard landing/resale prices leave haulage margins to harbour stores, spaceports and hospitality businesses. Public shipments export real surplus catches; kitchens, cafés, pubs, B&Bs and hotels can cook seafood menus using normal staffing and inputs.

### Changed

- Rebuilt the canal boat as the paintable 13.5-metre Parish Carrier, with a shaped steel hull, curved cabin roof, timber decks, textured windows and signwriting, mooring fittings, lifebuoy and a standing skipper at an animated stern tiller. First-person view now comes from the steering position.

## [0.93.2] - 2026-10-24

### Fixed

- The circular gravel square in the starter town now behaves as road: tractors retain road traction, and snow displacement, drifts and tyre tracks respect its clear surface.

## [0.93.1] - 2026-10-24

### Fixed

- Tractor first-person views now follow the cab’s uphill, downhill and sideways tilt. Looking around stays relative to the seat, keeping the dashboard aligned with the view on slopes.

- The Puddlewick Flying Club sign now fits its lettering within padded edges, so the first and last letters remain fully visible.
- Browser CI suites have enough time to finish the growing test collection, while retaining individual test deadlines.

## [0.93.0] - 2026-10-23

### Added

- A public airfield on Puddlewick’s western outskirts, with a graded, marked runway, reflective edge markers and a corrugated-metal hangar. Placement stays inside the town boundary, protects existing property, and relocates obstructing public gathering spots nearby without resetting their resources. New construction and farm plots must leave the runway and apron clear.
- Spare biplane airframes: the hangar shows your total, and a crash destroys only the aircraft in use. Replacements are commissioned at the hangar with empty tanks and new maintenance records.
- Aircraft crashes now show a brief fireball, flying sparks and rising smoke at the server-confirmed impact position, visible to other players nearby.

### Changed

- Buy and board biplanes at the airfield hangar rather than an ordinary garage in Puddlewick; worlds without a hangar retain their garage aircraft desk. Boarding requires a stopped pilot and a clear apron; the plane starts outside with its engine off. Existing aircraft retain their fuel, paint and service history.

## [0.92.0] - 2026-10-23

### Fixed

- Biplane arrow keys now follow flight-stick convention: Down pulls the nose up and Up pushes it down; the flight guide and control hints match.

### Changed

- People now have a continuous smooth body mesh with skeletal animation, replacing the separate geometric body pieces. A shared texture supplies workwear pockets, stitching, boots and facial detail; walking and running now use retargeted human motion capture, with weight shifts, independent waist/neck/wrist motion and planted-foot constraints. Movement blends with stopping and reversing, and seated drivers use the same model. Each figure draws in one material batch.

## [0.91.1] - 2026-10-23

### Fixed

- Biplanes can back away from garages: hold throttle-down at idle for slow ground pushback, steer with the rudder controls, and brake to stop. Keyboard, touch and controller inputs share the same ground-only handling; throttle controls remain responsive while touching an obstacle.

- Tractor tyre tracks now match each model’s actual tyre widths and wheel spacing, with independent front and rear wheel paths through turns. Snow ruts and mud treads retain terrain following and fading; changing vehicles or returning after an absence no longer joins unrelated trails.

## [0.91.0] - 2026-10-23

### Added

- Two-handed biplane controls: W/S adjust a persistent throttle, A/D operate rudder and taxi steering, arrows pitch and bank, and B applies wheel brakes. Touch and controller equivalents, a flight readout and an in-game flying tutorial explain the controls.
- A textured six-instrument aircraft panel with airspeed, attitude, altitude, heading, vertical speed and engine RPM, plus fuel, height-above-ground and stall warnings. An animated yoke and throttle lever complete the cockpit; the seated camera follows the airframe through turns.

### Changed

- Replace automatic biplane climbing with aerodynamic lift, drag, momentum, gravity, banked turns, angle-of-attack stalls and engine-off gliding. Takeoff needs a clear ground run and deliberate rotation; safe landing needs controlled descent and wings near level. Hard impacts destroy the active aircraft and injure the pilot while preserving other owned machines.
- Aircraft engine sound and propeller animation follow throttle. Menus leave the throttle set and flight running; airborne pilots must land before switching vehicles or starting ground activities.

## [0.90.0] - 2026-10-23

### Changed

- Rebuild the hovercraft as a paintable marsh utility craft with a rounded rubber skirt, enclosed forward cabin, rear ducted fan, cargo lockers and textured non-slip decks. The fan follows engine state, and first-person instruments show actual speed and fuel.

## [0.89.0] - 2026-10-22

### Changed

- Rebuild the biplane as a fabric-covered mail plane with a tapered open-cockpit fuselage, shaped wings, bracing wires, rounded tail, landing gear and wooden propeller. Painted fabric seams, registration marks, wood grain and radiator details keep the model lightweight. The propeller follows engine state, the airframe adopts a tail-down resting stance, and the seated cockpit has working airspeed, height-above-ground and fuel instruments. Garage paint now appears on the aircraft.

## [0.88.0] - 2026-10-22

### Added

- Textured tractor cockpits with rounded dashboard housings, gauges for actual speed, fuel and condition, an odometer, engine/light indicators, floor mats, door inserts and headliners. Instruments illuminate with the lights and update only in the local first-person view.
- Independent paint colours for each owned vehicle. Garage previews show the selected tractor's saved finish; repainting it leaves the rest of the fleet unchanged. Existing owned machines retain their previous shared colour.
- Six distinct tractor designs with complementary cargo, speed, fuel, handling, rough-ground and headlight characteristics. Garages offer a rotating preview at a common scale and detailed specifications before purchase.
- Persistent individual vehicle tanks and remembered tractor selection: new specialist tractors start empty, parked fuel survives switching and reloads, and returning from walking recalls the selected owned tractor. Fuel gauges, roadside refuelling, wheel contact and tyre tracks match each machine.

### Changed

- Give the starter tractor a more economical engine so it remains a useful choice alongside the specialist machines. Existing custom vehicle slots retain their identities.

### Fixed

- Correct tractor steering-wheel tilt so the upper rim leans away from the driver; improve the seated view and dashboard placement across all six tractor models.
- Update the parish browser test to verify the restored council and its government panel instead of expecting it to be absent.
- Let the creator-preview browser check use the full software-rendering assertion timeout instead of aborting it early inside a shorter retry deadline.

## [0.87.2] - 2026-10-22

### Fixed

- Restore Puddlewick's missing public fountain-and-benches town centre on a clear nearby lot, without changing town borders, governments, finances or existing property. Starter cleanup now preserves civic centres; blocked restorations retry on later startups.
- Repair duplicated town meeting-place references in older saves, and prevent a town whose council was removed from claiming another town's fountain. Each town opens its own government panel after reloading.

## [0.87.1] - 2026-10-22

### Security

- Require the patched Node.js 24.22.1 LTS runtime and use it in container builds and CI, addressing the October 2026 Node.js security disclosures. Existing hosts must upgrade Node and restart their services separately from updating Aclone.
- Update Vite and its source-map dependency to fix development-server access/command-handling vulnerabilities and a source-map processing denial of service.

## [0.87.0] - 2026-10-22

### Added

- F9 → Statistics shows total playtime, including an explicitly labelled estimate reconstructed from historical connection logs. New connected time is saved across sessions and includes space travel without counting duplicate connections or paused worlds.
- Private per-world statistics track personal earnings, spending, financing, completed buildings, gathered materials and harvested crops. Existing death totals are included; activity counters survive new lives and clearly mark missing older history.

## [0.86.1] - 2026-10-22

### Fixed

- A visible Menu button with its F9 shortcut and a getting-started hint make maps, reports and settings easier to find while playing.
- Mabel remains in her home world to help neighbours and develop her founded town. Restarting with the guide's home-world policy returns a travelling guide without transferring money, inventory or property between worlds; stale departure plans are blocked.
- NPC founders consider building sites near their own towns and see explicit settlement-development goals and business limits alongside costed construction opportunities.

## [0.86.0] - 2026-10-22

### Added

- Roads gradually connect remote towns from both ends, sharing the existing 12-metres-per-game-day construction budget. Unfinished routes survive server restarts.

### Fixed

- Roads grow detours around buildings and all farm plots, reconnect blocked junctions, and retire obstructed stretches after the bypass is complete. New extensions plan around obstacles instead of getting stuck against fields or walls.
- Town-centre fountains sit on level stone retaining bases on hillsides; each bench rests on its own terrain height with legs reaching the ground.
- Tractors pitch and roll with the terrain under their tyres, including NPC tractors. Cab camera positions and headlights follow the tilted vehicle.
- Distant towns retain ground beneath their buildings. A cheaper outer terrain layer fills the camera's visible range with stitched edges, while clearer ordinary-weather haze preserves longer views of the spaceport and neighbouring settlements.

## [0.85.4] - 2026-10-22

### Fixed

- Snow banks, roof caps and fence caps now fade with the surrounding snow during thaw, instead of leaving opaque white roadside rectangles after most snow has melted.
- Remove dark, jagged snow outlines beside roads and prevent snow-bank triangles from cutting into the terrain. Roadside buildup now conforms to the ground underneath, including on slopes.

## [0.85.3] - 2026-10-22

### Fixed

- Snow now forms physical roof caps with visible edges, roadside banks, and small drifts against foundations, tree trunks and fences. Layers grow and melt with the measured depth, leave road lanes clear, and are batched for economical rendering.
- Snow tyre tracks now show compressed channels with shaded walls and tread relief that scales with snow depth and softens during thaw. Tracks stay continuous at low frame rates and follow sloping ground closely, while subtle surface and roadside lighting make accumulated snow easier to read without adding terrain polygons.

## [0.85.2] - 2026-10-22

### Fixed

- Adaptive graphics now responds to sustained low frame rates, reduces nearby lighting work and resolution in stages, and ignores isolated stalls. Startup avoids redundant animation work during preparation, offers a Performance-mode reload button, and explains when graphics remain slow.
- Performance mode's frame-rate cap now survives startup preparation instead of being disabled by an invalid timing value, avoiding unnecessary rendering work.

## [0.85.1] - 2026-10-22

### Changed

- Production builds include Brotli and gzip files for smaller game downloads without runtime compression work. Fingerprinted assets can be cached for a year; HTML and other mutable files revalidate so new deployments still load correctly.

## [0.85.0] - 2026-10-22

### Added

- Snow visibly accumulates on the existing terrain, covering low vegetation and tyre bottoms, with shallow drifts and tracks on its surface. Roads remain exposed without adding terrain polygons or draw calls.

### Changed

- Natural snowfall now favours shallow packs, with depths over six inches exceptional rather than routine. Excess snow melts at six centimetres per fully sunny day; the winter base persists until spring. Existing excessive natural snowpacks are reduced to twelve centimetres once on upgrade, while creator-forced snowfall remains unrestricted.

## [0.84.0] - 2026-10-21

### Added

- NPCs can carry out agreed price changes and surplus withdrawals at their own businesses, with saved progress, normal travel and ownership checks, and protection for operating reserves and investor claims.

### Fixed

- NPC financial explanations now distinguish till cash, stock value, savings, protected capital, historical cash flow and conditional production margins. Chat and gameplay share these facts, including explicit currency units, paused-purchasing reasons and observed supplier/haulier margins.
- Business accounts retain a bounded recent cash-flow window without inventing history for existing businesses. Negative lifetime cash flow no longer labels a cash-rich business as currently insolvent or unprofitable.
- Prosperous NPCs can consider drawing capital for opportunities beyond a preset farm budget. Explicit purchasing pauses survive routine maintenance; business agreements only report actions after execution. Conversation identity comes from the actual speaker rather than a remembered name.

## [0.83.0] - 2026-10-21

### Added

- Persistent snow depth with gradual, cumulative snowfall, varied storm strengths and lengths, and randomly milder or snowier winters. The HUD shows depth and warns of deep snow.

### Changed

- Extra snow melts only in sunny daylight: roughly 12 cm per fully sunny game day. The first 4 cm of winter snowfall remain until spring; changing seasons alone never adds or removes snow.
- Roads remain exposed and usable in snow. Ordinary off-road snow is easier to cross than before; increasing depth slows tractors progressively to a crawl. Players and NPCs use the same handling.

### Fixed

- Snow accumulation, melting and wet-ground drying agree between live play, saved games and offline catch-up, including custom or frozen sky clocks. Existing snow coverage upgrades to a thin layer without inventing deep drifts.

## [0.82.1] - 2026-10-20

### Fixed

- Repeat trades preserve their list position while quantity-dependent tax quotes update.
- Focused HUD buttons keep their normal Enter activation, including leaving a hotel room; F2 remains available to enter chat.

## [0.82.0] - 2026-10-20

### Added

- Owner staffing controls: automatic or custom paid-job limits, individual dismissals and a one-hour reapplication cooldown. Existing rosters are preserved on upgrade.
- Business margin comparisons per batch and per real hour, including taxes, input replacement costs and unpaid owner work. Actual cash flow remains separately labelled; farms and livestock have appropriate caveats.
- A Remove from sale control for owned properties that preserves their asking price, stock and investment.

### Fixed

- Enter opens chat from the game HUD and keeps focus after sending; Escape returns to driving, while dialog forms keep normal Enter behavior.
- Owners can see shop stock, posted prices and quantity-aware included-tax estimates on Main without self-trading.
- NPC owners manage staffing using hourly contribution rather than batch margin alone, and job seekers respect vacancies and dismissal cooldowns.
- NPC financial explanations use explicit ownership, denarii units and estimated-versus-recorded distinctions, with shorter complete replies and no access to another owner's private accounts.
- Ordinary sentences such as “all that disappears” no longer summon the NPC group. Natural requests such as “your input isn't required right now” silence replies locally without another chat-model call.

## [0.81.0] - 2026-10-20

### Added

- Public Taxes & rates page in the World menu and parish directory, plus quantity-aware tax breakdowns beside shop trades and tax guidance in business administration.

### Fixed

- Businesses can explicitly pause buying or selling each good while retaining their price. NPCs stop accepting deliveries when stocked instead of offering 0d; buying prices have a 1d minimum, and trades reject changed quotes before moving goods or money.
- NPC property choices and queued actions no longer acquire a second cottage when a home or unfinished cottage is already owned, including when the saved home reference points elsewhere.
- NPC chat receives current world and town tax facts and explicitly distinguishes included sales tax from extra charges.
- Chat wheel scrolling uses small smooth steps instead of page jumps, while Page Up/Down retain overlapping lines. Reduced-motion preferences and reading positions are respected.

## [0.80.1] - 2026-10-20

### Fixed

- Distant woodland and small countryside scenery now fade out with fog instead of remaining as floating dark speckles above sunset and sunrise ridgelines, without adding geometry or draw calls.

## [0.80.0] - 2026-10-20

### Added

- An illustrated world-building guide with 18 actual editor screenshots and practical tutorials, shared between GitHub documentation and the public website at `/world-building/`.

## [0.79.0] - 2026-10-20

### Added

- An optional Discord release bot publisher with chronological changelog backfill, duplicate detection, rate-limit handling and a separate server-hosted timer that posts new dated entries after deployment.

## [0.78.0] - 2026-10-20

### Added

- Updated player, creator and hosting guides and the public website for these features.
- A seven-pass fidelity roadmap with evidence, dependencies and acceptance checks for controls, the economy, onboarding, construction and optional historical features.
- Immediate local driving prediction with server acknowledgements and bounded correction; other players retain interpolated movement.
- Business statements and NPC owner briefings now diagnose input coverage, output congestion, staffing, observed sales and cash runway; financing and owner deposits are separate from operating cash flow.
- World-specific first steps, recent destinations, explicit repeat gathering with a stop control, and configurable gamepad driving and menu navigation.
- Level foundation plinths and entrance steps for new construction on gentle slopes, with shared placement/preview checks.
- Creator checkpoint courses with hold points, weekly/all-time boards and sponsor-funded prizes; optional build/peace/war phases with persistent score archives.
- Optional prepaid commercial operating leases with asset bonds, funded fixed-term property auctions, and an audited, persisted maintenance pause.

### Fixed

- NPC job and supply choices reject unfunded or congested production and preserve living reserves; depleted resource attempts cool down immediately instead of repeatedly retrying.
- Prepare streamed terrain in small batches during loading instead of building the entire nearby horizon in one blocking task.
- Keep the caretaker's archived chat reading surface intact during live census updates, preserving scroll, focus and text selection.
- Update construction browser checks for the current building designer, including finish persistence, shoreline intake rotation and design-specific material costs.

## [0.77.2] - 2026-10-19

### Fixed

- Keep unclassified historical AI charges against global spending limits without incorrectly assigning them all to the conversation allowance.
- Expire unanswered NPC conversations after three local budget/context refusals, notify the speaker, and allow a fresh question to retry instead of repeatedly deferring an old message.

## [0.77.1] - 2026-10-19

### Fixed

- NPC factory owners pause paid input bids when supplies or finished goods are backed up, and reopen profitable bids after stocks fall. Operating reserves account for inputs already held and actual payroll; planning exposes these costs instead of treating reinvestment as profit.
- Surplus employees can move to known, funded vacancies they are qualified for. Residents reconsider expired career goals and return to earning when an acquired home's pantry is unaffordable.

## [0.77.0] - 2026-10-18

### Added

- Interactive orthographic previews in the public building gallery: rotate with mouse, touch or keyboard, zoom, and compare architectural models, finishes and sizes at a consistent scale. The viewer loads on demand and keeps image sheets available without JavaScript or WebGL.

## [0.76.0] - 2026-10-18

### Changed

- Building models now use trade-specific layouts: tall processing towers, low livestock sheds, long industrial halls, shopfronts with rear workrooms, civic halls and residential lodges. Five models and six independent finishes remain available for every type.
- Refresh the building gallery with the revised models and add an all-finishes, front-and-rear screenshot mode for visual quality checks.

### Fixed

- Seat council clock towers, school cupolas and rooftop plant into their roofs; close gaps beneath gables and support porch roofs and awnings properly.
- Keep shop signs clear of canopies, doors and windows, restore missing upper-floor windows, add actual doors to three-bay garages, and put crosswise shipping-container doors on their short ends.
- Give spaceport hangars broad cargo doors and high windows, and control towers an observation level instead of repeated office floors.
- Move henhouse nesting boxes onto exposed walls, keep windows clear of mill wheels, and mount workshop signs and yard machinery on supports.

## [0.75.0] - 2026-10-18

### Changed

- Large generated worlds have higher, more pronounced rolling countryside, with gentle foothills toward the harbour. Puddlewick’s original town footprint, compact maps and custom heightmaps retain their terrain.
- Tractors and other motorized ground vehicles accelerate and travel more slowly uphill and faster downhill, including in reverse. Downhill speed bonuses are capped, and wheels stay grounded on continuous descents. Road and weather effects still apply.

## [0.74.0] - 2026-10-18

### Added

- A public building gallery at nogits.com/buildings, with all 48 building types, five architectural models per type, search, enlarged images and links to individual building sheets. The gallery works on phones and without JavaScript, and ships with the public website.

## [0.73.0] - 2026-10-18

### Changed

- Tractors and other motorized ground vehicles travel faster on roads than across fields. Off-road top speed is 10% lower on dry ground, 20% lower in fully wet conditions and 40% lower in deep snow, on top of existing weather effects; road edges blend smoothly.

## [0.72.0] - 2026-10-18

### Added

- Trade-specific equipment and civic details for the new models: refinery pipework, brewery kettles, mine headgear, council clocks, kilns, workshops, loading yards and more. Every completed cottage now has a mailbox.
- Five architectural models for every built-in building type, with independent surface finishes. Courtyards, cross-wings, lofts, service halls and specialist structures give businesses distinct silhouettes; larger premises gain wings or floors rather than a uniformly scaled shell.

### Changed

- Supply caches are corrugated shipping containers with six paint colours and five arrangements, including 20-foot, 40-foot and high-cube models. Container construction uses the same steel-based bill regardless of paint.

### Fixed

- Keep the building preview at a fixed scale for each building type across model, finish, size and rotation changes, making larger premises visibly larger.
- Preserve architectural models and building sizes when exporting/importing world designs; use their footprints for placement, collision and NPC navigation.

## [0.71.0] - 2026-10-18

### Added

- Six construction designs for every built-in building, with material-specific bills and gravel foundations. Suitable premises offer larger storage capacities and lodging room counts at proportionate construction costs.
- A building designer with a live 3D preview, material and cost breakdown, north-up site plan and rotation controls before placement. New shared masonry and clapboard textures keep geometry lightweight.

### Fixed

- Keep hotel entrances visible on the lobby front at every building size.
- Check complete rotated construction footprints against buildings, protected areas, water and world boundaries before charging for a foundation.
- Match NPC cottage budgets and site choices to their selected design, and let construction plans gather missing raw materials using ordinary tools and gathering actions.

## [0.70.0] - 2026-10-18

### Changed

- NPC gameplay decisions use focused questions and a rotating shortlist of complete, structured plans, retaining costs, destinations, seasonal deadlines and current work instead of truncating descriptions.
- NPCs can choose savings milestones for observed homes and viable businesses, retain temporarily blocked careers, and compare recorded project outcomes when choosing future work.
- Protect half of the daily/monthly AI allowance and hourly request capacity for gameplay by default; conversation has its own ceiling within the existing overall limits (`NPC_GAMEPLAY_BUDGET_SHARE`).

### Fixed

- Keep NPC earning and refuelling routines available during planning-budget exhaustion, provider outages and local validation failures, including after restart.
- Recheck accepted trade quotes on arrival and reassess adverse price changes before trading. Preserve quote guards across meal interruptions.
- Stop failed budget checks generating repeated outcome evaluations, stop treating internal investment transfers as failed experiments, and avoid inspecting occupied private cottages as potential housing.

## [0.69.0] - 2026-10-18

### Added

- Caretakers can browse persistent public chat history in a new F6 Chat logs tab and load older notices from the Overview. History is fetched in batches, survives server restarts and keeps its scroll position during dashboard updates; private messages remain excluded.

## [0.68.0] - 2026-10-18

### Fixed

- Start the tractor engine when NPCs remount or refuel, and consolidate gathering tasks into practical loads without redundant wait steps.
- Stop NPCs repeatedly entering and leaving an already stocked home; pantry work now ends when supplies are sufficient, while departure still requires going inside.
- Let homeless NPCs complete affordable cottage projects during departure preparation, draw their savings and use their own business output for home supplies.
- Check actual production conditions before NPC job renewals and before leaving an old job; preserve payroll when employees deliver missing inputs.
- Allow cash-poor NPCs to gather with equipment they already own, and let business owners spend invested purchasing capital on inputs without consuming protected payroll or investor claims.

### Changed

- NPC owners can price surplus for known funded buyers with transport margins and production-cost safeguards, instead of arbitrary sell-price nudges.
- NPC earning routines use complete gathering or trading trips with funded buyers, larger practical loads and comparisons of earnings against travel time.
- NPC growth reviews show recurring living costs, affordable opportunities and business payback estimates. Decision journals count offered opportunities, and outcome memory distinguishes liquid capital from unsold inventory and internal transfers.

## [0.67.0] - 2026-10-18

### Changed

- Puddlewick jobs persist while offline without shift renewal, and qualified owners can operate factories unpaid. Production still requires stocked inputs, output space and funded employee wages.
- Existing starter saves receive a one-time employment policy update; later world-owner settings are preserved.

## [0.66.5] - 2026-10-18

### Fixed

- Farm care now consumes stockroom water, compost, gravel and topsoil before carried supplies; employees can tend crops without withdrawing business goods.

## [0.66.4] - 2026-10-18

### Fixed

- Respect requests for NPC silence without another model call, discard pending replies after dismissal, distinguish direct addresses from mentions, and prevent public follow-ups from keeping residents talking indefinitely.

## [0.66.3] - 2026-10-14

### Fixed

- Keep the two-client social browser fixture compact so simultaneous software-rendered terrain warmups do not time out before mail, family and trade checks begin.

## [0.66.2] - 2026-10-12

### Fixed

- Server shutdown closes unused browser preconnections instead of waiting indefinitely for a request.
- Housing browser checks exercise each accommodation separately, and the labour check waits for shift completion before checking payment on slow CI renderers.
- An NPC regression test waits for its mocked dialogue to start rather than racing the planner's timer.

## [0.66.1] - 2026-10-12

### Fixed

- Browser checks wait for playable readiness and completed panel refreshes. Update outdated expectations for textures, pump-house staffing, purchased map controls and map waypoints.
- Split CI browser coverage across eight runners so the full suite can finish within each job’s deadline, and include public-website checks in CI.

## [0.66.0] - 2026-10-12

### Changed

- Rebuild the public landing page with fresh gameplay screenshots, a responsive screenshot gallery, a first-day guide, and dedicated world-creation and self-hosting sections. Keep the page in the repository, generate its version from the release, and provide separate preview, browser-check and backed-up publication commands.

## [0.65.0] - 2026-10-12

### Changed

- Give businesses distinct textured finishes: brick and dressed stone, limewashed food shops, timber barns, and metal-clad workshops, with slate, clay or zinc roofs and purpose-specific windows and doors. Textured bay doors and awnings replace many small meshes without adding model complexity; cottage style choices and night lighting remain intact.

## [0.64.1] - 2026-10-12

### Fixed

- Streetlamp ground glows fade out in coloured fog instead of exposing bright square patches at sunrise, sunset and during storms.
- Clouds retain perspective near the horizon instead of stretching into vertical streaks; cloud shading and moonlight obstruction use the same curved-layer projection.

## [0.64.0] - 2026-10-11

### Added

- Treasury-run Puddlewick ports clear bounded surplus shipments for external revenue, freeing shelves and replenishing trade capital without resetting the world.
- A paid, isolated NPC snapshot evaluator runs real Jev decisions with normal attendance and game clocks, measured response latency, resumable checkpoints and a durable experiment-wide spending ceiling. Reports distinguish incomplete runs, costs, deaths, liquidity and local supplies.
- NPCs periodically reconsider completed careers, can transfer surplus between their own businesses, draw protected surplus for growth, and consider founding a distant town once securely housed and well capitalized.
- Town government is accessible from **Build** near the town centre, including towns whose council building was removed.
- Offline NPC evaluation supports up to 21 real-time-equivalent days, optional wall-time limits, measured acceleration and business/town reporting. It still uses a heuristic chooser, not paid AI decisions.

### Changed

- Default supply-chain prices cover ideal staffing, taxes and input delivery, including hay storage and imported pump fuel. A one-time Puddlewick migration updates standard owned and public business quotes/wages while retaining property, money and goods.
- Public labour pays 1d per short shift, with means-tested, cooldown-limited meal relief instead of unlimited 45d shifts.

### Fixed

- Business and bank cash transfers are independent of item quantities, removing the accidental 100d per-action limit and the derived NPC farm-hauling value ceiling.
- NPCs recover from unsupported ground vehicles, avoid redundant shift renewals, continue chosen housing projects and raise purposeful growth capital without repeatedly draining tills. Owner-carried export receipts remain attributable across interruptions and return to business working capital through normal deposits.
- Large NPC memories no longer crowd routine gameplay requests out of their existing size allowance. Shorter planner instructions preserve survival, agreement and business guidance.
- Routine employment no longer interrupts a chosen errand. Owners can see their own sales accounts, construction searches use the actual map bounds, and growth/civic options remain visible among many trading choices.
- Business reserves cover an ideal crew; livestock construction budgets include available starter animals. Internal supply transfers preserve source input reserves and home provisions.

## [0.63.4] - 2026-10-11

### Fixed

- Winter kills all unharvested farm crops, including during offline catch-up. Harvests must finish before winter begins; stored produce and permanent drainage survive. Farm notices explain the deadline, and NPCs avoid planting crops that cannot mature in time.

## [0.63.3] - 2026-10-11

### Fixed

- Garage browser checks now expect the selected tractor colour to be hidden, matching contextual controls, while confirming alternative colours remain available.

## [0.63.2] - 2026-10-11

### Fixed

- Waypoint arrows point toward the destination in the current camera view, correcting reversed left/right directions and following camera orbit, smoothing and view changes.

## [0.63.1] - 2026-10-11

### Fixed

- Farms explain when no crops can be planted in the current season instead of showing empty crop menus. Open farm panels refresh when the season changes; existing crops remain available for tending and harvesting.

## [0.63.0] - 2026-10-11

### Added

- Address online AI neighbours together with “Hey guys,” “everyone,” “anyone,” or `@all`. One suitable volunteer may reply publicly based on qualifications, interests, commitments and needs; other listeners make no chat-model calls. Accepted jobs use the existing training and employment agreements.

## [0.62.1] - 2026-10-11

### Fixed

- Building panels show owner controls only for personally owned property; outside investment has its own tab. Caretakers manage other properties explicitly through the editor.
- Desktop and mobile actions now follow current vehicle, home, passenger, activity and plot state, hiding redundant or inapplicable controls and refreshing when ownership changes.

## [0.62.0] - 2026-10-11

### Added

- Grow and bale hay on farms, trade it through large player-built hay barns, and feed cattle and sheep from their building stockrooms. Hay can replace or mix with manufactured feed; water and qualified care remain necessary.
- Farm owners can buy adjoining four-plot parcels, expanding from four to sixteen plots. Purchases cost personal cash, check usable land, persist with the property, and enlarge visible fields.
- NPC farmers use expanded fields and hay demand; livestock keepers consider hay supplies, and hay merchants can fund and stock their barns while preserving living reserves. Existing saves gain hay quotes without replacing prices or granting stock.

## [0.61.0] - 2026-10-11

### Changed

- Automatic businesses have ideal active crew sizes: understaffing and overcrowding both slow production. Fractional progress carries forward; existing stock, wages, prices and employees are preserved.
- Building panels show active versus ideal staffing, and NPCs fill useful vacancies without overcrowding crews. World creators can set ideal crew sizes on custom building templates.

## [0.60.0] - 2026-10-11

### Added

- An Inventory discard action for unwanted cargo, also available to stranded NPCs as a last resort after checking nearby buyers or storage.
- Persistent NPC career projects for resource gathering, trading, employment, housing and business operation, with local continuation and fresh eligibility checks.
- An offline NPC soak evaluator with schedules, normal survival, controller restart and outcome reports; it makes no API calls.

### Changed

- Reserve household spending and a low-fuel allowance before optional trades or investments; fund owned businesses from surplus cash and return exported sales receipts to their tills. Owners can draw household and cottage savings from surplus working capital while protecting operating reserves and investor claims.
- Budget tax, materials and operating reserves before starting construction, then procure and deliver the remaining materials as a persistent project.
- Avoid redundant NPC factory shifts and rank farm crops by funded shortages, existing stocks and planted crops. Farming careers cover training, planting and harvesting; seed and fertilizer spending preserves harvest wages. Farm owners get costed purchase and operating plans as well.

### Fixed

- Scheduled NPC visits now reach earning routines. Empty tractors can be abandoned temporarily to walk, earn, eat or return home, rather than repeatedly failing to drive. Long countryside walks receive a distance-based deadline.
- NPC builders can navigate out of their new construction sites, and interrupted gathering errands return to their resource patch. Full loads can be delivered or unloaded to make room for meals.
- NPC fishing stops at a portable reserve instead of repeatedly overfilling cargo. Surplus food can be sold or stored, and heavy empty-tank loads can be reduced to walking capacity without losing tools or emergency meals.
- Pantry forecasts now match actual home feeding. Residents can retrieve their own supplies from expired rooms and unload excessive portable provisions.
- Large investment-return collections no longer invalidate Mabel’s entire planning request. Invalid candidates are isolated and validation paths are logged without private prompt contents.
- Remote employers no longer reveal unseen stock changes to ordinary NPCs; visits refresh their remembered quotes.

## [0.59.2] - 2026-10-08

### Changed

- Keep scheduled NPC visitors busy earning when they are online: public labour, gathering or a live job, instead of sitting or wandering. Mabel may still rest.

## [0.59.1] - 2026-10-08

### Changed

- Let the chase camera tilt up and down with the same drag as first person.

## [0.59.0] - 2026-10-08

### Added

- Add pickaxe, chainsaw and shovel items, sold at Harbour stores, the spaceport and the garage.

### Changed

- Require a chainsaw for logs, a pickaxe for stone and a shovel for gravel or topsoil, and stop treating workshop tools as a gathering implement.

## [0.58.1] - 2026-10-08

### Changed

- Keep NPCs on their tractors: remount when they have fuel, buy fuel when the tank is low, and stop treating walking as a garage vehicle to collect.

## [0.58.0] - 2026-10-08

### Added

- Invent NPC founding, bid and haul options from the recipe graph so a missing producer or unposted input bid for any good becomes a supplied next step, not only a mill-to-bakery flour loop.

### Changed

- Rank chain-closing founding and bid-posting above leisure on the Jev shortlist, skip a neighbour's in-flight founding of the same building kind, and score a mill (or other shop) from catalogue wholesale when downstream buyers have not posted bids yet.

## [0.57.0] - 2026-10-08

### Added

- Add a caretaker dashboard, available only to the world creator, listing every pilot and AI resident (balances, hunger, thirst, health, skills, inventory, loans and activity) and every building (till, stock, prices, staff, production and accounts). Private letters, secret ballots and unaccepted trade terms stay sealed.

### Fixed

- Accept loan fields on NPC operation plans so a working-capital borrow offer cannot crash the parish process.

### Changed

- Build NPC choice catalogues off the 50ms physics timer, one planner at a time, and dry-run candidate plans on a reused parish snapshot instead of cloning the world for every option.
- Keep snow and mud print spacing per tractor so neighbouring vehicles do not stamp each other's tracks.
- Keep last-known shop quotes in an NPC parish model for a day, wander to mills, farms and bakeries to refresh them, and rank live price experiments with ordinary trade routes.
- Stamp tractor snow and mud tracks as chevron tyre prints under the rear wheels, at the tractor's track width, and keep them for about two and a half minutes.
- Honour a held job locally: plant empty funded farm plots, fetch one missing bid-priced input, or renew a funded shift, and do that once before welfare logout when still comfortable. The workplace they already work stays in their live parish model.

- Identify Puddlewick's bread and water safety net by the reserved world id and economy template, not by server ownership, so a player-owned public parish still imports.
- Keep a reserved shelf of bread and water at Government necessities and refill it whenever the stock falls.
- Keep a reserved shelf of fuel at Government necessities, sold above other typical quotes, and refill it whenever the stock falls.

- Cap an outside business stake at an 8% earned return instead of 25%.
- Lock unpaid outside claims in the till so the owner cannot withdraw invested cash or skim the owed return, and refund unpaid principal if the shop is demolished.

## [0.56.0] - 2026-10-07

### Added

- Add `scripts/deploy-nogits.sh`, which backs up the database, fast-forwards the nogits.com checkout to `origin/main`, reinstalls dependencies when the lockfile changed, builds with `BASE_PATH=/aclone/`, restarts the service and verifies the public assets and health version.
- Leave fading tyre marks behind moving tractors in snow and in wet weather.
- Invent live NPC experiments from the current parish: remount a fueled tractor, try one-unit trades, fund a starved shop till, post missing bids, raise an empty wage, restock from the till, sell outputs, fish and sell the catch, or buy and fund an unowned producer.
- Let neighbours invest working capital in a business they do not own and later collect a capped return from earnings only.

### Changed

- Remount a tractor with fuel instead of walking, keep a smaller living-cash reserve so a modest purse can still buy one unit, and treat invented market experiments as first-class gameplay choices.
- Withdraw owner cash from a business till when personal money is too low for fuel or supplies, and leave enough for wages, bids and unpaid outside stakes.

## [0.55.0] - 2026-10-05

### Added

- Accept a pilot key carried in the URL hash (`#pilot=…&world=…`), store it in the browser and remove it from the address, and link players on nogits.com to the hromp.com page that brings an existing pilot across.
- Hang a small swaying red **For sale** tag showing the asking price beneath the name sign of every building its owner has listed, visible from 70 m and updated as listings and prices change.

### Changed

- Change clicking a building name on the parish map to set a waypoint there instead of opening the building's panel, and remove the **Choose waypoint** button.
- Zoom the parish map with the mouse wheel or a two-finger pinch, keeping the point under the cursor or fingers in place; zoom is now continuous up to 300%.
- Let the parish map zoom out below 100% until the whole world fits the window, re-centring the sheet as you pan, scaling the grid and scale bar to round distances, and hiding resource names below 100% and building names below 50%.
- Synthesize every game sound behind the loading screen (**Tuning engines and birdsong…**) instead of on first play.
- Keep the loading screen up (**Settling in…**) while the world renders behind it, with the HUD laid out, until 20 consecutive frames run smoothly or 6 seconds pass, so automatic quality reduction and first-frame GPU work happen before controls are handed over.
- Draw a soft ground glow, draped over the terrain in one batched mesh, under every lit streetlamp that has no spotlight of its own, and fade spotlights out as the next lamp approaches their slot instead of switching them off.
- Draw signs and pilot name tags after all transparent scenery so the sea and other translucent surfaces no longer paint over them.

## [0.54.0] - 2026-10-04

### Added

- Add a per-world town charter (`townCharter`, owner **Towns** editor tab and design import/export) covering town founding (switch, cost, skill, town limit, spacing), border size and growth, construction outside borders (allow, nearest town's rules, or forbid), permitted forms of government, which rules town governments control, maximum tax, tax notice periods, election timing, candidate deposits and campaign payments, voter residency and proposal quorum.
- Add player-founded towns with their own plinth, treasury, residents, construction/sales/wage taxes, north/south district zoning by building category, and resident/guest permissions for building property, building roads and modifying the environment.
- Add town governments: appointed mayors, proprietor-owned towns that can be sold and bought, elections with registration, deposits, per-vote campaign payments, deferral and secret ballots, mayoral auctions, and direct democracy where residents propose and vote on rule changes.
- Add the `*town`, `*showresidents` and `*sethometown` chat commands and the Lua functions `in_town(player, name)` and `home_town(player)`.
- Add a town plinth panel, found-town form in **Build**, town borders on the minimap and parish map, and town-aware HUD location ("In the town of …" / "Closest town is …").
- Add NPC options to join a home town, stand or bid for mayor, vote for candidates, vote on proposals and, as mayor, set the construction tax.

### Changed

- Change construction, sales and wage town taxes to apply only inside a town's border (or under the nearest town when the charter says so) and to pay into that town's treasury instead of being sunk.
- Grow a town's border when buildings are completed on its outskirts, up to the charter maximum, the map edge and neighbouring towns.
- Migrate saved worlds' single town to the new town model, keeping its tax as the construction and sales tax and converting players' home town names to town ids.
- Change build quotes to show the local town's construction tax and disable buildings the town's zoning or permissions refuse.

## [0.53.0] - 2026-10-04

### Added

- Add a `mapSize` world setting (500–20,000 m, owner-editable) and set the public Puddlewick to 12,500 m; non-economy templates and saved worlds without the setting use 500 m. Clamp movement, owner commands, landscape features and waterworks sites to the configured map.
- Generate countryside terrain beyond the unchanged 500 m village: seeded hills, inland lakes, a harbour inlet reaching the southern sea and an island coast sinking into open sea before the map edge, plus a deterministic woodland density field.
- Add countryside gathering grounds on a 400 m lattice with stable ids (`worldResources`), typed by woodland and height; list the forty nearest in **Resources** and the nearest 32 in NPC observations.
- Grow 5 m lanes from the road network toward buildings standing more than about 12 m from a lane: one 12 m stretch per game-day boundary, skirting buildings and water, persisted in `world.roads` and included in `townRoads`, maps, streetlights and NPC routing.
- Stream 128 m terrain tiles with per-tile lane/surface masks, a camera-following sea plane and 256 m chunks of woodland, outcrops and gathering-ground scenery around the player on large maps; compact worlds keep the single village plane.
- Sample the real coastline on the parish map and HUD minimap, follow the player on the minimap outside the village, open a 640 m local sheet from **Find me** in the countryside, and accept waypoints and landscape coordinates anywhere on the map.
- Window the NPC navigation grid around each journey on large maps (up to about 1.6 km per leg) instead of the fixed village square.

## [0.52.0] - 2026-10-04

### Changed

- Give NPCs visit-based market knowledge (Mabel remains the public-market guide), durable survival and production errands, public expiring supply intentions, and net-asset feedback. Correct service approaches and preflight gameplay requests before charging the shared budget.

## [0.51.1] - 2026-10-04

### Fixed

- Make public fuel delivery to waterworks profitable and rebalance water-chain margins, preserving player-owned and custom quotes on upgrade.

## [0.51.0] - 2026-10-04

### Added

- Restore the reserved starter Puddlewick's server ownership and add premium government bread/water imports during shortages, preserving player-owned properties and contents.

## [0.50.0] - 2026-10-04

### Added

- Show active work shifts, remaining production checks, and an expired-shift reminder; renewal becomes available during the final cycle.

## [0.49.1] - 2026-10-04

### Fixed

- Total consecutive confirmed purchases or sales at the same shop, including feedback after closing the window; failed trades do not count.

## [0.49.0] - 2026-10-03

### Added

- Owners can cancel nearby unfinished construction for a 75% refund of its base cash cost. The building panel shows the refund before confirmation; tax and delivered materials are retained. Original costs persist across restarts, and older sites use a conservative catalogue-based fallback.

## [0.48.2] - 2026-10-03

### Fixed

- Give browser regression checks time to receive and render live updates on software WebGL, and wait for the playable HUD before testing fishing controls. Keep desktop/mobile social checks within a smaller rendering budget.

### Changed

- Refresh the implementation status guide to reflect the completed creator, audio, social and activity work and its remaining limitations.

## [0.48.1] - 2026-10-03

### Fixed

- Restore account sign-out from the galaxy screen; the offline-survival reminder still appears when leaving a world.

## [0.48.0] - 2026-10-03

### Added

- Optional Scout, Interceptor and Bomber robocrows with distinct speed, hull and weapon capabilities, plus energy/cooldown-limited drone mark and recall. Drone destruction returns the pilot safely without a kill reward.

### Fixed

- Prevent scouting drones from trading, starting jobs or entering other activities while their pilot remains elsewhere.

## [0.47.0] - 2026-10-03

### Added

- Optional annual lottery funded entirely by in-game ticket purchases and voluntary player contributions. Saved draws show odds/history, carry empty jackpots and pay offline winners once; Puddlewick keeps it disabled.

## [0.46.0] - 2026-10-03

### Added

- Creator-authored inventory books, reading objectives for tutorials, and recurring town events linked to quests. Event notices survive reloads without replaying missed occurrences.

### Fixed

- Keep creator form drafts separate for individual audio zones, books, events and catalogue records; refresh readable inventory when a new book arrives.

## [0.45.0] - 2026-10-03

### Added

- Authored audio zones with original woodland, shore and storm sounds or uploaded MP3s; object/region placement, radius, looping, time and weather conditions. Playback and decoding have explicit client budgets.
- Independent engine, effects, ambience and chat-alert volume preferences, alongside master mute.

## [0.44.1] - 2026-10-03

### Fixed

- Give software-rendered map regression checks time to display authoritative position changes and waypoint arrival.

## [0.44.0] - 2026-10-03

### Added

- Animated GLB clips and rigs, original texture painting, custom terrain/resource appearances, and loading/failure indicators. Animation stays bounded for client performance.
- Portable world bundles with validated content hashes and media author/licence/source credits. Plain design exports retain their small, media-free form.

## [0.43.0] - 2026-10-03

### Added

- Relaxed owner-operated, harsh-survival and civilization-frontier world presets. Independent paid-job, wage-free owner-operation and timed post-death needs-grace rules retain Puddlewick defaults. Rules appear privately on arrival and in a leaving-safely panel before explicit sign-out.

## [0.42.4] - 2026-10-03

### Fixed

- Rebuild cows with a single closed torso-and-leg surface, fuller shoulders/thighs, shaped rear hocks and thicker lower legs. Weighted surface animation keeps the limbs connected while walking, with three instanced parts and fewer than 8,500 triangles per cow.

## [0.42.3] - 2026-10-03

### Fixed

- Split browser CI across four serial-rendering runners to stay within the test deadline. Allow slow software rendering to display multiplayer presence and ease in intoxication effects before assertions, while checking server presence independently.

## [0.42.2] - 2026-10-03

### Fixed

- Make browser regressions wait for graphics readiness before interacting, await actual socket closure when checking disconnected pilots, and match the current livestock breeding label. Keep the two-player social fixture focused on real mail/family/trade transactions without two full-town renderer warmups competing on CI.

## [0.42.1] - 2026-10-03

### Fixed

- Open chat at its latest messages after the loading screen finishes, even when history arrived while the HUD was hidden. Keep deliberate scrollback unchanged during later updates.

## [0.42.0] - 2026-10-03

### Added

- Accumulating beer/wine intoxication with authoritative steering drift and reduced control, scene warble, gentle roll, blur and double vision. Effects increase with repeated drinks and fade over time, including offline; the HUD remains sharp. Reduced-motion and saved reduced/off visual preferences leave gameplay impairment intact.
- Show intoxication status and alcohol warnings; NPC self-care and stocked homes prefer nonalcoholic drinks, and NPC planners receive their current condition.

## [0.41.1] - 2026-10-03

### Changed

- Reduce tractor, driver, livestock and building geometry; shared textures now supply tyre tread, grille slats, rim bolts, coat detail, timber siding, door panels and window frames. Give cows broad shoulders/thighs tapering to slender ankles. Keep articulated wheels/animals and independently lit window panes. Add repeatable model budgets and close-up captures.

## [0.41.0] - 2026-10-03

### Added

- A shared world-time cargo launch every three or four game days, with powered ascent, engine plumes, spreading pad smoke and a landing half a day later. Joining or reconnecting shows the current flight phase; the spaceport panel lists its status. Moving rocket geometry is batched separately from static ground equipment.

## [0.40.0] - 2026-10-03

### Added

- Visible articulated cows, sheep, pigs and chickens with coat detail and natural idle movement, tied to actual livestock stock. Share geometry and bound nearby herds to keep rendering costs predictable.
- Player-built sheepfolds, pig farms and henhouses; feeding, condition, breeding, wool, manure compost and eggs, with profitable default recipes and NPC operating guidance. Public ports gain starter animal quotes and stock once; player-owned prices and existing herds are preserved.

## [0.39.2] - 2026-10-03

### Fixed

- Prepare countryside textures and daylight/headlight graphics before enabling driving, instead of uploading and compiling them during the first moments of play. Show loading progress, keep controls neutral and audio quiet, and fall back to plain surfaces if a texture fails.
- Avoid building nearby farm scenery twice on arrival. Add a repeatable cold-load profile and explicit readiness waits in browser tests.

## [0.39.1] - 2026-10-03

### Changed

- Enrich sunrise and sunset with directional gold, rose and blue sky bands, sunlit cloud edges, a softer afterglow and gradual golden-hour lighting. Reuse existing cloud noise and lighting; full night and midday keep their previous illumination.

## [0.39.0] - 2026-10-03

### Added

- Set a destination on the parish map and follow a direction arrow and distance while driving. Waypoints appear on both maps, persist per world in your browser, support touch and keyboard, and can be cleared on the HUD. Dragging to pan does not place a waypoint.

## [0.38.0] - 2026-10-03

### Added

- Send durable private mail, create invitation-based families and exchange goods for an agreed price through explicit trade offers. Shared desktop/mobile panels preserve drafts; trades revalidate stock, money, cargo, proximity and life before an atomic exchange.
- Preserve existing family memberships, transfer leadership when a leader leaves, and let NPCs consider invitations and received trade offers through their normal decision planner.

## [0.37.0] - 2026-10-03

### Added

- Differentiate shuttle, hauler, courier, explorer and shielded escort journeys by range, hold size, fuel and time. Frontier shielding costs are predictable and included in route quotes; NPC travel uses the same quotes. Preserve the starter's 20 cargo spaces and existing saved journeys.

### Fixed

- Price every leg of suggested space routes and require sufficient actual fuel funding when accepting courier work.

## [0.36.1] - 2026-10-03

### Fixed

- Give the gathering browser test enough time for authoritative position updates on software-rendered CI; retain exact resource, gathering and inventory assertions.

## [0.36.0] - 2026-10-03

### Added

- Track each vehicle's distance, age since first recorded use and condition. Distance wear modestly affects speed/fuel; garages earn service fees and mechanics use carried steel parts for roadside repairs. Player panels include passenger boarding and disembarking.
- Let world creators disable wear or require advanced-vehicle qualifications and a carried map. Puddlewick retains free maps and basic driving. NPCs can plan maintenance and obtain maps; existing private prices are preserved.

## [0.35.0] - 2026-10-03

### Added

- Build feed mills, dairy barns, cheese dairies and country cafés. Herds consume feed/water, need qualified care, lose condition under neglect and can breed replacement cattle. Production, wages, trade and upkeep appear in ordinary business records.
- Configure food's current-health and bounded per-life maximum-health effects, visible in inventory. Milk, cheese and dairy suppers add distinct nutrition choices. Sheltered feeding advances at meal/health boundaries so offline catch-up matches live ticks.

### Fixed

- Include world-local foods in NPC urgent care, reserve planning and nutrition forecasts; expose the actual health maximum and dairy care requirements to their decisions.

## [0.34.0] - 2026-10-03

### Added

- Draw curved or straight paths, paint ground surfaces, place fence/wall lines and scatter Workshop models in a touch-friendly landscape editor. Preview grayscale heightmaps before applying; undo the last four landscape edits.
- Share saved terrain and barriers across rendering, maps, vehicle/projectile collision and NPC navigation. Bound edit sizes and avoid placing scattered models on roads, buildings or water; include landscape definitions in world-design exports.

## [0.33.1] - 2026-10-03

### Fixed

- Enforce creator “build” access requirements on construction requests before charging cash or creating a building site.

## [0.33.0] - 2026-10-03

### Added

- Define world-local goods, professions with prerequisites and tuition, and reusable building templates through creator forms. Custom goods participate in trade, cargo, consumption, sheltered feeding, estates, production and quest rewards; designs retain their definitions without changing other worlds.
- Inspect production-chain costs, margins, missing buying prices and available local suppliers in the production editor. Prevent deleting definitions still used by players, buildings or rules.

## [0.32.1] - 2026-10-03

### Fixed

- Stabilize browser checks on software-rendered CI: measure tractor height while it crosses the dock, and wait for the responsive layout transition after resizing. Keep the driving and fishing assertions intact.

## [0.32.0] - 2026-10-03

### Added

- Create ordered quests and item/reputation rewards without scripting, with private saved progress and configurable death resets. Set action requirements that reject trades or other actions before changing money or inventory.
- Give Lua bounded per-player variables, inventory/skill queries and verified trade, job, qualification, construction and death events. Ignore results from previous lives; emit gathering completion only after cargo is delivered.

## [0.31.0] - 2026-10-03

### Added

- Fund rotating parish maintenance orders with hourly budgets, shared demand and early per-player delivery limits. Players and NPCs can supply local goods at Harbour stores; expired funding never accumulates during downtime.

## [0.30.0] - 2026-10-03

### Added

- Add private return reports, personal event history and business statements covering sales, materials, wages, taxes, capital and production. Diagnose shortages from live server state, retain item/quantity details in transaction records, and give NPCs verified recent history and business results.

## [0.29.1] - 2026-10-03

### Fixed

- Let online NPCs answer addressed messages while preparing to log off or running survival errands. Allow a bounded departure grace period for replies and send private notices when a provider failure or departure prevents a response.

## [0.29.0] - 2026-10-03

### Added

- Configure skill, inventory, job and property loss on death, cash/savings retention, and an optional real-day offline absence limit. Existing defaults and Puddlewick's survival/estate behavior stay intact.

## [0.28.0] - 2026-10-03

### Added

- Upload static Wavefront OBJ models and assign PNG/JPEG UV texture atlases in Workshop. Visitors load and cache visuals automatically, with visible placeholders during download; server validation bounds geometry and prevents external material/file loading.

## [0.27.3] - 2026-10-03

### Fixed

- Label each gathering ground at its actual map location; resource names no longer point to empty land between widely scattered sites.

## [0.27.2] - 2026-10-03

### Fixed

- Correct the art reference to match the enlarged launcher and industrial terminal, replacing obsolete dimensions.

## [0.27.1] - 2026-10-03

### Fixed

- Bound the always-present NPC guide independently of manual growth. Keep everyday rules available and retrieve detailed economy/banking sections on demand so expanded documentation does not exceed conversation budgets.

## [0.27.0] - 2026-10-03

### Added

- Add fixed-rate bank loans and mortgages with affordability checks, employment and repayment-based credit scores, scheduled offline payments, early repayment, arrears and foreclosure. Preserve debts across death and allocate foreclosure proceeds to lenders and former owners; expose quotes, repayment controls and conservative NPC financing choices.

## [0.26.1] - 2026-10-03

### Fixed

- Enlarge the industrial spaceport launcher sixfold, add a cargo hangar, control tower and utility wing, and keep human-sized access, solid machinery, a walkable apron and an accessible terminal within the starter map.

## [0.26.0] - 2026-10-03

### Added

- Give NPCs model-free emergency self-care, practical home provisioning and costed business plans that retain working capital, supply inputs and sell outputs. Add paid Harbour shortage shipments and expensive on-demand bread/water imports so empty government shelves do not make supplies unobtainable.

## [0.25.0] - 2026-10-03

### Added

- Preserve building contents and investment after death in Puddlewick. Price unclaimed estates from base value plus 90% of current catalogue-valued equity, with a compounded 5% reduction each game year; expose configurable world rules and live quotes without changing player asking prices.

## [0.24.5] - 2026-10-03

### Fixed

- Keep arrow keys dedicated to driving when the chat log has focus; use PgUp/PgDn for chat scrolling without moving focus or losing a draft.

## [0.24.4] - 2026-10-03

### Fixed

- Make browser checks tolerate delayed software-renderer snapshots and asynchronous mobile relayouts. Hold the fishing bite fixture open during screenshots rather than racing its eight-second gameplay window.

## [0.24.3] - 2026-10-03

### Fixed

- Keep account settings open when the initial space snapshot arrives, and wait for account security details before offering password inputs so late responses cannot erase a new password.

## [0.24.2] - 2026-10-03

### Fixed

- Split CI into unit/type/format checks, two isolated browser shards and a dedicated subpath deployment check. Give browser tests time to finish and upload diagnostics, fail explicitly when the test server never becomes healthy, and retain server logs alongside failed or cancelled browser evidence.
- Update browser assertions for renamed gathering grounds and private, per-player NPC memory. Wait for asynchronous resize/editor updates; use performance graphics on software renderers and hold timed-task fixtures until inspection finishes. Capture short horn audio on the audio thread so rendering stalls cannot hide it from the test.

## [0.24.1] - 2026-10-03

### Changed

- Replace the release-heavy README with a short introduction, setup/play instructions and a complete documentation index. Move historical release/upgrade and NPC trial records into release notes, keep art prompts in a dedicated reference, and condense the guides around current behavior without duplicating topic details.
- Correct stale guidance on offline survival, the AI population, seeded waterworks and connected galaxies; retain historical descriptions in the release archive.

## [0.24.0] - 2026-10-03

### Added

- Give money directly to another online player in the same parish, with exact cash transfers and private receipts. Help stranded neighbours by using carried Fuel to refill their nearby, stationary vehicle. Both actions are available from player names and the Players & roadside help menu on desktop and mobile.
- Let world owners independently enable money gifts and player refuelling during creation or in the world editor. Both default to enabled, including in existing worlds.

## [0.23.1] - 2026-10-03

### Fixed

- Give NPC dialogue explicit current qualifications, study status and available employment/training requests. Distinguish the school catalogue from acquired skills, so an NPC who lost qualifications on death can agree to retrain instead of claiming to still have them.
- Keep old-life or unclassified relationship summaries archived rather than treating them as current character facts. Discard in-flight replies and plans when life, skills, study or employment changes, and replace earlier blocked copies when a player clarifies an employment agreement.

## [0.23.0] - 2026-10-03

### Changed

- Replace town-side resource rows with irregular gathering grounds on the outskirts: woodland clearings with felled timber, chipped boulders, gravel hollows with wheelbarrows, and exposed topsoil with roots and a shovel. Keep existing resource IDs and saved reserves while updating map, HUD and NPC destinations together.
- Give each gathering ground varied procedural geometry and original surface textures, with shared materials and reduced geometry in performance mode.

## [0.22.0] - 2026-10-03

### Added

- Give NPCs persistent conversation summaries scoped to each person and public/private channel, plus learned activity preferences shared with their gameplay planner. Preserve other relationships when updating a memory and retain preferences in bounded decision context.
- Let NPCs phrase delivery and employment acknowledgements in their own voice after the server checks the agreement. Reserve at most one additional reply call, with a durable factual fallback if it fails or exceeds the budget.

### Changed

- Prioritize addressed conversations for the next available request slot. Skip action-candidate generation and economic evaluation on chat-only turns; continue a sole safe agreed plan locally without a paid gameplay selection.

### Fixed

- Exclude mixed legacy notebooks, raw journals and other people's private agreements from conversation context. Keep private preference reasons out of option descriptions and preserve queued acknowledgements through restart.
- Avoid replacing ordinary phrases such as “I'll work out the numbers” with an unsupported-action correction. Correct the NPC guide's outdated lookup and conversation-call documentation.

## [0.21.3] - 2026-10-03

### Fixed

- Keep NPC dialogue in character: employment acknowledgements and errand corrections no longer expose the decision provider or separate chat/gameplay machinery. Conversation guidance uses one resident’s voice while preserving honest task status.

## [0.21.2] - 2026-10-02

### Fixed

- Restore Puddlewick’s intended starter roster: automatically add only the stonemason and shoreline waterworks. Retire the excess unowned/public buildings introduced by 0.21.0 and the public council while keeping every catalogue type available for players to build later.
- Preserve purchased and custom-built properties during the one-time cleanup, defer occupied buildings or running tasks, clear jobs at removed workplaces and account for retired public investment without replenishing stock on restart.

## [0.21.1] - 2026-10-02

### Fixed

- Connect NPC chat agreements for employment to persistent school, training and job-change plans. Check tuition, qualifications, skill limits and vacancies; record completion only after real employment. Prioritize ready agreements over optional errands while preserving survival and logout routines.
- Replace unsupported action promises with truthful queue acknowledgements or explanations. Explain blocked requests without extra conversation calls, preserve public/private replies, and keep old delivery agreements compatible.

## [0.21.0] - 2026-10-02

### Added

- Complete the default Puddlewick parish with every missing catalogue building, including a stonemason and a shoreline waterworks. New production businesses receive finite opening supplies and wage funding and remain available to buy. Startup upgrades preserve existing properties and prices, avoid occupied/protected plots and remember completed additions without refilling or recreating them on restart.

## [0.20.0] - 2026-10-02

### Added

- Add a world creator studio with arena presets, configurable teams/bases/victory rules and weapons, reusable shape or uploaded GLB/image models, interactive scenery, building and vehicle appearances, remote building layout editing and a visual production recipe editor.
- Add no-code interaction, entry, timer, login and task rules, plus bounded Lua effects for supplies, health, needs, teleporting, score and visibility. Add environment/road controls and portable world-design export/import without player data.
- Add optional trusted-galaxy connections: signed single-use travel tickets, persistent visiting characters, explicit browser arrival and authenticated return to the home pilot. Keep each galaxy’s economy and progress independent. Include host setup and player/developer guides.

### Fixed

- Serialize world-script execution and result application so overlapping events cannot lose saved variable updates.
- Keep acknowledgements from earlier actions from replacing a newly opened editor tab or an input being edited.

### Security

- Validate uploaded visual dimensions, embedded-only static GLB structure and geometry budgets before scene use. Reject external media references and cyclic model hierarchies.
- Pin peer signing keys, validate home passports and destination-specific expiring tickets, and consume arrivals transactionally. Visiting identity cannot authenticate a native account or import authority/balances.

## [0.19.3] - 2026-10-02

### Fixed

- Move timed-task countdowns out of chat into a prominent centered card with large digits on desktop and mobile. Gathering, labour, crafting and harvesting share the display; gathering returns to its Gather prompt after completion, and starting a harvest closes its menu to reveal the countdown.

## [0.19.2] - 2026-10-02

### Fixed

- Give Jev a compact survival and economy briefing with live need deadlines, effective nutrition, stocked suppliers, actual job wages and blockers, and recent outcomes that survive context trimming. Reconsider plans earlier when food or drink is needed.
- Offer varied buy-and-eat errands, preserve carried meals and drinking water during optional sales and business errands, and let owners buy and deliver missing production inputs in one plan. Keep actual action descriptions ahead of personality hints so shortened choices remain understandable.

## [0.19.1] - 2026-10-02

### Fixed

- Show a direct Gather control when approaching logs, stone, gravel or topsoil, including available reserves, load size and gathering progress. Explain missing tools, full cargo and depleted grounds on desktop and mobile; the HUD and Resources menu use the same eligibility checks as the server.

## [0.19.0] - 2026-10-02

### Changed

- Rebuild robocrows as detailed industrial scouts with layered metal flight feathers, exposed supports, ducted lift fans, optical sensors and gripping claws. Keep the moving model compact and batch its mechanical detail to limit rendering cost.
- Replace the small retro spaceport rocket with a 32-metre industrial cargo launcher: segmented metal tanks, weathered panels, exposed feed pipes, five engine bells, hydraulic landing supports and a tall offset service tower. Enlarge the apron and matching collision volumes while keeping the terminal entrance and its name readable.

### Fixed

- Make the fishing dock support tractors and pedestrians with a sloped shore approach, shared deck height and a clickable Fishing dock target accessible with E/Ctrl. Add prominent floating Cast a line, Reel in and Stop fishing controls at the center of the game view on desktop and mobile, separate from chat and Activities.

## [0.18.0] - 2026-10-01

### Changed

- Give spaceports a metal-clad terminal and a dedicated landing apron with an original retro rocket, swept fins, landing legs, cockpit windows, a service gantry and illuminated pad markers. Keep the terminal entrance and pad perimeter accessible; rockets and gantries have matching collision and picking volumes.

## [0.17.1] - 2026-10-01

### Fixed

- Show a prominent centered Reel in control while fishing, with a waiting indicator and a highlighted bite prompt. Catch fish directly without reopening Activities on desktop or mobile.
- Show each building owner's display name even when that player is offline. Keep names current during ownership changes without exposing offline players' private state.

## [0.17.0] - 2026-10-01

### Added

- A compact phone/tablet HUD with on-demand chat and pilot status, map/bag/actions navigation, and prominent nearby-building, fishing and home-exit actions.
- Separate touch steering and throttle, boost, flight controls and press/release weapons. Camera dragging and pinch zoom support multiple pointers; input releases safely on interruption, cancellation or opening a panel.
- Mobile menu sheets with larger controls, swipeable tabs, readable forms, retained trade/admin drafts, safe-area spacing and virtual-keyboard-aware sizing. All existing gameplay and account menus remain available.

### Fixed

- Keep desktop HUD layout and keyboard/mouse controls while adapting compact layouts to portrait, landscape and touch tablets. Restore the ordinary HUD when resizing back to desktop.
- Restart a javelin charge on a fresh press so a cancelled touch cannot silently retain a fully charged throw. Tabbing through chat or menus no longer releases a weapon.
- Correct in-game help about offline survival: stocked housing is needed, and hunger/thirst damage continues while signed off.

## [0.16.0] - 2026-10-01

### Added

- Build a shoreline waterworks with a distinct pump house, rooftop tank and working machinery audio. A trained pump operator turns one fuel into twelve water every ten minutes, supplying homes, lodging and other industries.
- Require dry shoreline foundations and a submerged intake for all waterworks construction, including editor placement and NPC plans. Terrain or water-level changes that flood the building or dry the intake pause production without consuming fuel or wages.

### Changed

- Offer water at 5d from waterworks, with 5.60d local input bids and 6.75d lodging retail quotes. Upgrade only the previous default water quotes on unowned/public businesses; preserve every owned business and unrelated custom quote.
- Avoid sending duplicate guide sections to NPC chat models as the player manual grows, retaining controls and relevant help within the existing context budget.
- Show shoreline eligibility in the Build panel and explain an unusable intake in workplace status. NPCs survey valid coastal sites and can build, supply, staff and trade with waterworks through ordinary game actions.

## [0.15.3] - 2026-10-01

### Fixed

- Align default processor bids, supplier asks, retail prices and export/import quotes across every production chain. Factory prices cover default ingredients, one worker and sales tax, while local deliveries pay more than exporting intermediate goods. Include imported water in costs, add useful hospitality/garage restocking bids, and price fallback fertilizer above locally made compost.
- Upgrade existing unowned and treasury-run businesses to the new price lists once at startup. Preserve all human- and NPC-owned prices, along with stock, money and wages; later edits survive reloads.

- Validate NPC delivery agreements before replying, using current ownership, accessible stock, posted prices, buyer funding and storage. Employees no longer promise to withdraw their employer’s goods; replies distinguish a recorded request from an actual delivery.
- Explain blocked deliveries once to the requester without extra AI calls. Remember notices across restarts, preserve public/private channels, and give existing agreements specific reasons instead of a generic stock/funding error.

## [0.15.2] - 2026-10-01

### Fixed

- Preserve trade-list and dialog scroll positions after buying, selling and other successful actions.
- Keep edited quantities, investment/withdrawal choices, stock transfers and other gameplay form drafts across refreshes, tab switches and reopened dialogs within the browser session. Separate drafts by pilot, world, building and tab; untouched fields continue reflecting live defaults, and credentials/files are never retained.

## [0.15.1] - 2026-10-01

### Fixed

- NPC replies no longer wait for a successful gameplay decision or its retry cooldown. Addressed conversation preserves the current action plan and remains independently metered under shared limits.
- Keep Jev requests within a conservative wire-size bound by omitting redundant chat/journal data and local execution steps. Preserve all candidate actions, live needs and agreements; tolerate rounded probability totals for large choice sets.

## [0.15.0] - 2026-10-01

### Added

- Fifteen named AI neighbours with distinct personalities and economic preferences, bringing the optional population to nineteen. Jev chooses gameplay; Mabel keeps OpenAI conversation and everyone else uses Claude.
- Persistent, varied real-world playing habits: shorter daily visits and occasional long visits, with three times the duration for Toby, Rowan and Elias. Mabel remains present. New arrivals are staggered, and the AI panel shows expected return times.
- Local departure routines that eat, drink, buy provisions, stock a home or booked room and travel inside using ordinary actions. Unprepared residents return sooner for a short welfare visit; spending limits remain shared and unchanged.
- Durable agreements from conversation to Jev, including deliveries split into cargo-sized loads. Ownership, posted prices, funding and storage are checked; actual successful sales track progress across restarts.

### Changed

- Hunger, thirst and starvation damage continue offline for human and AI players. Stocked homes and unexpired booked rooms feed their occupants; running out can cause ordinary death and estate consequences. Offline ageing and passive property decay still pause.
- Chat and NPC replies allow up to 1,200 characters, with matching input/model limits and complete-sentence guidance. Oversized submissions are rejected rather than silently shortened.

### Fixed

- Keep residents visible while AI requests wait, fail or hit spending limits; backoff no longer disconnects their characters.
- Show saved wages separately from editable drafts, refresh business details from live state, and give NPCs explicit current gross/net wages instead of relying on default or remembered figures.
- Building Admin displays current buy/sell prices and loads the selected saved price into the editor, preserving drafts during live updates and refreshing after saving.
- AI residents hear unnamed public follow-ups for two minutes after your latest turn. Conversations follow the same player, switch when another person is named, and retain recent dialogue context without extra routing-model calls.
- Remove the generic “Done. Quietly competent.” notification for chat and routine actions; errors and specific action results remain visible.
- AI replies now follow the initiating chat channel: public mentions receive public replies, and private conversations stay private, regardless of the model's suggested recipient.
- Chat scrollback receives mouse and trackpad input instead of passing it through to camera zoom. Page Up/Page Down also scroll history while composing a message, without losing the draft or reading position.

## [0.14.0] - 2026-10-01

### Added

- Elias Vale, a fourth independently enabled neighbour with Jev gameplay, Claude conversation and his own persistent identity and memories.
- A shared adaptive planner for every resident: compare parish jobs and shortages, learn any skill, trade, gather, manage businesses, build and provision homes, rent rooms, fish, customize vehicles and explore the galaxy. Plans use ordinary player rules and record actual financial/health outcomes separately from estimated profit.
- Durable space journeys and atomic account/world/plan checkpoints, plus tests for trade receipts, construction, lodging, fishing and restart continuity.

### Changed

- Mabel, Toby and Rowan all use the same Jev action catalog; prior careers are personality preferences rather than restrictions. Mabel retains OpenAI conversation; the others retain Claude. Existing identities and memories persist.
- Conversation requests use a smaller speech-and-notebook tool, only when a human addresses the resident; gameplay and chat share the existing spending limits with separate accounting. Routine turns make no chat-model requests; completed questions are not replayed, and failures have durable backoff and a three-attempt limit.

### Fixed

- Suppress unsolicited NPC progress announcements in the controller while preserving addressed public replies and private conversations.
- Offer explicit renewal and production-boundary waits for factory jobs, and report a deferred conversation budget privately once per question.

## [0.13.0] - 2026-10-01

### Added

- Rowan Field, an independently enabled farmer whose gameplay decisions use TypeSafe Jev and whose conversations use Claude, with his own persistent identity, relationships and action journal.
- Seasonal farming choices covering paid training, farm employment, planting, irrigation, fertilizer, harvest wages, farm ownership, investment and selling produce. Decisions use current supplies, crop state and ordinary game rules.
- Separate billing reservations for Jev decisions and addressed Claude conversations under the existing shared NPC caps; autonomous farming does not call Claude. Invalid decisions and provider failures preserve normal recovery and private-chat isolation.
- Farmer configuration, Docker environment support, operator instructions and an opt-in live API smoke test.

### Fixed

- NPC wage observations now include completed harvest receipts, so residents can verify farm earnings as well as factory wages.

## [0.12.0] - 2026-10-01

### Added

- Optional second AI neighbour Toby Finch, a male baker powered by Claude, with independent identity, personality, persistent memory and ordinary school, employment, trade and chat actions alongside Mabel.
- Claude Messages integration, stable-prompt caching, separate provider labels and privacy guidance, and independent native/Compose configuration using a server-only Anthropic or Claude key.

### Changed

- Share the existing NPC spending caps across both providers while reserving and settling each call at its own persisted rates, including Claude cache writes and reads. Existing NPC histories and billing records migrate without a reset.

## [0.11.3] - 2026-10-01

### Fixed

- Renew an existing job safely when a worker accepts it again, without duplicate employees or wages. Make expired shifts and missing active staff explicit in AI workplace guidance so Mabel can distinguish holding a job from actually working.

## [0.11.2] - 2026-10-01

### Fixed

- Show current staffing efficiency immediately after a worker takes, renews, quits or lets a job expire, rather than displaying the previous production cycle's value. Add the next production-check countdown and explain that batches require stock, space and funded wages.

## [0.11.1] - 2026-10-01

### Changed

- Give Mabel the complete FAQ and economy fundamentals on every decision, with additional context for her work and player questions. Refine her neighbourly personality to acknowledge mistakes, explain practical next steps and distinguish promises from confirmed results.
- Increase the bounded NPC request allowance from 60,000 to 96,000 bytes for richer guidance and feedback, retaining the existing model, decision cadence and shared spending caps.

### Fixed

- Stop repeated NPC failures from causing rapid model retries and duplicate chat announcements. Persist bounded failed-step history and retry delays, reject recently failed plan steps, and keep direct human questions responsive without clearing the failed-action blocks.
- Finish NPC service visits immediately when already in range instead of requiring a new route beside a building; stationary visits no longer require starting the tractor engine.
- Explain automatic mill/factory production, worker-accepted jobs, active shifts and owner-funded wages to AI residents. Include live workplace diagnoses, custom recipes, next-cycle timing, capital shortfalls, storage constraints and recent personal wage receipts instead of leaving the agent to infer them from raw stock.
- Preserve attempted actions and their errors across chat and restart, and record employment, skills and affected building stock alongside action outcomes so residents can correct mistaken plans.

## [0.11.0] - 2026-10-01

### Changed

- Reduce live-game bandwidth with field-level building/player updates and recipient-only changes to private state, accounts and chat. Shared delta generation and compression keep multiplayer broadcasts economical while retaining the normal update rate on healthy connections.
- Bound each modern client's outstanding snapshots so slow connections catch up to current state instead of accumulating old updates. Driving controls send changes promptly, with fewer duplicate messages and no additional queued controls behind a blocked upload.
- Adapt movement buffering to sustained network jitter, returning to the existing 300 ms buffer on stable connections. A short input timeout still stops unattended acceleration when delivery stalls.
- Default dynamic shadows off, keeping contact shading, models, textures and local lighting. Retain an opt-in shadow switch outside performance mode. Cache static scenery transforms and unchanged HUD content, and avoid sorting every town light on every rendered frame.
- Build NPC navigation obstacles only near buildings and reuse bounded lightweight Lua worker runtimes, with fresh isolated Lua state and the same execution limits for every event.

### Fixed

- Keep bursts of delayed driving/acknowledgement packets out of the purchase/chat action allowance, preventing ordinary catch-up traffic from flooding the player with “Too many requests” errors. Separate action and total-traffic limits remain enforced.

### Added

- Scrollable recent chat (up to the server's 100-message history), keyboard scrolling and a jump-to-latest button. New messages preserve a reader's position, and private-message filtering remains in force.
- An FPS readout beside network ping, with player troubleshooting guidance to distinguish graphics load from network delay.
- Real compressed-WebSocket tests over a bandwidth/latency/jitter-limited TCP link, mixed fast/slow-client coverage, browser checks with parked neighbours, and selectable old/new protocol load probes.

## [0.10.0] - 2026-10-01

### Added

- Optional AI neighbour Mabel Reed: a persistent personality who chooses multi-step plans, drives and walks through normal physics, earns wages, manages supplies and trades under ordinary player rules. Private in-game chat and visible AI labels make her identity clear.
- A durable resident journal, searchable older memories and a compact working notebook, with transactional action progress and restart recovery. Chat notices explain memory storage and the OpenAI connection.
- Server-only OpenAI integration with bounded requests, shared persistent spending caps, empty-parish sleep, operator pause/resume and usage/memory inspection. Exactly one resident is configured for this prototype; the controller supports a bounded future population without increasing its shared allowance.
- A local game-help library for Mabel: always-available controls, automatic FAQ excerpts, searchable player/economy manuals and catalog defaults, with live world settings taking precedence. Read-only lookups preserve private reply routing and require no paid embeddings.
- Automated provider, memory, navigation, economy, privacy, budget, guide and browser regressions, backup/restore coverage, opt-in live gameplay/help checks, and operator/developer documentation.

### Fixed

- Keep private NPC replies private through a guide lookup, and bound recalled memory excerpts so long histories and help text fit within the request budget.
- Make NPC action schemas compatible with OpenAI's strict tool format; the live trial exposed unsupported union encoding that mocked API tests missed. Clarify building visits and casual labour so the resident uses safe service-range navigation and the correct wage action.

## [0.9.0] - 2026-09-30

### Added

- An enlarged parish map with named buildings and gathering grounds, the actual winding roads, race and Hornball landmarks, and live player positions. Click a building name to inspect it; zoom, drag or scroll to explore, use Find me to return to your position, and Fit parish to include custom properties.
- Clickable minimaps and keyboard-accessible map controls, with readable labels and scrolling on small screens. Map zoom, scroll position and controls survive routine server updates.

### Fixed

- M now opens and closes the parish map instead of opening the Parish Directory. The directory remains available from its own buttons and the game menu.

## [0.8.1] - 2026-09-30

### Fixed

- Rebuild evergreen trees with irregular woody branches, smaller needle-covered shoots, tapered trunks and varied silhouettes, replacing the visible stacked cones and round leaf clusters. Detailed and performance graphics share the same branch shapes, and the foliage still receives snow without turning autumn orange.

## [0.8.0] - 2026-09-30

### Added

- Original synthesized tractor engines with a diesel idle and smooth rev changes while driving. Nearby players' engines and horns fade with distance and pan with the view direction.
- Working sawmills, mills, workshops, furnaces and other processing buildings have distinct machinery sounds. Activity follows production inputs, output space and wage funding, with quieter unattended operation and sound during manual crafting.
- A visible Sound button and saved master-volume control in Pilot & preferences. Sound starts after a click or keypress and defaults on for browsers without an explicit mute preference.

### Fixed

- Share engine-running state with other players and play horns from accepted server actions, without duplicate local beeps or replaying old horns on arrival or reconnection. Silence vehicle and machinery loops on disconnect, space travel and hidden tabs.

## [0.7.0] - 2026-09-30

### Added

- A fictional star sky with varied brightness and colour, gentle twinkling, nightly rotation and seasonal drift. Clear skies cast faint starlight onto the landscape.
- Two nearby moons of different sizes, with textured surfaces, sun-facing phases on a continuous 28-game-day cycle, and moonlight that follows their altitude and illumination. Moving clouds obscure the stars and moons and attenuate their ground light.
- Drag vertically and horizontally in first-person view to look around and up at the sky.

### Changed

- Give headlights a stronger, wider beam with a longer reach. Streetlights retain their bright centre but use a much broader cone and slower brightness falloff to illuminate the gaps between lamps and verges beyond the road. House window lighting and the fixed light budget stay unchanged.
- Select nearby town lights around the camera's focus so low-quality mode lights the road near the tractor instead of spending its smaller budget behind the chase camera.
- Align seasonal sunrise, sunset and lunar illumination to the same tilted planetary sky model; night lighting reuses the existing directional shadow light.
- Balance night illumination for visibility on a normal display: starlight reveals nearby ground and silhouettes, and a clear full-moon night reveals grass texture with softer light in the shadows. Overcast nights remain much darker.

## [0.6.1] - 2026-09-30

### Changed

- Standardize default non-harbour selling prices to the item reference price. Harbour stores pays 3% more for deliveries and sells at a higher price, so there is no profitable buy-back loop within one store. Untouched saved defaults migrate once; custom quotes, cash and stock remain intact.

### Fixed

- Wheeled vehicles steer naturally while reversing, based on actual movement direction even while braking. Walking and aircraft controls retain their existing turn direction.
- Owners cannot trade with, take employment at, refresh shifts at, or start workplace tasks at their own property. The interface directs them to Stockroom and Building Admin instead.
- Purchasing your workplace clears your employment there. Legacy owner-employees and reserved self-paid harvest wages are removed; owners can still tend their own farm plots without wages.
- Seasonal capture fixtures now find the relocated cottage, farm and spaceport instead of using old coordinates.
- Run browser checks sequentially so competing software WebGL renderers do not cause input and connection timeouts on CI.

## [0.6.0] - 2026-09-30

### Changed

- Spread the starter town across roughly eight times its previous area, with winding connected lanes, branches and loops instead of a compact crossroad layout. Buildings, vehicles and characters retain their metre scale.
- Road textures, roadside vegetation, streetlights and the parish map now share the same street plan; terrain accommodates the expanded town while preserving the coast and terrain edits.
- Existing untouched starter lots move once on load, preserving ownership, prices, inventory and residents. Edited and player-built properties remain in place; occupied destinations are skipped, and pilots parked on newly occupied lots are placed outside the walls.

## [0.5.1] - 2026-09-30

### Fixed

- The “At home · Go outside” button now accepts clicks that overlap live world updates, allowing residents and guests to leave reliably. Nearby-building and fishing prompts also retain keyboard focus between unchanged updates.
- Focused buttons respond to Space and Enter instead of triggering the horn or chat shortcuts.

## [0.5.0] - 2026-09-30

### Added

- Player-built bed & breakfasts and hotels with three or eight prepaid rooms, configurable hourly rates, food service trading, protected personal pantries, offline meals and durable checkout.
- Eight processing businesses: composting yards, brick kilns, concrete works, furniture workshops, wineries, kitchens, tea blending houses and coffee roasteries. Their materials, professions, input/output recipes and construction costs connect gathering, farming and hospitality.
- Finite woodland, stone, gravel and topsoil gathering grounds, with saved depletion, gradual replenishment and forestry/excavation qualifications.
- Persistent snow accumulation and thaw, wet roads, thunderstorms with lightning, blizzards, and reduced ground-vehicle speed and grip in poor conditions.
- Occupied evening windows with varied bedtimes, all-night street lighting, real light on the ground, and dark countryside that needs headlights. Nearby lighting uses a fixed rendering budget.
- Evergreen, birch and broadleaf groves, varied tree sizes, distinctive guesthouses and industrial building silhouettes.
- Gravel drainage, compost fertilizer and topsoil restoration for farm plots; crop-specific frost and waterlogging responses and downstream uses for all six crops.

### Changed

- Residents left at home keep their chimneys active and consume stored food and drink after logout. Offline ageing and health loss still pause.
- Production shift lengths now follow each business's cycle duration while respecting the world owner's production-speed setting.
- Manual logging and quarry work move to gathering grounds, with tool requirements, cargo checks and persistent completion.

### Security

- Guest pantry contents are visible only in their owner's private snapshot. Other guests and property owners cannot withdraw them; occupied or stocked lodging cannot be demolished.

## [0.4.0] - 2026-09-29

### Added

- Balanced team deathmatch, capture-point and capture-the-flag rounds, protected respawns, ammunition refits, server-timed javelin charges, bouncing grenades, armed mines and optional treasury kill rewards.
- A seven-system galaxy route map, saved jump journeys, ship hangars and upgrades, shared station inventories, courier contracts, surveys, alien-ship discovery unlocks and stranded-pilot rescue.
- Four seasonal farm plots with six crops, planting windows, rain and irrigation, fertilizer, family rotation, frost effects, dated harvests and funded harvest shifts that finish safely after disconnecting.
- Four seasons, moving sunlight, sunrise and sunset, rain, snow, autumn foliage and winter coverage on ground and buildings. Ten-minute days and the 365-day calendar are aligned at default speed.
- Six stone and timber cottage styles, seven garage paint finishes, and chimney smoke driven by online occupants or nearby active workers.
- A detailed player guide, persistence and multiplayer regression coverage, and reproducible seasonal gameplay captures.

### Changed

- Farms produce scheduled crops instead of automatically adding wheat every production cycle. Existing stock is retained; planting and harvest care now determine future output.
- Bound smoke, precipitation and projectile rendering in shared pools; crop visuals update by growth stage without rebuilding the village.

### Fixed

- Prevent fast shots crossing safe-zone boundaries, friendly fire in arena teams, duplicate harvest collection, and repeated match-result rewards.
- Commit station stock and pilot cargo together, preserving both on failed writes and completing saved journeys after reconnecting.

## [0.3.4] - 2026-09-29

### Changed

- Re-proportion tractors around a full-size adult driver: lower and narrower glazing, a compact roof, matching mirrors and exhaust, corrected cockpit eye position and wheel rotation.
- Give buildings distinct metre-scale footprints and silhouettes: cottages, two-storey pubs and banks, awning-front shops, schools, barns, workshops, a mill wheel and a spaceport control tower. Door and window sizes stay consistent between buildings.
- Reduce oversized street lamps, fountain benches, grass and garden hedges; fit planting and fences to building footprints while retaining varied mature trees.

### Fixed

- Match building picking and movement collisions to rotated building volumes instead of one fixed-size box/circle. Pilots caught inside a changed footprint can move toward its edge.

## [0.3.3] - 2026-09-29

### Fixed

- Replace the faceted walking placeholder and blocky cab driver with one original, smoothly shaded human model: shaped face, hair and cap, cloth detail, articulated hands, trousers and boots. The cab driver has a seated pose with arms reaching the steering wheel.
- Animate walking with jointed arms and legs and planted-foot motion driven by displayed travel. Bring the walking camera closer, use human eye height, and hide the local figure in first-person views to prevent face clipping.
- Share character geometry between pilots and keep seated drivers batched into three material draws, with automated geometry, independent-animation, draw-budget and foot-clearance checks. Add reproducible in-game character captures and browser coverage for walking and returning to the tractor.

## [0.3.2] - 2026-09-29

### Fixed

- Smooth driving between server updates using timestamped movement history instead of repeatedly easing toward stationary snapshots. Camera direction, headlights and wheel animation now follow the same displayed motion.
- Remove the artificial 10 FPS software-rendering cap; software and performance modes now target up to 30 FPS, with consistent frame pacing. Actual frame rate still depends on hardware.
- Reset visual motion on large teleports, vehicle changes, world changes and long pauses, and stop at the last known position when updates run out.

## [0.3.1] - 2026-09-29

### Fixed

- Start the Lua execution deadline after the isolated worker has loaded its runtime, with a separate bounded startup deadline, to avoid false script timeouts on busy hosts.
- Pause failing automatic world scripts for 60 seconds after one chat notice. Successful editor reloads allow an immediate retry; stale failures from replaced scripts are discarded.
- Distinguish other pilots from landmarks with compact, rounded PILOT nameplates instead of oversized building-style signs.

## [0.3.0] - 2026-09-29

### Added

- Scenery view: press H to hide the HUD and H or Escape to restore it.
- Optional password sign-in for existing pilots, recovery email verification, expiring single-use password reset links, and sign-out across devices. SMTP is configured by the operator.
- Repeatable load probe with real WebSocket clients in a separate process and disconnect/restart regression coverage.

### Changed

- Rebuilt countryside graphics around original meadow, gravel, limestone and slate textures, softly worn road verges, leafy trees, garden fences, a village fountain, layered clouds and warmer lighting. Cottages have textured gables and industrial annexes.
- Redesigned tractors with glazed cabs, rounded bonnets, detailed grilles, mirrors, wheel hubs and animated chevron-tread tyres. Static bodies and wheels are batched separately.
- Added a detailed graphics setting alongside adaptive and performance modes. Performance mode retains material textures and contact shading; detailed mode retains dynamic shadows. Texture assets respect subpath hosting and are documented with their generation prompts.
- Protocol 2 sends changed world fields and players, shares serialized frames across recipients, and compresses WebSocket traffic. Legacy full-state clients remain supported.
- Disconnected pilots pause hunger, thirst, ageing and property decay. Production, wages, lessons and pending tasks continue, without erasing an absent player's estate.
- SQLite uses full synchronous durability and an indexed normalized pilot-name lookup. Existing saves migrate automatically.

### Fixed

- Replaced connections lose authority immediately, so a stale socket cannot keep playing after sign-in elsewhere or password recovery.
- Unclaimed starter businesses no longer decay out of existence while nobody is playing.

### Security

- Passwords use salted asynchronous scrypt; recovery tokens are stored hashed and expire. Verified email is required for recovery, and password resets revoke existing pilot keys and connections.
- Bounded password hashing, account-request throttling, reset-email cooldowns, connection limits and slow-client disconnection bound resource use.

## [0.2.1] - 2026-09-29

### Added

- Prefix client API, WebSocket, and uploaded-asset URLs with the Vite base so a production build can be mounted under a path such as `/aclone/`.
- Count pilot registrations by `X-Real-IP` when the connection comes from loopback, so a reverse proxy does not share one registration limit across every visitor.

## [0.2.0] - 2026-09-29

### Added

- First public development alpha, with original procedural countryside, tractors, a village and a browser interface.
- Persistent multiplayer worlds with validated input, public and private chat, authority checks, recoverable pilot identities and SQLite backups.
- Building trading, exact currency accounting, taxes, stockrooms, investments, funded production and wages, skills, tasks, construction, survival and home supplies.
- Data-defined vehicle slots, weapons and production chains; Hornball, circuit racing, fishing, robocrows and an original two-player Ultrakricket interpretation.
- Galaxy directory, world creation, local-to-galactic exchange, jump range, ships and station trading.
- Live owner editor for rules, terrain, building placement, zones and isolated Lua scripts, plus original asset uploads.
- GPL-3.0-or-later licensing, contributor guidelines, end-user guide, hosting and recovery instructions, developer documentation, CI and automated tests.
- Player-to-player property listings, persistent vehicle fleets, per-world vehicle physics and editable per-building production recipes.
- Original gameplay screenshots, a source-release packaging script, Docker/Compose deployment and a performance rendering mode.

### Fixed

- Reject invalid trade quantities without changing balances or stock.
- Accept negative sea levels when applying the default world settings.
- Preserve player state when a fishing join request fails validation.
- Run Lua using an isolated worker with the supported TypeScript registration API.
- Separate uploaded world assets from the production client bundle routes.
- Reject fractional cash/count settings and prevent purchasing seeded business capital for profit.

### Security

- Store pilot credentials as hashes, validate world actions and enforce owner authority on server-side edits.
- Save credit conversions and local cash changes atomically, isolate Lua workers, and bound uploads and request rates.

The local 0.1.0 bootstrap was not published. This first public version advances
to 0.2.0 for the implemented multiplayer and editor functionality. It is an alpha;
remaining specification work is documented in docs/STATUS.md.
