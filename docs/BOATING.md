# Boats, fishing and the coastal economy

This guide describes the expedition system in Aclone 0.103.0. Prices below are defaults;
worlds and business owners can change them.

## Boarding and mooring

Buy or board a canal boat or commercial fishing boat at a completed shoreline
boathouse. Stop on dry land within 40 metres of the building,
choose the boat from its Main tab, buy Fuel and use
it from your inventory once aboard. New boats start with empty tanks. Each has
its own fuel, paint and maintenance record. Boatmaster is required in worlds
which enable vehicle licences.

The fishing pier also boards boats you already own. Return to a water berth
before switching to walking or an owned tractor. Stop within the boatyard’s
30-metre waterfront arrival area (14 metres beside a fishing-pier berth);
there must be water between you and the berth. At a fishing pier, boarding still
requires being within five metres of its marked boarding point. The pier leaves the actual
empty boat moored there; retrieve that particular boat from that berth. The
boathouse puts it away inside. Different owned boats have independent moorings.
Passengers board and disembark at the dock too. There is no offshore switch to
walking, tractors, robocrows or another world.

A boathouse has a dry workshop and stores, plus a covered lifting hall extending
out over the water. Its open water floor, tall entrance and crane slings make
room for boats to enter. A side jetty provides the boarding berth.

Each of the five architectural models has its own three boats on repair stands:
canal restoration and skiffs; cruising sailboats and tenders; fishing launches
and workboats; traditional wooden craft; or cabin cruisers and sports boats.
Hull shapes, cabins, masts and equipment vary independently of the building finish.
These yard boats are scenery, not free vehicles.

The build validator requires dry workshop ground and enough depth and clearance
for the complete hulls in both the covered slip and the outside berth. The
Parish Carrier is 13.5 metres long; the North Star is about 20.4 metres. Skippers
remain at normal human scale. Buildings and farm expansions must leave the berth clear. On deployment,
Puddlewick receives a public boatyard only if a safe site is available; existing
property and coastline are preserved.

## Canal boat lights and rod fishing

The standing skipper steers with the exposed stern tiller. The Lights menu controls
bow/stern deck lighting, warm or dim-red cabin lighting, and the searchlight.
Navigation lights operate automatically; the canal boat does not display trawling signals.

Buy Fishing tackle from a boathouse or Harbour stores. Stop the boat before casting.
Coastal bites take 40–90 seconds; deep-water bites take 150–300 seconds, with larger
species possible. Reel within eight seconds using the button or F3; a missed bite
starts a new wait. Press H to hide the HUD while retaining one small stop/reel
button along the bottom. H or Escape restores the normal controls.

## Canal boat costs

The Parish Carrier costs **24s**, carries 240 weight plus up to three passengers,
and has a **64-unit fuel tank**. At the default boatyard price of 45d per Fuel
item (eight tank units), an empty tank takes eight items and costs **3s 60d**.
A well-maintained boat at normal full speed uses **0.72 tank units per minute**:
about **89 minutes** per full tank, or **2s 43d/hour** at the yard's fuel price.
Slower travel burns less per minute; boosting and poor condition use more.
Stopped boats do not consume cruising fuel. New boats start empty.

## Out of fuel

An empty powered boat can launch an orange inflatable lifeboat. Its main cargo
stays on the stranded boat. Row using the normal driving controls; the inflatable
uses no fuel and carries 40 weight. Return to a dock to step ashore. Both the
stranded boat and the moored inflatable remain where they were left, across
reconnects and server restarts.

Buy Fuel, reboard the inflatable at the same dock, and row back. The inventory
panel offers a waypoint to the stranded boat. Within five metres, reboard it and
use the carried fuel. The inflatable is then stowed. If the main hold is full, reboarding pours carried Fuel into its tank first to make room. Fuel cannot remotely refill
the main boat while you are ashore or rowing. Canal-boat passengers remain with
the skipper during rescue and can disembark once the inflatable reaches a dock.

## Rod fishing

Carry Fishing tackle, stop the powered boat and cast a line. The boat stays at
its actual position. In water at least eight metres deep and about 150 metres
from land (including islands), it can catch Atlantic
cod, Atlantic halibut and bluefin tuna, in addition to existing fish. These
species have heavier carrying weights and higher prices. Deep-water rod bites take 2½–5 minutes; a rod does not match a net’s catch volume. Shallow water and the
shore retain small-fish catches. Fishing progress does not teleport boats to the
pier. Rod fishing and trawling cannot operate simultaneously.

## Commercial fishing

The North Star is a classic working trawler, with a forward wheelhouse, open
working deck, net drum, stern gantry, fish boxes, navigation mast and textured
helm instruments. Static parts are batched; the trailing net uses a cutout
texture rather than thousands of individual strands.

