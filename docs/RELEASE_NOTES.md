# Release notes

Historical feature summaries moved from the README, followed by upgrade details and validation records. For current behavior use the [player guide](PLAYING.md); for changes by release/date use [CHANGELOG](../CHANGELOG.md). Older descriptions can be superseded (notably offline starvation in 0.15.0, waterworks seeding in 0.21.2 and NPC providers).

## 0.110.0 — A working launch complex and clear respawns

Puddlewick's terminal moves beside the automatic entrance barriers while the pad and rocket remain fixed. The expanded site has a taller razor-wire perimeter, gatehouse, freestanding sign, four industrial buildings, tracking dishes, a crane and heavy transport trucks. Connected concrete yards, a smooth road transition, 18 marked parking bays, containers and service equipment complete the facility. Scenery has collision boundaries; doors and circulation remain clear.

Buildings and farm expansions now respect clear arrival areas around parish respawns, town centres and explicit spawn zones. Puddlewick's Cheese dairy was moved clear of the respawn without changing its ownership, stock or finances.

Validation: all 1,247 unit tests, TypeScript, production build and tracked-file formatting pass. Browser renders exercise the real facility, terrain, lifting gates and launch effects.

Reload after deployment for matching terrain, shop location and collision geometry. The spaceport migration retains the shop identity and business records and defers if someone is housed or working there. The launch pad, rocket and effects retain their coordinates.

## 0.109.3 — Shoreline recovery

A boat already partly overlapping shore can retreat toward deeper water instead of having every reverse attempt blocked. Each step must reduce the overlap without introducing new ground contact; boats still cannot climb onto land or cross a dry ridge. Normal shore impacts retain minor damage, recoil and throttle cut-off. The engine remains running unless switched off separately.

Validation: all 1,238 unit tests and TypeScript pass, including recovery for all six boat types, falling water, grounded bows and sterns, normal impacts, land barriers and matching client/server movement. Reload after deployment.

## 0.109.2 — Browser regression coverage

Registration and reconnect checks now verify that the town teleport is absent and that a stopped player's saved position survives a reload. Vessel checks verify the new 24.5 m trawler with human-sized crew and a clear helm view. Map keyboard navigation is checked in world coordinates rather than backing-sheet scroll pixels. Phone screenshot capture allows more time on software graphics; the two-player social test warms both renderers at small viewports before testing the full desktop and phone layouts. This changes test coverage only; gameplay remains as described below.

## 0.109.1 — Aviation pavement and regression checks

The rescue and haulage release ships with this final correction: removing runways from public-road routing must not remove their cleared surface or paved traction. Runways and hangar aprons now retain both. Browser checks use current HUD menus and navigation lights, verify the relocated spaceport through the directory, and rotate aircraft at flying speed during the takeoff test.

## 0.109.0 — Rescue boats and working trailers

The new 140s coastal tug handles agreed rescue fees, escrow and real towlines. The 24s outboard is a quick 50-cargo boat that can be rowed with an empty tank, fish with a rod and return as a towed tender after a fuel delivery. The canal boat now costs 60s; the trawler's hull grows to 24.5 m for its three-week game-time voyages without enlarging the crew.

Seven specialist trailers make hauling a separate investment, with compatible goods, farm-capacity checks, visible loads, persistence, articulation and collisions. Walking has a hand-held flashlight, the lifeboat carries 10 weight, and unpowered travel has no engine controls. Tractor camera zoom extends twice as far. The free town teleport is removed.

New roads prefer gentler slopes and subtle bends, can plan long lighthouse routes, and reconnect around runways. Growth remains gradual. The spaceport moves back to about 1.25 km from town through an idempotent property-preserving migration.

Reload after deployment. Existing boats, tanks, goods, property and player positions are preserved; no grants or player resets are part of this release. See [the haulage guide](HAULAGE.md) for controls, prices, calculations and modeling references.

Validation: 1,230 unit tests, TypeScript, the production build and responsive website checks pass. A recorded browser walkthrough covers trailer purchase/loading/driving/unhitching, empty-tank rowing, the tug cockpit, motorboat recovery and tender attachment, self-recovery towing and walking controls. A local copy of Puddlewick completes both cape lighthouse road connections and passes the property-preserving spaceport migration; production roads still grow at their normal rate.

## 0.108.0 — Remote launches and smoother storm water

Puddlewick's existing spaceport moves away from homes to a vacant remote site with an access road, graded apron and chain-link fence. A one-kilometre reservation prevents new buildings, farm plots and pastures encroaching on the launch site. Its stock, finances and identity remain intact. This is a game layout choice, not a real-world safety certification.

Launches produce a continuous white-hot exhaust column up to 320 metres long, orange downwash and large rolling clouds. Landing exhaust is smaller and only raises dust when it reaches the ground. Emergency lifeboats now have inflatable tubes, a shelter hood, grab ropes, reflective strips, animated oars and an automatic red-orange flare instead of headlights.

Ocean animation retains precision in old worlds, the near-boat surface remains stable when moving, and depth surveys are spread across frames to reduce storm travel hitches. Wave strength and boating economics are unchanged.

Validation includes 1,203 passing unit tests, TypeScript, a production build, browser launch/landing and raft checks, and a 46-second recording using production models. Reload after deployment. See [spaceport references and preview instructions](SPACEPORT.md).

## 0.107.0 — Clearer views and deeper water

The desktop HUD is smaller and adapts to laptop screens. Employment is in the player sidebar. Use **HUD ⚙** or **F9 → HUD & layout** to save separate visibility choices for nine panels. H keeps its whole-screen scenery shortcut; Enter restores hidden chat. Phone drawers remain available.

Lighthouses show a dim navigation point and a brighter rotating flash without lighting the sea or town. A lightweight island mesh supports distant buildings and preserves hills beyond the detailed terrain radius. Land and lights use a geographic horizon, with clear-weather lighthouse range capped at 30 km and shorter visibility in poor weather. Returning from a background window resets camera and motion interpolation and presents the latest state.

Puddlewick receives eight additional mixed-resource regions, 48 woodland gathering sites and three stone deposits near each of its 15 coastal bluffs: 221 new sites in the checked public-world layout. Existing sites and saved depletion remain intact.

Fishing boats gain a live depth readout in the wheelhouse and compact HUD. The bay, offshore shelf, basins and trenches replace the largely flat submerged terrain; custom heightmaps and shore approaches remain intact. Puddlewick Bay is labelled and deeper ocean is darker on the map. Depth changes catch rates by at most four percent either way; voyage luck and shoals still dominate, and fuel, cargo and prices are unchanged.

Reload clients after deploying both server and website. The resource survey is a one-time saved addition; keep the normal pre-deploy backup. No player grants or resets are included.

Validation: all 1,189 unit tests, TypeScript, tracked-file formatting and the production build pass. Browser checks cover independent saved HUD panels at 1024×600, 1366×768 and 1440×900, mobile controls/drawers, 1 km and 30 km lighthouse flashes, supporting coastal terrain, the wheelhouse depth instrument, bay/resource map rendering, camera resume and a throttled network link. Website checks pass at four screen widths. These software-rendered checks verify behavior and layout, not real-device frame rates.

## 0.106.0 — Map symbols, distance scale and closer inspection

Each of the 50 building types has a dedicated map symbol. Aircraft hangars use an aircraft icon, spaceports use a rocket, and livestock, manufacturing, food and service buildings have their own recognizable symbols. Gathering grounds and sports landmarks also have specific symbols.

The parish map now includes a distance scale that follows zoom, showing metres locally and kilometres at wider views. Maximum zoom increases from 300% to 500%. Above 350%, visible building and resource names appear automatically beneath their icons, with compact wrapping labels.

Reload the game to receive the map improvements. No world data migration or balance changes are required. Map unit tests, desktop/mobile browser navigation, scale accuracy, close-up labels and the 500% limit have been verified. The full 1,174-test unit suite and three additional icon tests passed. The extended three-load waypoint browser test passed its map interactions but exceeded its five-minute deadline during the final reload under software rendering; that broader check remains unverified to completion.

## 0.105.0 — Living pastures, clearer maps and vehicle configuration

Livestock farms now have fenced, terrain-following pastures with animals walking, turning and grazing. Owners can purchase up to three adjoining parcels and buy or breed animals up to the resulting capacity. Larger herds increase production, feed and water use, and staffing requirements. Existing animals are preserved; if a crowded farm cannot fit a safe pasture, it keeps its base production but cannot add animals until space is available.

Parish maps use building-type icons, reveal names on hover or keyboard focus, and show names automatically when zoomed in with room to spare. Zoom and live updates preserve the area being explored; Find me remains an explicit return to your character.

