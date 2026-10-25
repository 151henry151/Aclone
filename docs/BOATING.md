# Boats, fishing and the coastal economy

Available in Aclone 0.94.0. Prices below are defaults; worlds and business owners can change them.

## Boarding and mooring

Buy or board a canal boat or commercial fishing boat at a completed shoreline
boathouse. Approach its shore entrance, stop, choose the boat, buy Fuel and use
it from your inventory once aboard. New boats start with empty tanks. Each has
its own fuel, paint and maintenance record. Boatmaster is required in worlds
which enable vehicle licences.

The fishing pier also boards boats you already own. Return to a water berth
before switching to walking or an owned tractor. The pier leaves the actual
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

## Canal boat costs

The Parish Carrier costs **18s**, carries 240 weight plus up to three passengers,
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
its actual position. In water at least eight metres deep it can catch Atlantic
cod, Atlantic halibut and bluefin tuna, in addition to existing fish. These
species have heavier carrying weights and higher prices. Deep-water rod bites take 2½–5 minutes; a rod does not match a net’s catch volume. Shallow water and the
shore retain small-fish catches. Fishing progress does not teleport boats to the
pier. Rod fishing and trawling cannot operate simultaneously.

## Commercial fishing

The North Star is a classic working trawler, with a forward wheelhouse, open
working deck, net drum, stern gantry, fish boxes, navigation mast and textured
helm instruments. Static parts are batched; the trailing net uses a cutout
texture rather than thousands of individual strands.

- Purchase: **70s** at the default 100d/s currency ratio.
- Hold: **280 weight**, shared with food, water, fuel cans and other carried goods.
- Tank: **144 units**, filled by 18 Fuel items; **8s 10d** at the default boatyard.
- Cruise: 6 m/s; nets cap forward speed at 2.4 m/s. There is no boost.
- Controls: W/S or up/down adjust a **persistent throttle**. A/D or left/right
  steer. Keep lowering the throttle through idle for slow reverse. B or the
  on-screen Idle button sets zero; the hull coasts to a stop. Chat and menus
  neutralize key input but keep the set throttle. Idle before docking.
- Tow: **12 real minutes** of actual forward movement in water at least eight
  metres deep. A complete tow consumes **124 units**, leaving 20 from a full
  tank for roughly three minutes at cruise. Route length and wasted fuel can
  require extra cans. Returning to harbour is the skipper's responsibility.

Nets down consume fuel even while stopped or in shallow water, but that does not
advance the tow. Stowing pauses it. Progress survives disconnects and does not
advance offline. Fuel exhaustion stows the nets. The skipper can resume a saved
tow after refuelling. Fishing can be disabled through the world fishing setting.

Each full tow rolls once:

- 30% poor: 6 cod; **3s 36d** at the boatyard.
- 60% ordinary: 12 cod and 2 halibut; **8s 96d**.
- 10% large: 24 cod, 8 halibut and 5 tuna; **31s 50d**, weighing 251.

A ready catch is saved in the net until hauled. Insufficient cargo room blocks
hauling without losing or rerolling it. Repeated clicks cannot duplicate fish.
The counters in player statistics record fish actually hauled aboard.

## Balance and markets

The weighted landing value is `0.3 × 3.36 + 0.6 × 8.96 + 0.1 × 31.50 = 9.534s`.
A full retail tank costs 8.10s. Assuming 12 minutes towing, three minutes sailing
and five minutes of selling/refuelling, three trips per hour return about
**4.30s/hour after fuel**. That excludes food, repairs, purchase amortization,
unsold fish and extra travel. Poor trips lose 4.74s; ordinary trips gain 0.86s;
large trips gain 23.40s. There is no promised jackpot after ten trips: independent
random draws can produce long losing runs. Working capital matters.

For comparison, default full-speed mill/bakery/sawmill margins before payroll
are roughly 4.80s/5.71s/3.96s per hour. Staffing, taxes and actual sales reduce
those business margins. Fishing requires a much dearer 70s capital purchase,
active sailing and substantial cash reserves. Buying fuel directly from the
refinery at 38.50d instead of the yard's 45d lowers a tank to 6.93s, improving the
same theoretical return to 7.81s/hour, before the extra procurement travel.
These are catalogue calculations and deterministic mechanics tests, not evidence
of live-world realized earnings. Check actual posted quotes and funded demand.

Boatyard landing bids are 56d cod / 112d halibut / 182d tuna. Its resale asks are
60d / 120d / 195d. Harbour stores and spaceports bid 64d / 128d / 208d. Kitchens,
pubs, cafés, B&Bs and hotels bid 68d / 136d / 221d. Thus hauliers can buy landed
fish and deliver them inland for a margin. Direct delivery earns the skipper
more too, but requires the additional transport work. All bids require till
money and storage room. Player deliveries receive the full posted bid; sales
taxes are included in business retail proceeds, not added to the buyer's bill.

Public boatyards export real surplus fish using the existing bounded shipment
system (up to 40 of each species per half-hour, retaining eight). Harbour stores
and spaceports also export the new species. Export receipts replenish the
selling public business's till; they do not directly pay players or invent fish.
Boatyards never export their rescue fuel. Fuel is also bought locally, with a
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
real movement over a full tow, saved catches, payout bounds, throttle retention,
recipe consumption, local trade margins and bounded exports. Browser boating
tests exercise the real UI and server; their shortened completion fixture is
separate from the full-duration movement test.

`npx tsx scripts/canal-boat-preview.ts` renders the canal boat. Add `--fishing`
for the commercial boat. `scripts/boating-preview.ts` captures all four subjects
from the actual game factories. These images are model previews, not photographs.