The revised wheelhouse has a mounted compass and live speed (knots), throttle and
fuel gauges, plus an animated throttle lever. The compass follows the boat's
heading, not your mouse-look direction. Instrument faces remain readable at night.
The radio and paper chart are cabin detail, not working communication or fish-finding tools.

- Purchase: **300s** at the default 100d/s currency ratio. Existing owners keep their boats.
- Hold: **3,200 weight**, shared by landed fish, provisions and carried goods.
- Tank: **3,200 units**, filled with 400 Fuel items; **180s** at the default boatyard.
  New boats start empty. Use **Fill tank from carried Fuel** to refuel in bulk.
- A maintained boat has enough fuel for **21 Puddlewick days of towing** plus
  the offshore round trip. At 600 seconds per game day this is **3½ real hours
  fishing**, with travel on top. Detours, maintenance and time with idle nets
  affect actual endurance; a full hold may bring a trip to an earlier end.
- Cruise: up to 6 m/s; towing up to 2.4 m/s. Fuel and cargo weight reduce speed
  and increase fuel use. There is no boost.
- W/S or up/down adjust persistent throttle. A/D or left/right steer. Lower
  throttle through idle for reverse. B or **Idle** sets zero; the hull coasts.
  Chat and menus do not reset the throttle. Idle before docking.
- Deploy only with sufficient clear water. Nets burn fuel while down, even when
  stopped, but only actual forward towing catches fish. Keep return fuel.

Fish accumulate continuously. The only preview is fish moving in the net;
there is no species list, fish count or countdown before hauling. Haul whenever
you want to see the catch. A full net stops fishing and triggers an on-screen alert, including when you log in
with a full net. Its highlighted status remains in the collapsed fishing controls;
haul it into the hold and redeploy. Full holds stop towing without discarding
previous catches. The hauling animation retrieves the rig, lifts its closed catch bag, drains water
and empties fish onto the deck before winding the gear onto the drum; landed fish piles reflect the hold load. A compass appears in the helm HUD.

Conditions vary during a trip, with longer good or bad spells too. Pausing,
hauling, docking or reconnecting does not reroll conditions. Offline time does
not catch fish or advance the fishing clocks. Fuel exhaustion stops towing;
an unhauled catch remains in the visible net. Refuelling does not restart fishing:
choose **Deploy / resume nets**, or **Haul catch & stow** to bring the catch aboard. Existing catches and paid partial legacy
progress survive the upgrade.

### Provisions and deckhands

The captain can put food and water into the boat stores and take them back.
Stores stay aboard when disembarking and share the hold’s capacity. Online
captains must take boat-store provisions into inventory. In Puddlewick these carried meals are eaten automatically; worlds with inventory feeding disabled require manual use. Offline captains eat from boat stores automatically. Enabled remote-home feeding is available as a fallback too.
Deckhands eat from the captain’s supplies automatically, online or offline, at
the same normal need rates. Empty stores do not prevent hunger or thirst.

Offer another online player or resident a berth at the dock, with **5–25% of
profit**. They must choose to accept and physically reach the same dock before
boarding. There are two berths. Each occupied berth improves catches modestly.
Crew agreements, supplies and expenses survive disconnects and server restarts.

Deckhands cannot leave at sea. At a stopped dock they may step ashore; their
share remains owed until settlement. The captain selects **Sell expedition
catch, settle shares & put crew ashore** at a funded buyer. Settlement sells
hauled expedition fish and pays the agreed fractions of positive receipts minus
consumed fuel and provisions. Losing trips pay no shares and charge no loss to
the crew. No money is created to pay either catches or wages. If the buyer lacks
cash or space, the transaction makes no partial transfers.

For predictable agreement terms, consumed fuel is valued at the departure
landing’s quote and consumed provisions at its prices (catalogue prices where
unavailable). Unused fuel and supplies are not expenses. These are agreed
valuations, not a reconstruction of the captain’s historical purchase prices.
The captain’s interface shows the accounting. Ordinary transfers of expedition
fish are restricted while crew shares remain unsettled.

### World and balance notes for maintainers

The public-world migration expands Puddlewick’s navigable square from 12.5 km to
18.5 km. Its original terrain extent remains 12.5 km, preserving island heights,
woodland and property. Eligibility requires eight metres of depth and roughly
150 metres of clearance from land, checked on a conservative 10-metre grid.
The first centreline qualifying water is around the town’s southern boundary.

Server-only suitability uses surrounding water and shore distance, interpolated
smoothly: enclosed bay conditions differ from the ocean beyond the headlands.
The client receives no suitability score or location recommendations. Short
school changes coexist with long random productivity spells retained across
hauls and port calls, so repeated actions cannot buy a free luck reroll.