World owners can configure all 32 vehicle slots through F10 → Vehicles, including movement, handling, fuel, cargo, pricing, passengers, paid crew, fishing, provisions, death/recovery, tracks, cockpit instruments, lamp lenses and Workshop model components. Custom slots 9–24 are available for new designs. Existing settings remain the defaults; portable world designs include the overrides and uploaded asset references. See the [world-building guide](WORLD_BUILDING_GUIDE.md).

Deploy client and server together and reload. Pastures are allocated safely as worlds advance; no reset or manual migration is required. Preserve the pre-deploy backup if rolling back, because older versions do not understand pasture expansion or the extended vehicle configuration.

Validation: all 1,173 unit tests passed, along with targeted browser checks for pasture management and rendering, vehicle editing and cockpit instruments, desktop/mobile map navigation, and airfield takeoff/crash handling. The production build, tracked-file formatting check and public website checks passed. A read-only dry run against Puddlewick found safe pasture locations for both existing livestock farms without changing their stock.

## 0.104.0 — Charter fishing trips and synchronized headlights

The Coastal Belle is a separate 120s passenger fishing boat with six guest places, a 600-weight captain's hold and a 192-unit tank. Its enclosed helm includes a live compass, gauges and persistent W/S throttle; B idles. Deck seating, rod racks, a bait station and switchable cabin/deck lights complete the boat. The canal boat keeps its exposed stern tiller.

At a dock, use **Inventory → Boating** to offer a fare and a 15–180 real-minute trip, including travel. Passengers accept on shore, bring their own tackle, food and water, and keep their fish. Stop to let them cast. Fares stay in saved escrow until return; early returns refund unused time, while cancellation or return to another dock refunds the whole fare. Existing world boat-death rules apply and affected bookings are refunded. See [charter guide](CHARTER_BOAT.md).

Tractor lamp faces now follow their driver's switch instead of glowing permanently. Up to two nearby other vehicles cast headlight beams, without dynamic shadows. Each player's switch is independent.

Reload after deployment. No world reset or manual migration is needed. Validation includes the full 1,153-test suite, final charter regressions, four browser checks, a production build and formatting checks.

## 0.103.0 — Canal-boat lights and quieter fishing controls

The canal boat keeps its exposed stern tiller and standing skipper, with new rod racks, seating, fenders and lighting. Automatic red/green sidelights, white masthead/stern lights and a moored white light improve visibility. The Lights menu offers deck floods, warm or dim-red cabin lighting, and the existing searchlight. Window illumination uses a texture mask; boats share a bounded pool of three work lights.

Boathouses now list Fishing tackle for rod fishing. The public Puddlewick boatyard buys a small replenishing shelf from its own till. Existing custom prices and paused listings are preserved; privately owned yards arrange their own supplies.

Press **H** while rod fishing for a clear view with one small bottom-centred button. While waiting it stops fishing; when a fish bites it becomes **Reel in**. **F3** remains available, and **H/Escape** restores the HUD. Bite timing is unchanged: deep water waits 150–300 seconds, coastal boat fishing 40–90 seconds, with eight seconds to reel after a bite.

Reload after deployment. The separate charter boat and paid passenger-trip system remain planned work and are not included in this release.

## 0.102.0 — Business controls and quieter lighthouses

Business owners can use default bulk discounts (100 items at 1%, 250 at 2%, 500 at 3%), customize up to five levels, or turn discounts off. Buyers see the discount and final total before purchasing. Supplier bids and owner stock transfers are unchanged. Public import/export outlets do not inherit default discounts.

Loan information stays accessible beneath your cash display and through **F9 → Loans & repayments**, including insufficient funding, arrears and time until default or foreclosure. At the bank, choose savings, carried cash, or savings followed by cash for automatic payments. Existing loans keep their payment source. Business tills are not used for personal repayments.

Farm owners can choose which crops staff may plant, set a daily seed/fertilizer cash budget, and protect a till reserve. Both human and NPC employees obey these rules; existing crops remain harvestable. Old farms remain unrestricted until configured. The daily budget resets every ten real minutes, and does not include wages or stored supplies.

Lighthouses no longer flood inland buildings with their rotating sweep. Local seaward illumination is softer; the separate horizon-limited offshore beacon retains its existing range.

Reload after deployment. No world reset or manual data migration is required. Validation: 1,138 unit tests, seven browser checks covering the new controls and existing menus, and a production build.

## 0.101.1 — Smoother countryside loading

Driving into new scenery no longer prepares entire terrain tiles and woodland snow drifts in one uninterrupted operation. Preparation runs in small batches across frames, and existing terrain stays visible until its replacement is ready. Snow coverage checks nearby roads rather than scanning the entire road network for every sample. Terrain detail and snow shapes are preserved.

Reload the game after deployment. This targets scenery-loading freezes; it does not guarantee a particular frame rate on every device. No world reset, data migration or gameplay balance change is needed.

## 0.101.0 — Rocky headlands and coastal navigation

Puddlewick’s harbour light has moved out of the town bustle, roughly as far away as Mabel’s Reach. All three public lights stand above the water on rocky bluffs, with twelve additional headlands around the island. Cliff edges stop people and tractors safely. You can build a lighthouse on a suitable flat cliff-top site.

Watch for lighthouse flashes offshore as the rotating light faces you. In clear weather the shaft disappears; misty rain and storms reveal it while reducing the range. Hills block the signal, and the maximum clear-weather range is about 30 km, depending on height. Beach waves roll over and wash up the shore, while cliff impacts throw up sheets of water and falling spray. Calm days remain calm.

The update preserves existing lighthouse ownership, jobs and provisions and checks neighbouring property before reshaping the coast. Headlands are included in world-design exports.

## 0.100.0 — Bulk shop sales and shoreline collisions

Shop rows show the quantity in your inventory and update it while you trade. **Sell all** sells the carried stack; **Sell max** shows a smaller quantity when the buyer is short of working capital or storage, or the transaction limit applies. Unsold items stay in your inventory. Manual quantity controls and confirmed trade totals continue working as before.

Boats now check the shoreline along their movement path, including the bow and stern, against the current tide. A collision stops propulsion, cuts throttle and recoils into clear water; powered boats lose just one percentage point of hull condition. Holding the same throttle key cannot cause repeated impacts. Release it or reverse to move again. No cargo, fuel or existing vessels are removed by this update.

## 0.99.1 — Public lighthouse placement

The lighthouse migration recognizes public Puddlewick after its administration has transferred to a player account. Restarting retries the three safe coastal sites; no player property is moved and custom worlds are not seeded.

## 0.99.0 — Tides, swells and coastal lighthouses

Boats rise, pitch and roll over weather-driven swells. Meeting steep waves at
speed produces extra resistance and bow spray; wheelhouse views follow the hull.
Calm spells can be nearly flat, while storms bring whitecaps and shoreline surf.
Trailing nets remain in the water independently of the pitching boat. Shallow
gear stays visible while deep objects fade into the ocean colour.

Tides follow the game's moon cycle, with two highs per lunar day and larger
ranges around new and full moons. Puddlewick enables a 0.6-metre maximum spring
range once; other worlds retain zero tides until their owners opt in. Floating
jetties, dock access, fishing depth and maps account for changing water levels.
New shoreline construction checks tidal extremes. The editor exposes tidal range
and wave strength independently.

Three lighthouses mark the outer headlands and harbour. Each has a rotating navigation beam, five architectural choices and keeper accommodation. One unqualified employee can live there without buying property, including an owner who takes the vacant keeper job. Private pantry supplies remain collectible after leaving. A small navigation grant provides 4d per game day to a private owner's working capital and funds a keeper wage capped at 8d before normal taxes. Larger buildings never add jobs or grants.

Reload after updating. Existing catches, fuel, vessels and property are preserved.
This is a lightweight wave and buoyancy approximation; it does not introduce
flooding, sinking, tidal currents or vessel damage from waves.