Seeded tests sample 500 voyages for each of four scenarios: short bay trips,
21-day solo ocean trips, and ocean trips with one or two 15%-share deckhands.
They include cargo-dependent towing fuel, estimated outbound/return fuel and
rounded food/water requirements. They test poor trips and early full holds,
not guaranteed returns. This is a mechanics balance model, not evidence of
live-world profits; repairs, selling delays and actual quotes add uncertainty.
See tests/commercial-fishing.test.ts for the current measurements and assumptions.

The tank also passes a conservative endurance bound using maximum loaded fuel
multipliers for the complete 21-day tow and both legs to the offshore grounds.
The vessel is a costly, risky active career, not a guaranteed payout timer.

Boatyard landing bids are 56d cod / 112d halibut / 182d tuna. Its resale asks are
60d / 120d / 195d. Harbour stores and spaceports bid 64d / 128d / 208d. Kitchens,
pubs, cafés, B&Bs and hotels bid 68d / 136d / 221d. Thus hauliers can buy landed
fish and deliver them inland for a margin. Direct delivery earns the skipper
more too, but requires the additional transport work. All bids require till
money and storage room. Player deliveries receive the full posted bid; sales
taxes are included in business retail proceeds, not added to the buyer's bill.

Public boatyards export real surplus fish using the existing bounded shipment
system (up to 800 of each species per half-hour, retaining eight). Harbour stores
and spaceports also export the new species. Export receipts replenish the
selling public business's till; they do not directly pay players or invent fish.
Boatyards never export their rescue fuel. The public boatyard buys finite bunker
shipments from its till, targeting 512 Fuel items with at most 400 per half-hour.
Its one-time expansion supplies working capital and pays for the initial stock
upgrade; subsequent fuel and fish trading fund operations. Fuel is also bought locally, with a
bid above the refinery's default ask so deliveries can pay.

Owners of kitchens, cafés, pubs, B&Bs and hotels may select cod, halibut or tuna
menus. Cooks use normal staffing, wages, stock, production intervals and accounts:

- 1 cod + 2 potatoes + 1 water produces 4 meals.
- 1 halibut + 4 potatoes + 2 water produces 6 meals.
- 1 tuna + 6 potatoes + 3 water produces 9 meals.

Changing the menu clears fractional batch progress. Standard menus restore the
original recipe (or retail-only operation). World-custom recipes are preserved.
Guests can also purchase fish and store it in their private room pantry, where
normal food consumption applies. New listings are added to existing relevant
businesses without replacing existing prices, paused offers, owners or balances.

## Verification

`npm test` includes docking, independent moorings, fuel rescue and persistence,
continuous catches during real movement, early hauling, full holds, saved
encounters, prediction isolation, offshore clearance, seeded earnings samples,
throttle retention, recipe consumption, trade margins and bounded exports.
Browser boating tests exercise actual UI/server movement and shorten only the
next-fish wait to verify that catches arrive before any fixed trip duration.

`npx tsx scripts/canal-boat-preview.ts` renders the canal boat. Add `--fishing`
for the commercial boat. `scripts/boating-preview.ts` captures all four subjects
from the actual game factories. These images are model previews, not photographs.

## Lighting

In the North Star, click **Lights** to open
wheelhouse switches, also available in **Inventory → Boating**. Deck floods toggle
independently. Cabin lighting cycles off → warm white → dim red → off. **L** keeps
its quick searchlight toggle. Switches persist with the captain's fishing boat,
and other players see the lights. Lighting does not consume propulsion fuel.

Navigation lights stay on automatically, including during daylight and with the
engine stopped. Red marks port and green starboard; their sectors and the white
stern/masthead sectors follow the vessel's heading. Nets down replace the normal
masthead signal with steady green above white; sidelights and sternlight remain
when making way. Moored or rescue-abandoned boats show an all-round white
visibility light. This is a simplified game implementation: stopping is not the
same as anchoring, and there is no separate anchor command. Signal visibility is
scaled for the game's viewing distances.

A flashing red mast beacon is not a normal trawler navigation signal. The design
uses [US Coast Guard Rules 21, 23 and 26](https://www.navcen.uscg.gov/navigation-rules-amalgamated)
for colours, sectors and fishing status. [Rule 36](https://www.rya.org.uk/water-safety/passage-planning-and-navigation/navigation-lights/)
discourages high-intensity intermittent lights that could confuse other signals.
The separately switched, downward deck floods follow ordinary marine worklight
practice, such as [Hella marine deck floodlights](https://www.hellamarine.com/shop/floodlights/sea-hawk-floodlights/sea-hawk-r-led-floodlights/).
The cabin provides a low-glare red option while instruments remain readable.

The commercial fishing HUD starts as a small lower-left status button. Click to
expand or collapse the throttle/net controls; the browser remembers your choice.
A full net still shows on the collapsed button. All fishing actions remain
available in Inventory. The camera stays above water even at its lowest orbit.

## Death and boat recovery

**Puddlewick: death removes all owned canal boats and fishing boats, including
stored, moored and stranded vessels, their cargo, provisions and tank fuel.**
This applies to future deaths; upgrading does not confiscate existing boats.
Running out of fuel is not death and still permits the ordinary rescue below.

Other worlds can choose **Editor → Rules → Boats and death**. Untick **Lose all
owned boats on death** to enable offshore recovery; set **Recoverable cargo
lifetime** in game days (default five; zero disables spoilage), and choose **Keep
tank fuel in recoverable boats**. These controls are also available when creating
a world. They are independent of the ordinary inventory/property death rules.

In a recovery world, a captain who dies aboard a boat respawns on foot at a shore landing. The owned
boat stays at its offshore position, retaining tank fuel if the world allows it. Cargo, provisions
and any unhauled net catch remain aboard for **five in-game days** from death,
then are lost, unless the world owner sets a different lifetime. This applies to the entire abandoned cargo, including carried fuel
cans; **fuel already retained in the tank never spoils**. The standard ten-minute game day
makes the recovery window about fifty real minutes of running world time.
Paused worlds and frozen day/night clocks do not advance spoilage. Saving,
reconnecting or dying again does not restart the deadline.

Inventory → Boating shows the time remaining and waypoints for the stranded boat
and the recovery lifeboat at its dock. Row back and reboard alongside. If the dock
has since been removed, board the recovery lifeboat from another valid dock.
You cannot call the stranded vessel back through the normal boat-selection menu.
The same physical recovery route works after a fuel emergency; simply running
out of fuel does not start the death-related spoilage deadline.

You may instead **hitch a recovery ride** on another player's canal boat or
fishing boat from a dock. Select that player and choose **Hitch a ride**. A trawler
has two berths shared between hired deckhands and recovery passengers; recovery
passengers receive no wages, catch bonus or profit share and bring their own
food and drink. When the driver stops alongside your stranded boat, open
Inventory → Boating → **Reboard your stranded boat** to transfer directly. Your
carried fuel and other items transfer with you, subject to the destination hold's
capacity. The assisting player's boat, fuel and cargo stay with them. Ordinary
passenger disembarking still requires a dock, never open water.

If a captain dies with passengers aboard, they remain offshore in lifeboats and
can row to a dock to disembark. The deceased captain's fishing expedition ends.
Existing abandoned cargo keeps the deadline assigned when the captain died.

### Previewing the trawl model locally

Run `npx tsx scripts/trawl-preview.ts` to capture the actual boat and rig towing,
lifting and emptying, plus a short animation in `output/trawl-rig/`. The inspection
image deliberately hides the water to reveal the complete net; gameplay keeps it
submerged. This preview does not connect to or alter a live world. Run
`npm run test:e2e -- tests/browser/trawl-rig.spec.ts` for the deployment/haul and
render-budget checks.

### Ocean weather and tides

Calm, low-wind days can be almost still. Wind seas build and decay over roughly
90 seconds as weather changes; thunderstorms produce larger crossing swells,
whitecaps, shoreline surf and bow spray. Boats follow the water with heave, pitch
and roll. Meeting a steep rising wave at speed adds resistance; throttle back to
reduce slamming and spray. This update does not add random sinking or hull damage.
First-person views follow the hull, and third-person cameras stay above the waves.

The lunar tide has two highs and lows per lunar day: about 12 hours 27 minutes of
game time between lunar highs, or 5 minutes 11 seconds at the default clock rate.
The game's 28-day moon cycle produces larger spring tides around new/full moons
and smaller neap tides around quarter moons. Tides use the continuous saved lunar
calendar, including while an owner changes the decorative day/night clock.
Puddlewick enables a maximum 0.6-metre high-to-low spring range on upgrade.
Other worlds retain zero tides until their owners opt in. The world editor exposes
**Ocean and tides** controls for range (0–4 metres) and wave strength (0–2).

Floating jetties and their gangways follow the tide; the fixed fishing pier stays
above high water. Low tide can uncover shallows. Return to a dock or boatyard to
leave a boat as usual. Existing landing identities remain stable throughout the
cycle; new construction must allow for high and low water. Maps follow the tidal shoreline while retaining mean-sea-level
contours. Fishing depth uses the current tide, with conservative low-water coastal
clearance. Tide and wave settings do not change catch tables or vessel prices.

Shallow submerged gear remains visible, but colour and contrast fade with distance
through water. The deep ocean floor is obscured. The ocean is a bounded wave and
buoyancy approximation, not a fluid-volume solver: surf foam represents spilling
breakers, with no simulated overturning water volume, flooding, currents or erosion.

For an actual-renderer preview, run `npx tsx scripts/ocean-preview.ts`; outputs go to
`output/ocean/`. This uses a disposable local world, never a live player account.