Validation: unit/integration tests, lighthouse employment and placement regressions, production
builds, actual-renderer optical-depth/net/camera checks, and calm/storm/cockpit/surf
preview review. See [boating](BOATING.md#ocean-weather-and-tides) for details.

## 0.98.0 — Complete trawl rigs and clearer underwater views

Commercial trawlers now tow a complete net with its wide mouth facing the boat,
a tapered belly and a closed catch bag. Spreading boards, towing cables, floats
and a weighted footrope complete the gear. Retrieval lifts and drains the bag,
pours fish onto the deck and winds the gear away. These animations use bounded
geometry and instanced details; fishing rewards and hauling timing are unchanged.

Water becomes more transparent when viewed from above so submerged gear remains
visible, while the horizon stays opaque-looking. Full nets and holds trigger an
explicit alert and retain a highlighted status even with fishing controls
collapsed. Compass headings remain valid after repeated turns. Catch quantities
remain hidden until hauling.

Reload after updating. No world reset or migration is needed. Validation includes
1,097 passing tests, TypeScript, production builds, focused trawl and wheelhouse
browser checks, and visual inspection of towing and the complete hauling sequence.

## 0.97.0 — Topographic maps and smooth coastlines

The parish map can show hills and valleys with contours every 10 metres above
sea level, stronger lines every 50 metres and elevation labels. The **Contours**
button toggles the overlay and remembers the preference in this browser. Roads,
towns, buildings and waypoints remain visible above the terrain overlay.

The parish map and minimap interpolate shoreline crossings instead of enlarging
square water cells. The main map also refreshes when an editor changes terrain
or sea level. These are map-display changes: the island, driving behaviour and
saved progress are unchanged. Reload the game after deployment.

Validation covers shoreline interpolation, contour heights, shared terrain samples,
island/lake rendering, antialiasing, zoom, toggle persistence, terrain redraws and
mobile layout, plus TypeScript and the production build.

## 0.96.4 — Worksite escape and fishing status

Tractors caught between overlapping building walls and equipment yards can drive
out again. Collision checks measure distance to the exterior of the combined
footprint, while continuing to prevent entry into buildings and neighbouring walls.

Fishing controls distinguish stopped towing with a retained, visible net from
empty stowed nets. Collapsed and expanded controls agree about fishing status.
Refuelling does not restart towing: choose **Deploy / resume nets**, or haul the
catch aboard. Catch quantities remain hidden until hauling.

Deploy client and server together, then reload. No world reset or migration is
needed; existing property, catches and fuel are preserved. Validation includes
1,091 passing tests, TypeScript, the production build and responsive website checks.

## 0.96.3 — Smoother driving

Server updates now reconcile positions at the same instant, eliminating artificial
pullbacks when updates arrive between rendered frames. This is especially noticeable
in fast tractors. Frame scheduling also tolerates small display-timing variations
without skipping a whole frame unnecessarily, while keeping the 30/60 FPS limits.

Reload the game after deployment. No world migration or handling changes are needed.
Validation includes 1,084 passing tests, the production build and a browser test
covering movement, stopping and chat over a delayed, bandwidth-limited connection.
These timing fixes do not remove frame drops caused by overloaded graphics hardware.

## 0.96.2 — NPC business continuity

NPC shops retain raw-material buffers alongside ordinary finished goods and can
restore missing or zero buying offers from known suppliers. Delivery bids allow
for transport costs and a margin, while explicit agreed purchasing pauses remain
respected. Direct restocking can use input capital without draining household
money, other supplies, payroll or investor claims.

Business owners return sooner to check operations, fund useful vacancies and
make bounded competitive wage offers. Qualified owners can renew their unpaid
shifts; training keeps its intended workplace goal. Costed business purchases,
construction and expansion can withdraw the needed surplus or savings as part of
the same plan, with reserves checked again before the withdrawal executes.

No world reset or manual migration is needed. Validation includes 1,074 passing
tests and a 48-hour mechanical supply/production/payroll simulation with scripted
customers and hauliers. This verifies the repaired mechanics; sustained autonomous
NPC prosperity still needs assessment during live play.

## 0.96.1 — Boatyard boarding and readable fishing controls

Buy or board an owned boat from dry land within 40 metres of a boathouse, matching
the building menu's interaction range. Fishing-pier boarding and waterfront
disembarking retain their existing ranges.

The fishing controls now sit above the driving readout. Collapsing or expanding
them no longer covers speed, engine, ping or FPS information on desktop or mobile.
Reload the game after deployment to load both fixes.

## 0.96.0 — Boat lighting, recovery and automatic provisions

Fishing boats now show steady navigation sectors and green-over-white trawling
signals. Deck floods, cabin lighting (warm or dim red) and the searchlight have
separate controls. The fishing controls collapse into a corner status strip;
the chase camera stays above water even after orbit smoothing.

**Puddlewick now removes all owned boats and their contents on death.** Stored and
moored boats are included. This applies to future deaths; installing the update
does not remove any existing boats. Running out of fuel still allows rescue.

World builders can instead choose offshore recovery, a configurable cargo expiry
(five game days by default; zero disables it), and tank-fuel retention. Cargo,
provisions and unhauled catch remain recoverable until expiry. Owners can row
back or hitch a recovery ride on another player's canal boat or trawler, then
transfer directly to their vessel while stopped alongside. This is a passenger
ride, not a deckhand employment contract.

At home, a provisions indicator estimates real time until either food or drink
runs out using the actual automatic meal rules, without adding time to death.
It also handles private guest-room supplies, eligible inventory and the end of a booking.

Puddlewick now eats and drinks automatically from inventory and the selected home
or active private room while away, online or offline. Homeless players can rely
on carried supplies. Being indoors gives 20% slower hunger/thirst growth. World
owners independently control inventory feeding, remote-home feeding and the
indoor multiplier in the Rules editor. Other worlds retain their previous rules;
the once-only Puddlewick migration preserves later owner changes.

The editor, new-world form, rules summary and world-building guides explain the
choices. Recoveries survive saving and offline catch-up; world pauses stop their
spoilage clock. The Puddlewick rule migration runs once and preserves later edits.

## 0.95.0 — Offshore expeditions and a working wheelhouse

The North Star now supports long fishing expeditions: a 3,200-unit tank and
3,200-weight hold allow 21 Puddlewick days of towing plus the journey home.
Catches arrive continuously, with fish activity visible in the nets; haul whenever
you choose to discover the catch. Weathering a poor trip remains a real economic
risk. Hire up to two consenting deckhands for shares of realised profit and stock
food and water for the voyage. Crew eat automatically; online captains eat manually.

The furnished wheelhouse includes a mounted compass, live marine instruments,
moving throttle lever, chart desk and readable night instruments. Fuel and cargo
weight affect performance. Puddlewick gains more navigable ocean while retaining
its island and properties. Boatyard arrivals now accept a wider waterfront area,
and water renders correctly far offshore.

New North Stars cost 300s; canal boats cost 24s. Existing owners retain their boats
and fuel. Reload after deployment. See [Boating](BOATING.md) for controls and costs
and [upgrade instructions](RELEASING.md#upgrade-0950) for the one-time world update.

## 0.93.2 — Clear gravel in the town square

The circular gravel square now behaves as road, matching its appearance. Tractors
keep road traction across it, and snow cover, drifts and tyre tracks stay off its
clear surface. Snow on the surrounding ground is unchanged. Reload after deployment.

## 0.93.1 — Seated camera and hangar lettering

Tractor cockpit views follow the vehicle’s pitch and roll on hills. Mouse look
remains relative to the cab; chase and overhead views keep their normal orientation.
The Flying Club sign now measures its lettering and leaves room at both edges,
preventing the first and last letters from being clipped. Reload to receive both fixes.

## 0.93.0 — Puddlewick flying club

Drive to the new airfield hangar on Puddlewick’s western outskirts to buy or board
a biplane. The level north/south runway has threshold markings, centre dashes,
runway numbers and edge reflectors. The hangar sells fuel and offers aircraft
service and paint. Board while stopped; wait if another pilot occupies the apron,
then start the engine with F4 and taxi to the runway.

Crashes now produce fire, sparks and rising smoke visible to nearby players.
Only the plane being flown is destroyed. Spare airframes remain yours; the next
hangar visit commissions one with a fresh service record and an empty tank.

Existing property and town boundaries are preserved. Public gathering spots
obstructing the strip move nearby without resetting depletion. New buildings and
farm plots cannot cover the runway or apron. No world reset is needed.

## 0.92.0 — More natural people

People have a single smooth body mesh, with textured workwear and facial detail.
Walking and running use retargeted human motion capture: weight shifts, heel lift,
shoulder movement and overlapping arm motion replace the mechanical gait. Feet
stay planted during the loaded part of each step, transitions blend with stopping
and reversing, and the same body is used for seated drivers. The model stays at
one material draw. The [art guide](ART.md#human-figures) credits the motion source
and explains how to reproduce the model and previews.

Biplane keyboard pitch now follows flight-stick convention: **Down pulls the nose
up; Up pushes it down**. Touch labels and controller pitch axes are unchanged.
Landing regression coverage now includes a complete takeoff, approach and stop
with delayed discrete inputs.

Reload the browser after deployment. No world reset, account migration or change
to movement speeds is needed.

## 0.90.0 — Marsh Courier hovercraft

The hovercraft now has its own utility-craft design: a rounded rubber skirt,
forward cabin, cargo lockers, non-slip deck and a large guarded rear fan. The fan
turns with the engine, the cockpit shows speed and fuel, and garage paint colours
the hull and cabin. Textures provide rubber folds, seams and small details.
Existing performance, ownership and operating costs stay the same.

## 0.89.0 — A proper parish mail plane

The biplane now has a tapered fuselage, fabric-covered shaped wings, bracing wires,
landing gear and a wooden propeller that spins with the engine. Its open cockpit
has working airspeed, height-above-ground and fuel instruments. Garage paint
colours the aircraft, while fabric seams, markings and engine detail use textures
to keep the model lightweight. Flight performance and purchase terms are unchanged.

## 0.88.0 — Six tractors, six ways to make a living

Garages now offer five specialist tractors alongside the familiar Puddle tractor:
Orchard Wren for tight spaces, Swift Kestrel for express deliveries, Barley Dray
for bulk loads, Fenlander for difficult ground, and Lamplighter for long journeys
and night work. Each trades strengths against cargo, speed, fuel use or handling;
there is no single upgrade that wins at everything.

Compare their actual 3D models and specifications before buying. Every owned
machine keeps its own paint and fuel tank. New purchases start empty; unload
cargo before switching to a smaller vehicle. Returning from walking recalls your
selected owned tractor. The starter now uses less fuel.

Cockpits have rounded dashboard housings, textured interiors, correctly tilted
steering wheels and working speed, fuel, condition and distance instruments.
Instruments illuminate with the lights. Detail stays lightweight and only the
local visible cockpit updates its gauge texture. This release also corrects the
creator-preview and restored-council browser checks.

See the [tractor guide](TRACTORS.md) for specifications and trade-offs. Reload to
load the new models; no world reset is required.

## 0.86.0 — Hillside towns and connecting roads

Remote towns gain roads gradually from both ends. Roads detour around buildings
and all farm plots, preserving junctions and retiring blocked stretches once the
bypass is complete. Crews share a 12 m per game-day budget and resume after restarts.

Fountains and benches meet hillside terrain, tractors tilt with the ground, and
distant villages retain terrain beneath them. Lighter ordinary-weather haze makes
the spaceport and neighbouring settlements easier to see; storms still limit visibility.

## 0.85.4 — Cleaner snow edges and thaw

Roadside snow no longer draws dark jagged outlines. Banks conform to the ground
beneath them, and banks, roof caps and fence caps fade as the surrounding snow
melts instead of leaving solid white rectangles. Snow depths, snowfall, melting
rates and driving rules are unchanged. Reload the game to see the corrections.

## 0.85.3 — Snow with visible depth

Snow now builds up as physical layers on roofs, beside cleared roads and around
foundations, tree trunks and fences. Roof edges reveal the thickness; shallow
snow stays shallow and heavier packs grow gradually. Tyre channels have shaded
walls and tread relief, follow the raised surfaces and remain continuous when
frames or movement snapshots arrive slowly. Extra detail is batched, hidden
when snow is gone, and works in Performance mode. Snowfall rates and driving
rules are unchanged; no world reset is needed.

## 0.85.2 — Graphics fallback and startup pacing

Adaptive graphics now reacts to sustained poor frame rates instead of waiting
until roughly 5 FPS. It reduces lights and resolution in stages, ignoring hidden
tabs and isolated stalls. Performance mode's 30 FPS cap remains active after
startup. The loading screen offers a simpler-graphics reload, and reports when
the view still cannot settle smoothly. No world reset is required.

## 0.85.1 — Smaller downloads and repeat visits

Production builds precompress client files with Brotli and gzip. Hashed assets
receive long-lived caching, while HTML and mutable files revalidate. Existing
builds without sidecars remain supported. This reduces download work; it does
not change gameplay or promise higher rendering FPS.

## 0.85.0 — Shallow winters and visible snow depth

Natural snowpacks over six inches are exceptional. Sunny daylight removes excess
snow at 6 cm per fully sunny day; the winter base remains until spring. Snow
raises the existing terrain mesh, buries low plants and tyre bottoms, and carries
tracks and contact shadows without adding terrain draw calls. Roads stay exposed.
Old excessive natural packs receive a one-time adjustment; see [upgrade details](RELEASING.md#upgrade-0850).

## 0.84.0 — NPC financial understanding and follow-through

Residents distinguish business cash from stock, reserves, investor claims and past
cash flow, with explicit currency units and calculated transport margins. Their chat
and gameplay use the same facts. Agreed owner withdrawals and price changes now have
executable steps and saved receipts; an agreed purchase pause stays paused. Housed
owners can consider freeing capital for opportunities beyond a preset farm budget.

No reset or balance adjustment is required. Recent cash-flow history collects from
new transactions. Existing accounts do not receive invented historical figures.
Long-term autonomous prosperity still needs live observation.

## 0.82.0 — Business management and calmer chat

Owners can withdraw property listings, set paid-job limits and dismiss workers.
Production estimates compare batch and hourly margins separately from recorded
cash flow. NPC owners use the same staffing calculations, and financial chat uses
explicit ownership and units. Owners retain stock/price/tax information on Main.
Enter starts chat and keeps focus after sending; natural dismissals cost no model
call, and incidental “all…” sentences no longer invite a group reply.

No reset is required. New hiring defaults apply when no explicit limit exists;
existing rosters remain until dismissed. Human-owned prices and wages are unchanged.

## 0.81.0 — Safer trading and visible taxes

Pause each buying or selling offer without losing its price. Trades reject stale
quotes and NPC businesses pause deliveries instead of accepting them for 0d.
Buying prices have a 1d minimum. The public Taxes & rates page and shop totals
explain included sales taxes; NPC chat receives the same live rules. Duplicate
NPC home acquisition is blocked, and chat scrolling moves smoothly with overlap
between pages. See [upgrade instructions](RELEASING.md#current-upgrade-0810).

## 0.78.0 — Player controls and creator-world features

Responsive driving prediction, controller menus, first-step guidance and repeat
gathering make everyday play easier. Business reports separate cash earnings from
funding and expose supply bottlenecks. New buildings gain slope-aware foundations.
Creators can add checkpoint courses, funded prizes and build/peace/war phases;
optional commercial leases, auctions and maintenance controls give hosts more
choices. Existing worlds keep their property, prices and balances.

See [upgrade instructions](RELEASING.md#current-upgrade-0780) and the
[validation record](FIDELITY_PLAN.md). Startup speedup and long-term autonomous
NPC prosperity remain unproven; no ATM importer or new space-mining economy is
included.

## Upgrading to 0.36.0

Back up the database and assets, then use the usual pull/build/restart procedure. Vehicle records initialize lazily; existing condition is not guessed from character age. New rules retain unrestricted Puddlewick maps and basic driving. The upgrade adds missing map quotes only to treasury-run public outlets, preserving private prices and inventories; existing garages can print maps and accept carried Steel for service. No world reset is needed.

## Feature history

**New in 0.59.2:** Scheduled AI neighbours stay busy while visiting: they haul, gather or work public labour toward a cottage and a shop. Mabel may still sit.

**New in 0.59.1:** Chase camera drag tilts up and down the same way first person does.

**New in 0.59.0:** Gathering uses a chainsaw for timber, a pickaxe for stone and a shovel for gravel or topsoil. Workshop tools stay a furniture part.

**New in 0.58.1:** AI neighbours remount a fueled tractor and buy fuel when the tank is low instead of walking the parish.

**New in 0.58.0:** AI neighbours invent founding, bid and haul steps from the recipe graph so missing producers and unposted input bids become ordinary choices. They skip a neighbour who is already founding the same building kind, and they can score a shop from catalogue wholesale when the next buyer has not posted a bid yet.

**New in 0.57.0:** NPC choice catalogues run off the driving tick, one resident at a time, so planning no longer stalls physics. Tractor snow and mud prints keep spacing per vehicle. Government necessities keep bread, water and fuel on the shelf. AI neighbours honour jobs they already hold, keep shop memories for a day, and a working-capital loan offer can no longer crash the parish process.

**New in 0.56.0:** neighbours can fund a business till they do not own and later collect a capped return from earnings only. AI residents invent live market experiments, remount fueled tractors, and withdraw operating cash from their own shops when personal money is too low. Tractors leave fading tracks in snow and mud.

**New in 0.24.0:** player-to-player cash gifts and roadside refuelling, with independent world-owner controls. See [helping other players](PLAYING.md#helping-other-players).

**Fixed in 0.23.1:** NPCs distinguish their current qualifications from school courses and old-life memories. Clarified training agreements replace blocked job requests, and outdated replies are discarded after character-state changes. See [current character facts](NPCS.md#current-character-facts-and-retraining) and [upgrade instructions](#deploying-0231).

**New in 0.23.0:** natural gathering grounds replace the rows of resource piles: woodland clearings, chipped boulders, gravel hollows and exposed soil banks, placed away from town buildings and roads. Existing reserves and gathering tasks survive the move. See [screenshots and art details](ART.md#natural-gathering-grounds).

**New in 0.22.0:** channel-scoped relationship memory, learned gameplay preferences, natural replies to validated agreements, and fewer redundant planning calls. Player conversations receive scheduling priority; ordinary chat remains one call and agreements use at most one additional wording call within the same budget. See [NPC continuity and conversation](NPCS.md#continuity-and-conversation-0220).

**Fixed in 0.21.3:** NPC agreement replies use in-character language, with clear task status and no references to separate AI providers. See [upgrade instructions](#deploying-0213).

**Fixed in 0.21.1:** NPCs can queue a concrete request to learn a workplace’s skill and take its job, with verified training/employment progress. Ready agreements take priority over optional errands, and chat distinguishes a queued request from actual action. See [NPC agreements](NPCS.md#agreements-made-in-chat).

**Fixed in 0.21.2:** Puddlewick returns to its intended starter roster, keeping the stonemason and shoreline waterworks. Excess automatic additions and the public council are removed once where still public or unowned; purchased and custom-built businesses are preserved. All building types remain available for later player construction. See [Puddlewick services](PLAYING.md#puddlewick-services) for operation and [upgrade instructions](#deploying-0212).

**New in 0.20.0:** a world creator studio with custom models, interactive objects, visual behavior rules, arena configuration, production editing and reusable designs; plus opt-in travel between self-hosted galaxies. See [World building](WORLD_BUILDING.md) and [Connecting galaxies](GALAXIES.md) for usage, hosting and explicit limits. See [upgrade instructions](#deploying-0200).

**Fixed in 0.19.3:** gathering, labour and other timed tasks show a large countdown in the center of the screen, separate from chat, on desktop and mobile. See [task progress](PLAYING.md#timed-tasks) and [upgrade instructions](#deploying-0193).

**Fixed in 0.19.2:** Jev receives clearer survival deadlines, food choices, job economics and outcome feedback. NPCs can buy and eat in one errand, preserve personal provisions and deliver inputs to their own businesses. See [decision guidance and limits](NPCS.md#survival-and-economic-decisions-0192).

**Fixed in 0.19.1:** nearby gathering grounds now show a direct Gather button, available reserves, progress and explanations for blocked gathering. No Resources menu is needed. See [gathering resources](PLAYING.md#gathering-resources) and [upgrade instructions](#deploying-0191).

**New in 0.19.0:** a full-scale industrial cargo rocket replaces the retro spaceport model, and robocrows gain detailed mechanical wings, sensors and rotating lift fans. See the [rocket scale comparison](ART.md#industrial-spaceport-0190) and [robocrow preview](ART.md#industrial-robocrows-0190).

**Also in 0.19.0:** drive onto the fishing dock, click it or press E/Ctrl, and use the centered Cast a line, Reel in and Stop fishing buttons without opening Activities. See [fishing at the dock](PLAYING.md#fishing-at-the-dock) and [upgrade instructions](#deploying-0190).

**New in 0.18.0:** a distinctive spaceport rocket and marked landing pad, with metal terminal cladding and illuminated apron markers. See the [art guide and screenshots](ART.md#spaceport-apron-0180) and [upgrade instructions](#deploying-0180).

**Fixed in 0.17.1:** fishing has a centered Reel in button that highlights when a fish bites, and buildings display their owner's name even when the owner is offline. See [upgrade instructions](#deploying-0171).

**New in 0.17.0:** a compact mobile HUD, two-thumb driving, touch camera gestures and keyboard-aware chat/menu sheets. All game menus remain accessible on phones and tablets; full-size desktop controls retain their layout. See the [mobile guide](MOBILE.md) and [upgrade instructions](#deploying-0170).

**New in 0.16.0:** shoreline-only waterworks produce local water from fuel, with a new pump operator skill, shoreline checks for players and NPCs, and profitable local delivery prices. See [building and operating waterworks](PLAYING.md#water-supply) and [upgrade instructions](#deploying-0160).

**Fixed in 0.15.3:** local supply-chain prices now support profitable production and haulage, with less attractive import/export fallbacks. Existing public and unowned businesses migrate once; every player-owned price is preserved. NPC delivery promises are checked against live stock ownership and buyer terms. See [pricing and limits](ECONOMY.md#default-trade-prices-0160) and [upgrade instructions](#deploying-0153).

**Fixed in 0.15.2:** repeated trades keep list scroll position; gameplay forms remember edited amounts and choices across actions and reopened dialogs during the browser session.

**Fixed in 0.15.1:** NPC chat responds independently of gameplay planning failures. Jev context is bounded to avoid oversized requests while retaining every candidate action.

**New in 0.15.0:** fifteen more AI neighbours, varied playing habits, stocked-home departure routines and chat-to-Jev delivery agreements. Offline starvation now applies to everyone. Building prices and wages show their saved values, residents stay visible during AI retries, public conversations support follow-ups, chat scrolling works, and replies allow 1,200 characters. [Enable the population and review survival rules](NPCS.md).

**New in 0.14.0:** all four AI neighbours share an adaptive Jev gameplay planner, including new resident **Elias Vale**. Mabel retains OpenAI conversation; the others use Claude. Chat models run only for addressed human messages, with duplicate prevention and bounded retries. Existing identities, memories and shared spending caps are preserved. See [setup and behavior](NPCS.md).

**New in 0.13.0:** meet **Rowan Field**, a farmer with Jev choosing his actions and Claude handling conversation. He learns farming, tends seasonal plots and can save toward his own farm; all three AI neighbours share the existing spending caps. See [farmer setup](NPCS.md#rowans-configuration).

**New in 0.12.0:** meet **Toby Finch**, a Claude-powered baker with his own personality, persistent memory and normal economy gameplay alongside Mabel. Both residents share spending caps, with provider-specific accounting and Claude prompt caching. See [setup and operator guidance](NPCS.md).

**Fixed in 0.11.3:** accepting an existing job safely renews its shift without duplicate employees or wages. Mabel receives explicit guidance about expired shifts and the work action needed to renew them. See [AI workplace guidance](NPCS.md).

**Fixed in 0.11.2:** building efficiency reflects current staffing immediately, and open building panels show a live production-check countdown and stock quantities. Production still happens on its scheduled cycle. See [mill production guidance](FAQ.md).

**Fixed in 0.11.1:** Mabel gets complete FAQ/economy knowledge, live workplace diagnostics and persistent action feedback. Failed plans back off and duplicate announcements are suppressed. See [AI neighbour guidance and recovery](NPCS.md).

**New in 0.11.0:** smaller network updates, bounded catch-up traffic, lighter rendering and NPC/script processing, and main-chat scrollback. Dynamic shadows default off; models, textures and lighting remain. See [performance and chat](PROTOCOL.md#compact-delivery-protocol-3-0110).

**New in 0.10.0:** optional AI neighbour **Mabel Reed**, with persistent memory, normal economy gameplay, private chat and help with controls and common questions. The original resident is independently configured, with shared spending limits and empty-parish sleep. See [NPC setup and operation](NPCS.md) and [controls/FAQ](FAQ.md).

**New in 0.9.0:** press **M** or click the minimap for an enlarged parish map with building and resource names, live player markers, zoom and panning. Click a building name to inspect it. The Parish Directory remains a separate view. See [map controls](PLAYING.md#finding-your-way).

**New in 0.8.0:** synthesized engine idle and revs, nearby players’ motors and horns, and distinct machinery sounds tied to building production. Sound starts after a click or keypress, with a visible mute button and saved volume control. See [sound controls](PLAYING.md#sound) and [release notes](../CHANGELOG.md).

**New in 0.7.0:** stronger, wider, longer-range headlights and much broader streetlight pools, with a slower fade that lights the gaps between lamps and the surrounding verges. See [CHANGELOG.md](../CHANGELOG.md) for the release notes.

The night sky has moving, seasonal stars and two nearby, phased moons. Starlight gives enough dim illumination to make out nearby ground; bright full moons reveal grass and terrain, including softer light in the shadows. Moving clouds obscure the sky and reduce that illumination. In first-person view, drag upward to look at the sky.

**Fixed in 0.6.1:** natural reverse steering, no self-employment or self-trading, and a small finished-goods delivery margin to Harbour stores (pricing revised in 0.15.3). Owners use Stockroom and Building Admin; custom prices remain configurable.

**New in 0.6.0:** an approximately eight-times-larger town footprint with winding roads, dispersed businesses, roadside lights and a matching parish map. Existing starter properties retain their owners and contents when relocated; custom lots stay in place.

**Fixed in 0.5.1:** reliable Go outside buttons during live updates, plus Space/Enter activation of focused buttons.

**New in 0.5.0:** truly dark nights with working street/window lights, persistent snow and storm traction, varied woodland, finite gathering grounds, eight new processing businesses, richer crops, and player-run hotels/B&Bs with offline room provisions. See the [economy and lodging guide](ECONOMY.md).

**New in 0.4.0:** seasonal farming and weather, team combat modes, an expanded galaxy with saved journeys and contracts, cottage styles, tractor paint and conditional chimney smoke. See the [player guide](PLAYING.md) for timing, controls and balance decisions.

**Updated in 0.3.4:** compact tractor proportions and a varied village of cottages, shops, civic buildings and industrial sheds, with consistent human-scale doors, windows and street furniture. New buildings retain existing identities, ownership and inventories.

**Fixed in 0.3.3:** smoothly shaded walking characters and cab drivers with natural proportions, facial and clothing detail, animated limbs, and a closer walking camera. Use **Inventory → Switch to walking** or **Return to tractor**.

**Fixed in 0.3.2:** smoother tractor movement and camera tracking between network updates, with software/performance rendering targeting up to 30 FPS. A short 300 ms visual buffer absorbs modest packet jitter; physics and saved positions remain server-owned.

**Fixed in 0.3.1:** fewer false Lua timeouts during worker startup, automatic backoff for failing scripts, and distinct pilot nameplates. Other tractors with a PILOT tag are connected players; they disappear on disconnect while keeping their saved progress.

**New in 0.3.0:** detailed tractors, limestone cottages, slate roofs, textured meadows and gravel lanes, layered clouds and leafy village scenery, protected offline progress, optional password accounts and email recovery, and a repeatable 100-client load probe. See [CHANGELOG.md](../CHANGELOG.md).

## Upgrade archive

All upgrades use the [standard deployment procedure](RELEASING.md#deployment): back up, install locked dependencies, rebuild with the existing BASE_PATH, restart, and refresh clients. Deployments are operator-managed. The notes below retain release-specific compatibility and validation details; test counts describe the historical run, not today's suite.

### Deploying 0.24.0

No new dependencies or database reset are required. Existing worlds enable cash gifts and roadside refuelling by default; owners may disable either under Editor → Rules. Refresh browser clients to see player-name buttons and the Players & roadside help menu.

Validation: focused simulation, privacy, persistence and NPC tests, desktop and phone browser checks, TypeScript and the `/aclone` production build passed.

### Deploying 0.23.1

No new credentials, dependencies, memory wipe or database reset are required.

NPC dialogue now receives current qualifications separately from available school courses. Older unclassified and prior-life summaries remain archived but are not used as current character facts. Death invalidates pending plans/replies; changes to qualifications, study or employment also invalidate replies still being generated. A clarified employment agreement replaces unfinished copies for the same player, workplace, world and chat channel.

Existing live agreements are not rewritten retroactively. After upgrading, ask Mabel to **train as a miller and work at Hank's Flour mill** again. Check that she starts a real course and then accepts the job; speech alone is not proof of action.

Validation: all 120 NPC tests passed, plus TypeScript, formatting and the `/aclone` production build. Regressions cover death during a pending reply, stale memory, paid retraining and verified employment. A bounded isolated OpenAI replay of the reported exchange returned the correct training-enabled request; no test messages or state changes were sent to production.

### Deploying 0.23.0

No database reset, new dependency or configuration is needed. Resources move to new shared coordinates while retaining their IDs, saved depletion and unfinished gathering loads. Update client and server together so the map, HUD, NPC destinations and scenery agree. Custom buildings and terrain can still obstruct a site.

Validation: 22 focused resource, map and NPC tests, TypeScript, formatting and the `/aclone` production build pass. The disposable browser walkthrough captures all four models and completes a real HUD-triggered gravel gathering task without page errors. Both quality modes have tested geometry budgets.

### Deploying 0.22.0

No new keys, dependencies or budget settings are needed.

NPC summaries now have person, world and channel scopes; unclassified old notebooks remain stored but are excluded from dialogue. Existing identities, journals and agreements are preserved. Learned preferences guide gameplay. Agreements can use one additional budgeted wording call, with a durable fallback; ordinary chat stays at one call. Sole safe agreed plans run without paid selection. See [NPC continuity](NPCS.md#continuity-and-conversation-0220) for behavior and limits.

Validation: all 309 automated tests passed with test concurrency limited to two, plus targeted receipt/privacy regressions, TypeScript, formatting and the `/aclone` production build. The first unrestricted run exceeded an existing two-second planner timing assertion under concurrent test load; the bounded full run passed. Tests use fake providers and make no paid AI calls. Naturalness still needs live player feedback; tests verify memory isolation, follow-through and call limits.

### Deploying 0.21.3

No new configuration, credentials or database migrations are required.

NPC agreement acknowledgements and errand corrections now use in-character language. Conversation instructions keep provider names and separate decision/chat machinery out of dialogue, while distinguishing intentions from verified results. Existing chat history is preserved; the change applies to new replies. AI badges and operator diagnostics remain available.

Validation: 19 targeted NPC tests and TypeScript checks passed, using fake providers without paid AI calls.

### Deploying 0.21.2

The cleanup runs automatically before players connect; no new configuration is required.

Only the default server-owned Puddlewick is affected. The automatic initializer now adds just the stonemason and shoreline waterworks. Excess public additions from 0.21.0 and the original public council are retired once. Purchased properties and custom-built plots remain, including their prices, stock and investment. Occupied buildings and active tasks defer removal to a later restart. Jobs at removed workplaces are cleared; removed investment is recorded in the ledger. All building types remain available for later player construction. See the exact [cleanup scope](PLAYING.md#puddlewick-services).

Seventeen focused migration, town and waterworks tests, the browser roster and production check, TypeScript, formatting and the `/aclone` production build pass. The separate 0.21.1 NPC fix passed all 299 automated tests before this cleanup. To undo removed starter properties, restore the pre-upgrade database along with the old code; a code rollback alone cannot restore removed stock or capital.

### Deploying 0.21.1

No credentials or NPC identity changes are needed. Existing delivery agreements and memories remain readable. Employment requests now queue actual school/training/job steps, with survival and scheduled logout still taking priority. Old spoken promises without a recorded request cannot be recovered automatically: ask the resident again, naming the workplace and whether they should learn its skill. Check the acknowledged queue result and ask for progress; a promise is not proof of employment or production. See [NPC agreements](NPCS.md#agreements-made-in-chat).

TypeScript and all 299 automated tests passed, including real NPC navigation, forty-minute training, job changes, restart persistence, delivery regressions and one-call conversation accounting. Tests use fake providers, not paid AI calls.

### Deploying 0.21.0

No new environment variables or dependencies are required.

Startup adds the missing catalogue building types to the default server-owned Puddlewick, including the stonemason and shoreline waterworks. New producers have finite opening supplies and wage capital. Existing businesses retain their owners, stock, prices, wages and locations. The server saves a completion record so restarts do not refill stock or recreate demolished buildings. Types without a safe site remain pending for a future restart; other worlds remain unchanged.

Open the parish map with **M** to find the new businesses. See [Puddlewick services](PLAYING.md#puddlewick-services) for production and staffing. Validation: 21 focused tests, the browser catalogue/production check, TypeScript, formatting and the `/aclone` production build passed. For rollback, restore the pre-upgrade database as well as the code to remove the new properties and their opening capital together.

### Deploying 0.20.0

Update the client and server together. Existing worlds keep their current designs; creator configuration is optional and becomes part of normal world saves. No new dependencies or AI credentials are required.

Create a separate test world and open **Editor / F10** to try the creator studio. See [World building](WORLD_BUILDING.md) for presets, models, rules and design transfer. Uploaded static GLB and image files now undergo stricter validation.

Galaxy connections stay disabled unless configured. Follow [Connecting galaxies](GALAXIES.md) to set `GALAXY_URL`, `GALAXY_NAME` and `GALAXY_PEERS_FILE` and exchange pinned public keys with trusted operators. Enabling federation creates its tables and persistent signing key automatically and restricts the database/journals to service-account access (0600). Preserve that key in backups. Character identity travels; wealth, inventory, skills and property remain local to each galaxy.

Validation included 289 automated tests, 33 browser scenarios across the full run and focused reruns, desktop/phone creator checks, two-host travel and return, and a production build under `/aclone`. One outdated browser assertion was corrected for the existing centered labour countdown and passed on rerun.

### Deploying 0.19.3

No new settings or database migration are needed. This includes the 0.19.2 NPC guidance fixes. Check a labour shift or Gather: the large countdown should appear at the center of the screen and clear on task completion, with no countdown attached to chat. Focused desktop/phone browser checks and NPC regressions were used; the full suite was deliberately deferred.

### Deploying 0.19.2

No new environment variables, database migration or AI-provider changes are needed. Existing NPC identities and budgets remain intact. Observe meal/drink errands and job choices after deployment; local deterministic checks cannot guarantee a model's economic success. The full suite was deferred at the owner's request.

### Deploying 0.19.1

No new settings, dependencies or data migration are required. Check a nearby gathering ground: Gather should be visible directly on the HUD, with tool/cargo feedback and a progress indicator.

### Deploying 0.19.0

Refresh browser clients for the industrial rocket, robocrows and floating fishing controls. Update client and server together: the enlarged rocket collision volumes and fishing dock support surface are shared by rendering and movement. Existing spaceports and docks update automatically; no database migration, dependency or environment change is required from 0.18.0.

Check that tractors drive onto the dock, E/Ctrl opens it, and Cast a line, Reel in and Stop fishing work directly from the centered controls. Check robocrow deployment/return and spaceport takeoff.

### Deploying 0.18.0

Refresh browser clients to load the rocket, landing pad and terminal cladding. The server also needs the update for the rocket and gantry collision volumes. Existing spaceports gain the new appearance automatically; no database migration, new dependency or configuration change is required from 0.17.1. The terminal entrance and takeoff action remain in the same place.

### Deploying 0.17.1

Refresh browser clients for the centered fishing control and building owner names. The server must also restart to supply offline owners' display names. There are no new dependencies, settings or data migrations from 0.17.0.

### Deploying 0.17.0

Refresh browser clients to load the mobile controls and layout. No new dependencies, credentials, environment variables or data migrations are required when upgrading from 0.16.0. Earlier upgrades retain the migrations described below; back up the database before upgrading as usual.

Check portrait and landscape driving, chat with the on-screen keyboard, and building trading/admin on your phone. Full desktop screens keep their ordinary HUD and keyboard/mouse controls. Chromium touch and desktop regression tests pass; physical Android/iOS browser chrome, keyboard and sustained performance still need device testing. See the [mobile guide](MOBILE.md).

### Deploying 0.16.0

Refresh browser clients for the waterworks construction option and graphics. No new dependencies, credentials or environment variables are required.

On the first world load, pricing revision 3 updates only old default water bids of 8.68d to 5.60d and lodging asks of 10.47d to 6.75d on unowned/public buildings. Every human- or NPC-owned business, and unrelated custom prices, remain intact. Worlds predating revision 2 receive the complete current default price lists for unowned/public buildings. Stock, capital, wages and ownership are preserved. Restore the pre-upgrade database backup as well as code if rolling back.

No waterworks is created automatically. Players or NPCs build one on a dry shoreline, deliver materials, supply fuel and fund its operator's wages. Harbour imports remain available before a local producer opens. See [waterworks instructions](PLAYING.md#water-supply).

### Deploying 0.15.3

Refresh browser clients for updated catalog reference prices. No new environment variables are needed. The first world load upgrades unowned and treasury-run public buy/sell lists to pricing revision 2. All player-owned businesses (including NPC-owned ones) keep their prices and wages exactly; cash, stock and ownership are unchanged. The revision is saved with the world and prevents repeat migrations. Restore the pre-upgrade database backup as well as code if rolling back the price migration.

Existing owned businesses can retain incompatible old bids; their owners must adjust those themselves. As observed before release, Puddlewick's owned mill and bakery are both protected. NPCs also validate new delivery promises before replying, and explain existing blocked requests once without another speech-model call.

### Deploying 0.15.2

Refresh browser clients for retained form values and scroll positions. No new environment settings or data migrations are required. NPC chat no longer waits for a gameplay request to succeed; existing spending caps remain.

### Deploying 0.15.0

No route changes are needed. Enable the new fifteen residents with `NPC_POPULATION_ENABLED=true` in the server environment; `NPC_TIME_ZONE` defaults to `America/New_York`. Existing identities and memory survive. All residents share the same spending caps. Mabel stays online, and enabled Toby/Rowan/Elias receive longer scheduled visits.

Offline starvation is now active for all pilots, including restart catch-up. Provision a home or a booked room before a long absence; empty stores and booking expiry can lead to death and ordinary estate losses. Ageing and passive property decay still pause offline. This supersedes older releases' offline protections.

### 0.3.0 upgrade notes

Back up the database and uploaded assets before upgrading. This release migrates account storage from schema 1 to schema 2; a rollback to 0.2.x requires restoring the pre-upgrade backup. Existing pilots and pilot keys remain usable. Configure SMTP and PUBLIC_ORIGIN only if enabling email verification and password recovery; passwords also work without mail delivery. See [hosting and recovery](HOSTING.md).

For a deployment at `/aclone/`, retain `BASE_PATH=/aclone` at build time and the prefix-stripping reverse proxy. Include the new `public/textures/` files in the client build. Editable PNG masters in `art/materials/` ship in the source archive, but are excluded from the runtime Docker build context.

### 0.3.1 upgrade notes

No schema change. Pull and install the locked dependencies, rebuild with the existing `BASE_PATH` (for hromp.com, `/aclone`), then restart the Node service so it loads the script-worker changes. Refresh browser clients for the pilot labels. Existing script errors are chat history; the upgrade does not erase messages or pilot accounts. A connected test pilot remains a player until its session closes.

### 0.3.2 upgrade notes

No schema or wire-protocol change. Rebuild the browser bundle with the existing `BASE_PATH`, restart the service to report the new version, and refresh clients. The movement fix is in the client bundle; pulling source without rebuilding will continue serving the old movement code. Software rendering can now draw up to 30 FPS, so CPU use may increase on machines without GPU acceleration.

### 0.3.3 upgrade notes

No schema or protocol change, and no new external asset downloads. Rebuild with the existing `BASE_PATH`, restart the service, and refresh browser clients to load the character models and walking-camera changes. The editable character source and capture script are included in the source archive.

### 0.3.4 upgrade notes

No schema or protocol change. Rebuild the browser bundle with the existing `BASE_PATH` and restart the Node service: rendering and authoritative building collision share the new footprint definitions. Saved building identities, positions, ownership and inventory remain intact. A player caught inside a changed footprint can drive or walk toward its edge to escape. Refresh clients so displayed geometry matches the server collision model.

### 0.4.0 upgrade notes

The additions use optional JSON fields; missing combat settings and public-market crop listings are filled on load without resetting accounts, buildings, stock or custom prices. Station supply uses the existing metadata table. No database schema migration or new service is required.

Farms keep their stock and employment but stop automatic wheat production. Owners must learn farmer, fund seeds and plant plots. Legacy custom farm production recipes are retained in the save but no longer executed; other custom recipes are unchanged. Read [PLAYING.md](PLAYING.md) before upgrading a busy economy.

Production at hromp.com remains an operator-managed pull/rebuild/restart deployment.

### 0.5.0 upgrade notes

Refresh clients. There is no new service or SQL schema migration; optional save fields preserve old accounts, properties, crops and stock. New public-market items start empty. New industries and lodging are player-buildable and are not forced into established towns.

Residents left inside now consume provisions while offline. Health loss and ageing remain paused offline. Manual logging/quarry tasks move to the Resources grounds; carry tools. Read [ECONOMY.md](ECONOMY.md) for the new material chains, professions, soil care and guest protections. Light and weather changes apply in every graphics mode. The screenshots are local staged worlds, not evidence of a production deploy.

### 0.5.1 upgrade notes

No save, schema or protocol changes. Rebuild the client with the existing `BASE_PATH`, restart the service and refresh open clients. This fixes the Go outside button losing clicks during world updates, and restores native Space/Enter activation for focused buttons.

### 0.6.0 upgrade notes

The town footprint is about eight times larger (area, not eight times each dimension). Building models, player size, speed, map boundaries and activity locations remain unchanged.

On first load, starter buildings still at their original coordinates relocate to the new parish plan. Ownership, prices, stock, plots, employment and IDs stay intact; nearby grounded pilots and residents move with their building. Edited starter positions and player-built lots are preserved. A destination occupied by another retained property is skipped. Such customized worlds can retain some compact lots alongside the expanded street network. Terrain brushes remain additive over the wider flat parish; coastal water remains south of town.

The optional saved `townLayout` field prevents a second move. A rollback should restore the pre-upgrade backup so old clients do not show old roads over new lots. No production deployment is performed by the release scripts.

### 0.6.1 upgrade notes

Saved accounts, stock, money and property IDs are preserved. Default buy/sell quotes matching the 0.6.0 data pack migrate once to the delivery pricing model; other saved quotes are kept. The optional saved `tradePricing` field prevents future loads from overwriting subsequent edits.

Owner-employees are removed from their own payroll on load and property purchase. Existing self-paid harvest reservations become unpaid; the produce still goes to the farm. Other staff and employment at other buildings remain intact. Workplace tasks already in progress can complete; new tasks at one's own building are blocked.

### 0.7.0 upgrade notes

No save, database-schema or wire-protocol changes. Pull, rebuild with the existing `BASE_PATH=/aclone`, restart the service and refresh browser clients. The stars and lunar surfaces are generated by the client; no external sky assets or new services are required. Sunrise, sunset and moon phases share the saved calendar. The nearby moon pair follows a 28-game-day phase cycle, continuing across years.

This release also broadens headlights and street lighting and makes clear nights more navigable by starlight and moonlight. Cloud cover still dims natural light. In first-person view, drag vertically to look up. Night-sky and lighting capture scripts use disposable local worlds; their screenshots do not represent a production deployment.

### 0.8.0 upgrade notes

No database migration, new dependency or external audio files are required. Pull, rebuild with `BASE_PATH=/aclone npm run build`, restart the Node service, and refresh clients. Restarting is necessary: snapshots now include public motor and production activity fields used by the new client audio. Saved accounts, property, inventories and settings remain intact.

Sound starts after a click, tap or keypress. Previously saved mute preferences are respected; use the Sound button to enable it and Pilot & preferences to adjust volume. New browser profiles default to sound enabled. Hidden tabs, disconnected clients and space travel are silent. Audio samples are synthesized locally and cached; there are no audio download paths to configure for subpath hosting.

### 0.8.1 upgrade notes

Evergreen geometry, bark and needle textures are generated locally; no new downloaded assets or dependencies are needed. There are no save, schema or protocol changes. Grove locations and other scenery placement are preserved. Performance mode keeps the same branch layout with fewer small sprays.

### 0.9.0 upgrade notes

No database or wire-protocol changes. Rebuild with the existing `BASE_PATH` (`BASE_PATH=/aclone npm run build` for hromp.com), restart the service to report its new version, and refresh browser clients. M now toggles an enlarged map; Parish Directory keeps its separate buttons. Existing worlds, custom properties and resource reserves are unchanged.

### 0.10.0 upgrade notes

Refresh browser clients for AI identity, private chat and the memory notice. Existing accounts and worlds are preserved; four additive NPC tables are created when the optional controller is enabled. SQLite backups include its memories, pause state and usage reservations.

Enable **one** Mabel with `NPC_ENABLED=true` and `OPENAI_API_KEY` in the server's private environment. The development machine's `.env` is deliberately not pushed: configure the production host separately. Native `npm start` does not read `.env` automatically; use the service's EnvironmentFile or `node --env-file=.env --import tsx src/server/main.ts`. Docker Compose passes the listed settings from its `.env`. Keep `NPC_ID=mabel` stable and keep the same DATA_DIR across restarts. See [NPCS.md](NPCS.md) for spending limits and pause/usage commands.

Ship `docs/FAQ.md`, `docs/PLAYING.md` and `docs/ECONOMY.md` with the server; they power the local help lookup. Docker and the source archive include them. The API key stays server-side; no browser build variable should contain it.

## Historical NPC provider trials

Legacy/small-scenario tests, not long-term autonomy benchmarks.

A live GPT-4.1 mini trial verified private chat, driving to the Odd Jobs Office,
three completed labour shifts (13,500 internal currency units earned), and
journal/notebook persistence after reopening the database. That successful
four-minute simulated gameplay trial used one model request, with a locally
estimated cost of $0.0016668. This is one sample, not a long-term cost forecast.
The trial also exposed an unsupported `oneOf` schema emitted by Zod; the adapter
now emits equivalent `anyOf` branches for disjoint action types, and a regression
test checks the wire schema. The smoke runner reports sanitized provider error
codes/parameters on rejection, never the API key or provider error message body.

A separate live guide trial answered controls (M/L/Parp), verified-email password
recovery, owner stockroom transfers and spring coffee planting/60-day growth.
It used four requests with a local estimate of $0.010442 in total. Automated
backup/restore testing also covers identity, private journal, pause and spending
reservations together. These samples do not establish long-term cost or perfect
help accuracy.

The 0.11.1 expanded-knowledge trial used the real model against a synthetic
mill: it identified the absent job and 7.41d capital shortfall, chose employment
and active work after funding, and the normal simulation produced 3 flour from
5 wheat and paid 19.80d net wages. It also identified missing wheat, output space
and wages for a changed recipe. That three-request sample cost approximately
$0.0161 at the configured accounting rates. A further four-question controls,
recovery, ownership and coffee-growing trial passed at about $0.0209. Earlier
iterations exposed misleading hiring advice and a display name used as a travel
ID; explicit actor roles and target-ID instructions were added. These limited
samples demonstrate improvement, not guaranteed advice or long-term reliability.

Prompt structure and contextual examples follow the
[official OpenAI prompt engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering).
The model and existing daily/monthly limits are unchanged. Richer turns cost
more individually; repeated failed attempts also cost money, so judge changes
against successful gameplay and measured usage rather than prompt length alone.

### Claude baker trial (2026-10-01)

An opt-in real Claude Haiku 4.5 trial used a disposable world and synthetic
private chat. Toby selected school training, paid the ordinary 80d tuition,
accepted bakery employment, converted 2 flour into 3 bread at the production
boundary, earned a 19.80d net wage, and recalled the test owner’s favourite loaf
in a private reply. The successful three-request run cost about $0.05063;
later requests hit the 5,482-token stable prompt cache. Fixture positioning
placed him near school/bakery entrances; navigation is tested separately.
The earlier integration trials exposed invalid task/job forms and oversized waits;
these remain rejected, and explicit action examples corrected the live trial.
This demonstrates a short working scenario, not perfect long-term AI judgement.

## Jev farmer trial (2026-10-01)

The live integration trial used a disposable in-memory parish and real Jev/Claude
APIs. It placed Rowan at service entrances and advanced the test crop to ripeness;
it did not modify production saves or grant skills or harvest wages. Four Jev
choices trained farmer for 80d, accepted farm employment, planted potatoes and
harvested 45 into the farm stockroom, earning 19.8d after tax. Two Claude calls
supplied private dialogue. Controller restarts between stages preserved identity
and memory. The successful six-call run cost an estimated $0.030271796; earlier
tuning attempts incurred additional usage. This is an integration check, not a
promise that an unsupervised resident will always make optimal decisions.

To repeat (real API charges; at most four Jev plus two Claude calls and a $0.50
local cap; `.env` must contain both keys):

```sh
node --env-file=.env --import tsx scripts/npc-farmer-smoke.ts --live
```

Automated tests additionally cover watering, fertilizer, seed funding, seasonal
restrictions, wage/storage blockers, owner stock sales, restart memory, invalid
provider output, separate call accounting and continued gameplay when dialogue
fails or hits the budget. Browser tests use deterministic providers without
paid requests and verify all three chat identities and private-message isolation.

## Puddlewick cleanup scope

The cleanup removes public starter noticeboards, tool workshops, wineries,
furniture workshops, B&Bs, rare-earth mines, electronics works, brick kilns,
the council, iron mines, tea houses, curious trees, turrets, refineries, concrete
works, kitchens, roasteries and breweries. It also undoes the other unintended
0.21.0 additions (warehouse, portal, supply cache, composting yard, shipyard and
hotel) to retain only the two approved additions. Purchased buildings and custom
plots are protected, even if a player later relinquishes them. An active task or
occupied building defers removal until a later restart; jobs at removed buildings
are cleared. No catalogue type is deleted or banned from future construction.

## 0.24.0 upgrade notes

No new dependencies or database reset. Existing worlds enable cash gifts and roadside refuelling by default; owners can disable them independently under **Editor → Rules**. Refresh clients for player-name buttons and **Players & roadside help**. Focused simulation/privacy/persistence/NPC tests, desktop/phone browser checks and the `/aclone` build passed.
