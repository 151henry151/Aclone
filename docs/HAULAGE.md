# Boats, rescue and haulage

Introduced in 0.109.0. Prices below are Puddlewick defaults; vehicle definitions can be changed in the world editor. Cargo numbers are game weight units, not kilograms or litres.

## Rescue fleet

- **Outboard motorboat: 24s, 4.3 × 1.8 m, 50 cargo, 24 fuel.** A fast open skiff with a stern outboard/tiller, thwarts, fenders, rails and navigation lights. Rod fishing is supported. With an empty tank, ordinary forward/reverse controls row it at a maximum 1.6 m/s. Powered maximum speed is 9 m/s before loading and sea conditions.
- **Canal boat: 60s, 13.5 × 3.42 m.** The existing exposed stern tiller remains. Its price is 2.5 times the previous 24s price. Existing ownership is preserved.
- **Breakwater tug: 140s, 16.8 × 5.94 m, 300 cargo, 512 fuel.** A dedicated coastal rescue tug, with a working wheelhouse, compass, winch, towing gear, heavy fenders and towing navigation lamps. Maximum unladen speed is 5.6 m/s. Towing reduces speed and increases fuel use.
- **Offshore trawler: 24.5 × 7.4 m.** The hull is scaled for voyages measured in game days while its helm, crew, gauges and fittings remain human-sized. Its existing 300s price, 3,200-unit tank and 3,200-weight hold remain. The charter boat is about 14 × 4.8 m; the emergency raft is about 3.2 × 1.9 m and now carries 10 weight.

In Puddlewick, 21 game days are 21 sunrises and sunsets: 12,600 real seconds, or 3.5 real hours. At the fully loaded trawling multiplier, `8.5 / 60 × 1.5 × 12,600 = 2,677.5` fuel units are consumed, leaving about 522.5 from a full tank for transit and reserve. Actual trip duration depends on loading, travel, throttle and conditions. Vessel scale is based on **real three-week voyages**, not on a real 3.5-hour excursion.

### Hiring a tug

Open **Activities → Towing**. The tug owner offers a fee; the stranded captain explicitly accepts it. Acceptance reserves the money in escrow. The tug approaches, stops a hull length ahead, and attaches the towline. The disabled boat follows physically through water; it cannot be delivered from offshore. Bring it into a boathouse or fishing-pier approach and complete delivery to settle the fee once. Cancellation refunds escrow. Reconnection and server restarts preserve the job. Death or an invalid vessel cancels it safely. An owner can arrange a free tow of their own stranded boat using their own tug.

A tow preserves the disabled boat's ownership, fuel and goods. It does not remove the world's death penalties or spoilage rules. Captains cannot change vehicles or leave a live towline attached while boarding something else.

Since 0.112.1, docking measures arrival from the vessel's oriented hull, allowing a large boat's bow, stern or side to enter the approach before its centre does. Delivery checks the disabled boat itself and still requires a clear water path to the berth. It does not move the boat, change its cargo or let a tug deliver from offshore.

Version 0.115.0 **F10 → Rules → Tug rescue offers** sets the suggested fee (200d by
default), maximum fee (100,000d) and unaccepted offer lifetime (600 real seconds).
Inventory quotes the local default and ceiling. Posted fees and expiry survive
rule edits and reloads; accepted jobs do not expire. An expired offer cannot take
payment, and an unaffordable acceptance leaves cash unchanged. The whole accepted
fee stays held until delivery or full cancellation refund. Zero-fee rescues and
free recovery with your own tug remain available. See the
[world rules](WORLD_BUILDING.md#tug-rescue-rules).

### Bringing fuel in the motorboat

Buy fuel cans and drive the motorboat to your stranded vessel. Reboarding appears only when close enough for transfer. Reboard, use the carried fuel, then move your larger boat a hull length ahead of the motorboat and stop. **Attach motorboat tender** secures it astern. Tow both back; bring the tender itself into the landing approach, then secure it. A boathouse stores it inside; a fishing pier leaves it afloat at the berth. The motorboat keeps its own tank contents. Cargo moves with you when reboarding, subject to hold capacity. An offshore tender cannot be summoned to shore through the vehicle menu.

## Eight specialist trailers

Tractors automatically illuminate the rear hitch and ground while reversing with
the engine running, even if the headlights are off. Back toward the drawbar, stop,
then choose **Inventory → Your trailers → Hitch trailer**. That row states the refusal:
still moving, indoors, a passenger, a named activity such as the labour shift or
Ultrakricket, or another trailer parked across the tongue. Leaving the
Ultrakricket pitch on foot, boarding a vehicle, or going indoors drops that game
and frees the seat. Move the named trailer clear, then reverse the rear hitch onto
the drawbar at the front of the one you want. The reversing beam
switches off when stopped, moving forward or the engine is off. World builders can
disable it or adjust brightness and reach under **Rules → Vehicle running costs
and reversing lights**. Nearby reversing tractors share a bounded light pool.

AI residents plan around parked trailers and update their route when one is moved,
stored or left across their path. If a trailer already overlaps a character, move
outward toward its nearest edge to escape; driving farther into it remains blocked.
Residents use the same collision rules and ordinary steering, without relocating
anybody's trailer or changing its cargo.

Buy a trailer at an ordinary tractor garage with a tractor and clear dry space behind it. Use **Inventory → Your trailers**, Activities, or the nearby building window to load, unload, hitch and unhitch. Reverse the tractor hitch to the parked drawbar to reconnect. Trailers remain where parked; ownership and cargo survive reconnects and restarts. Buildings and terrain obstruct the whole trailer, and sharp reversing can jackknife it. Loaded trailers slow the tractor and increase fuel burn. Unhitch before changing vehicles.

- **Harvest hay wagon — 45s.** 6.6 × 2.5 m platform; 600 weight, or 300 hay. Open bale racks, plank deck and tied bales. Other compatible dry goods are limited to 60 weight.
- **Meadow livestock wagon — 36s.** 7.2 × 2.5 m ventilated stock body, curved roof, rear ramp, slatted sides and visible animals. Up to six cattle-equivalents and 240 weight; sheep, pigs and chickens use smaller shares. Loading transfers actual owned animals. Unloading into a farm requires sufficient grazing capacity.
- **Quarry tipping trailer — 42s.** 4.6 × 2.45 m deep steel body, reinforced sides, tipping ram and visible aggregate heap; 1,000 weight of stone, gravel, sand, ore or topsoil.
- **Forester log wagon — 60s.** 5.2 × 2.45 m bolsters, stakes, headboard and restrained logs; 900 weight of logs or sawn wood.
- **Dales liquid tanker — 55s.** 4.7 × 2.35 m tank assembly with bands, access ladder, manhole and outlet valve; 700 water or milk. Empty it before changing liquids.
- **Dales fuel tanker — 57.5s.** The same 4.7 × 2.35 m tank/chassis with amber paint, flammable-liquid placards and a rear hose reel/nozzle; 700 weight of Fuel only. Water and milk still belong in the liquid tanker. At default item settings, 700 Fuel supplies 5,600 tank units: one 3,200-unit trawler refill plus 2,400 spare. Load at a refinery through **Buy into trailer**, then unload into your own inventory or pump directly as needed. World owners can tune purchase price and capacity in **F10 → Vehicles → Fuel tanker trailer**; the garage and cargo panel show the effective values.
- **Parish box trailer — 90s.** 4.4 × 2.35 m covered body, ribbed panels and locking rear doors; 400 weight of mixed dry goods. No livestock, loose liquids or seafood.
- **Harbour chilled fish trailer — 65s.** 4.8 × 2.4 m insulated seafood body, refrigeration unit and drainage fittings; 800 weight of ordinary and large fish, cod, halibut or tuna. Refrigeration is the model's cargo specialization, not a new general spoilage or fuel system.

Dimensions describe the load body; drawbars add about 1.4 m. Chassis rails, leaf springs, tandem axles, tyres, mudguards, brake lines, jacks, rear lamps and reflectors are modeled on every type. Weight and cargo restrictions are checked by the server. Shop trades into/from an attached trailer use the same stock, cash, tax, bulk-discount and investment rules as ordinary trades. Nearby owners can transfer directly to/from their building stock.

A death parks the attached trailer. Its load follows the world's inventory-loss rule; the trailer remains owned. Parked trailers retain their cargo. There is no free Return to town centre shortcut: plan fuel and routes or arrange assistance.

### Roadside fuel service

Open **Inventory → Roadside fuel** alongside an amber tanker. Its owner sets a
price per Fuel in denarii; **0 closes public sales**, while the owner's own
pumping and inventory transfers remain free. Stop outside and finish other
activities, within 15 m and 3 m of the tanker's ground height at defaults. Both
the customer and any tractor towing the tanker must be stopped (at most 0.5 m/s).
Boats can refuel alongside the shore; an airborne aircraft or a passenger cannot
pump. The tanker must stand on dry land.

Choose **Pump into vehicle** or **Buy Fuel into inventory**. Pumping uses at most
the entered quantity and the whole Fuel items needed to fill the tank; each adds
8 tank units at defaults. The final item is charged in full even if only part of
its tank units fits. Inventory buying requires room for the entire quantity.
The default per-transaction limit is 10,000 Fuel. Empty, closed, unavailable or
unaffordable sales are refused without changing cargo, cash or fuel.

Posted prices include normal world and local-town sales tax, measured at the
tanker's location. The owner receives the net amount as cash while online or in
the bank while offline; tax and sales enter the ledger. Parked tankers retain
ownership, price and cargo across restarts. A portable world design includes
parked fuel tankers with their price/load but assigns them to the new world
owner; attached rigs and the other trailer kinds are not copied.

World owners configure sales, offline selling, quantity limits, a shop-relative
price ceiling, resident purchasing and refuelling limits in **F10 → Rules →
Roadside fuel**. The ceiling is off by default. When enabled, it compares against
the cheapest posted Fuel price at any completed shop, even if stock is empty;
a shopless world uses its catalogue Fuel price. Residents may buy one Fuel from
a nearby tanker when no usable fuel shop is within ordinary 18 m trade reach,
provided the tanker price is at most 1.25 times that reference price by default.
They preserve their measured food, drink and shelter reserve and recheck price,
shop availability and reserve before purchase.

### Economic calibration

Representative default price spreads, before tax, fuel, supply/demand and working-capital costs:

- Hay: 300 hay × (14.01d − 9d) = **15.03s** gross per full trailer. Compared with a 120-weight tractor carrying 60 hay, the additional gross is 12.024s; a 45s wagon pays back after about **3.7 additional full-load spreads**.
- Stone: 500 × (11.20d − 10d) = **6s** gross; additional capacity contributes 5.28s, giving about **8 loads** for the 42s trailer.
- Wood: 450 × (23.52d − 21d) = **11.34s**; incremental 9.828s gives about **6.1 loads** at 60s.
- Water: 700 × (14.85d − 13.25d) = **11.2s**; incremental 9.28s gives about **5.9 loads** at 55s.
- Bread: 400 × (74.21d − 66.25d) = **31.84s**; incremental 22.288s gives about **4 loads** at 90s. Buying that full load itself needs **265s** of working capital, and shops may not have the stock or investment to fill/buy it.
- Cod: 200 × (68d − 60d) = **16s**; incremental 13.6s gives about **4.8 loads** at 65s.

These are opportunity comparisons, not promised earnings or automatic income. Scarce stock, travel and business budgets constrain trade. The livestock wagon primarily enables herd relocation and farm expansion; buying and immediately reselling animals is not a profitable loop. Capacities deliberately use game weight rather than real tonnage so trailers fit existing production and storage scales.

## Sources and scale decisions

- [AMSA stability examples](https://www.amsa.gov.au/sites/default/files/2025-02/vessel-stability-guidance-mo504-changes-18022025_0.pdf) include a 16 m trawler operating trips of up to 21 days. [Damen's Shrimp Trawler 2607](https://www.damen.com/vessels/fishing-vessels/shrimp-trawlers/shrimp-trawler-2607) provides a larger 26.45 × 7 m working-vessel reference. Aclone's 24.5 m trawler falls between these references; there is no single required length for a three-week voyage.
- [FAO preservation guidance](https://www.fao.org/4/f0752e/F0752E02.htm) discusses the constraints of preserving fish on longer voyages. Game storage and fuel remain abstractions.
- [Damen Stan Tug 1606](https://www.damen.com/vessels/tugs/stan-tugs/stan-tug-1606) anchors the tug's length, beam, proportions and coastal role.
- [Boston Whaler 130 Super Sport owner's manual](https://www.bostonwhaler.com/content/dam/boston-whaler/technical/owners-manuals/2025/bw-130-supersport-owners-manual.pdf) anchors the small outboard's roughly 4.3 × 1.8 m hull and small tank.
- [Canal & River Trust craft guide](https://canalrivertrust.org.uk/boating/go-boating/a-guide-to-boating/all-craft-great-and-small) supplies canal-boat context. [Cape May charter reference](https://www.gonefishinchartersnj.com/cape-may-fishing-charter-rates/premier-cape-may-fishing-charter-gone-fishin) provides a 44-foot passenger fishing boat comparison.
- [USCG navigation rules](https://www.navcen.uscg.gov/navigation-rules-amalgamated), Rule 24, informs the tug's additional masthead light and yellow stern towing light.
- [Bailey bale trailers](https://www.baileytrailers.co.uk/bale-and-pallet/), [Marshall livestock carriers](https://www.marshall-trailers.co.uk/range/livestock-trailers-containers) and [tankers](https://www.marshall-trailers.co.uk/range/tankers), [PALMS 6S forestry trailer](https://www.palms.ee/forest-trailers/palms-6s), and [Brian James trailer specifications](https://www.brianjamestrailers.co.uk/uploads/190095/09a5_specs_-_all_ranges_-_en.pdf) inform trailer dimensions and construction details. Models are original procedural artwork, not downloaded manufacturer models.

## Roads and location changes

New road projects penalize climbing and steep grades, round safe corners and add restrained seeded variation. Existing unobstructed roads stay in place. Runways do not count as roads or road connections; disconnected lanes reconnect around them. Long routes use a coarser initial search and validated local clearance, fixing the search exhaustion that prevented cape-lighthouse access roads from being planned. Building, pasture, cliff, runway and town-permission restrictions remain in force.

Growth remains **12 metres per game day**, shared between projects; long lighthouse routes take time. On the release's live-world snapshot, completing the queued bypass and hangar approach allowed both cape-lighthouse routes to be built. No roads were instantly laid on the live server for that test. The spaceport relocates about 1.25 km from Puddlewick centre; see [spaceport details](SPACEPORT.md).

For visual QA run `TEST_GPU=1 node --import tsx scripts/rescue-fleet-preview.ts` and `node --import tsx scripts/backlog-walkthrough.ts`. Both operate locally; the walkthrough creates and removes its own temporary world and records actual UI interactions.

## Canoes

The portable canoe carries one paddler and 12 weight at 1.2m/s by default, with no
fuel or engine. Buy one at a carpenter or boathouse, craft from Wood at a carpenter,
or lift one carried as inventory. Overhead carrying is slow and blocks vehicles,
fishing, gathering and construction until you set it down. Use Inventory to launch
from any clear bank, paddle through shallow narrow reaches, and beach without a
dock. A beached canoe stays moored at that bank and can be boarded or picked up;
ordinary boathouses, piers and river docks work too. Cargo travels with the paddler
when stepping ashore. Home storage defaults to two hulls.

F10 → Rules → Portable canoes governs price, weight, wood cost, carrying speed,
home limit, pickup ownership, paddling/hold limits and shore access. Death afloat
uses the ordinary boat loss/recovery and cargo-spoilage rules. Set-down land
property instead survives boat-loss deaths unless separate land-hull loss is on;
carried and home-stored hulls follow inventory and property rules respectively.
See [Playing Aclone](PLAYING.md#portable-canoes) for the controls and
shore limits.

## Coastal freight

Buy the **Coastal cargo boat** at a boathouse. Its default price is **240s**:
a 60 × 16.8 m coaster with a **2,000-weight freight hold**, **320-unit tank**,
**6 m/s** maximum speed and **0.008 fuel units/s** full-throttle burn. It requires
the Captain skill where that rule is enabled. The wheelhouse has working
instruments, and pallet loads appear as the hold fills. W/S adjust persistent
throttle; B sets it to idle, F4 switches the engine, and C changes camera.
Its hull has 3.6 m freeboard and a 3.75 m draft. The chase camera frames the
whole ship; crew stand on its side decks. People, fittings and individual pallets
remain human scale. Length, beam, draft and freeboard are editable per world.

The captain's **60-weight personal allowance**, including shared provisions,
is separate from freight. Store meals and drinks through Boat provisions & crew;
food in the freight hold is merchandise and does not automatically feed anyone.
The default dry hold follows the enclosed trailer's cargo policy: ordinary dry
goods and packaged Fuel are accepted; livestock, loose water/milk and seafood
need a suitable specialist policy. World builders can change the policy and
capacity in Vehicles.

At a stopped, compatible berth, open **Inventory → freight hold** to load or
unload personal cargo, transfer an owned nearby stockroom, or buy/sell directly
with a nearby shop. Shop reach is measured from the **shore entrance**, default
30 m. Both boathouses and the fishing pier work; freight quays provide dedicated
alongside berths. Large hulls use water outside the existing structure; the berth
may search up to 30 m farther seaward for sufficient depth. Boarding or mooring
is refused if any part of the hull is shallow, obstructed or occupied. A deeper
ship may need a different landing even when a small boat fits. The coaster exceeds the default river dock's 14 × 3.6 m limit.
A world builder can give the existing canal boat a separate hold for river freight;
there is no new river-barge class in this release.

Transfers take **10 weight per second** by default: a full hold takes 200 seconds.
Cancel before completion to leave all stock and cash unchanged. Completion
rechecks ownership, landing, range, cargo suitability, space, price, stock and
payment. A changed quote cancels the trade. Shops still need actual goods to sell
and investment to buy; ordinary discounts, tax and existing emergency-import
rules apply. Parish supply orders and supply intents still use their existing
inventory delivery path, not direct hold settlement.

Freight stays aboard when you step ashore, including at boathouses, and survives
save/restart. Boats left at quays remain visible. Ordinary death, stranded-vessel
recovery and cargo-spoilage rules apply. At river docks, a compatible authored
freight vessel uses the same transfers, carried-Fuel refuelling and existing
upriver rescue/reboarding flows as other boats. World-design export includes
only the world author's moored freight, remapped to the new world's owner;
other players' cargo and active inventories remain private. Full database backups
retain everyone's property.

### Build a freight quay

Choose **Build → Freight quay** on a dry, gently sloping coast and rotate the
wharf toward deep water. Defaults are **24s plus town construction tax**, then
**80 Wood, 100 Stone and 20 Steel** delivered as construction materials. The
28 m open wharf has a timber access gangway, bollards and fenders, with a 28 × 8 m
base survey area requiring **2 m depth at low water**. Larger vessels lie outside
that area and must pass their own full-hull depth and obstacle checks. The default
vessel limits are **60 m long × 20 m beam**; World Builder can change both limits
and the maximum extra seaward search (zero disables it). The 3.75 m-draft coaster
needs deeper water than the basic survey minimum. There is no lifting hall.
The preview refuses shallow, obstructed or inland-facing sites. Quays board
already-owned compatible boats; buy a new boat at a boathouse.

### Crew and a measured trade route

Up to two consenting deckhands can join using the existing profit-share offers.
Sales pay the captain immediately. **Settle freight shares & put crew ashore**
pays agreed shares once from realized sale receipts minus the sold goods'
acquisition cost and consumed fuel/provisions. Unsold goods retain their cost
basis with the vessel. Personal or owned-stockroom loads use world-catalogue
replacement prices; direct hold purchases record the actual discounted price.
No shares are paid on a loss, and settlement refuses if the captain has spent
the cash needed to pay them. Maintenance remains a separate operating cost.

The reproducible authored example in `tests/cargo-boat-routes.test.ts` uses a
funded quarry and mason at quays 4 km apart, with 1,000 Stone (2,000 weight).
The purchase costs **97s** after the ordinary bulk discount; the buyer pays
**112s**. The loaded outward trip and empty return use about **10.69 fuel units**
(**60.14d** at the departure quote), incur **5.42d** maintenance, and pay a
20% deckhand share of **287.97d**. Net is about **11.46s**, taking roughly
29 minutes including loading/unloading. At those conditions the 240s hull pays
back in about 21 trips, excluding the trader's working capital. This is an
authored test route, not a promised live-world earning: prices, stock, funds,
weather and local rules govern actual returns.

At full loads the coaster uses less fuel per weight-distance than all six default
tractors with tipping trailers; its advantage is bulk coastal work, not speed.
An actual movement-physics circuit around the expanded island covers about
**164.85 km**, uses **230.67** of the **320** tank units and leaves approximately
**28% reserve**. That approximately eight-hour circuit measures the hull's range;
provisions and maintenance still require planning. Forty default Fuel cans fill
the tank and fit the captain's personal allowance.

## Livestock and meat deliveries

The Meadow livestock wagon carries calves, lambs, piglets and chicks at half the corresponding adult pasture share by default. Age and healthy growth progress travel with them; growth resumes only under farm care. It also accepts the raw meat and optional compost returned by a butcher. Back alongside the loading ramp, stop, open the butcher and choose an adult from the wagon. Keep enough output room and cash until completion; cancel or leave without losing the animal or paying the fee. Young cannot be slaughtered.

The ordinary wagon and personal inventory are unchilled: raw meat normally expires after two game days. A fish trailer or fish-policy freight hold keeps meat cold; butcher, kitchen, café, pub and inn stocks also refrigerate it. Load age survives transfers, mooring, recoverable rescues and save/reopen. A world design that includes its owner's moored freight preserves young growth and meat age on the recipient world's clock. General box holds do not accept live animals; configure a livestock hold for those deliveries. Cold storage pauses age without refreshing it. Finished meals follow the existing food-storage rules.

## Manufactured highway haulage

Highway tractor units cost 600s at the world default. Full-size box, refrigerated
and stake semitrailers cost 280s, 370s and 290s respectively; actual factory asks
may differ. They are finite manufactured units, not unlimited garage stock.
See [manufacturing and collection](PLAYING.md#automotive-assembly)
and the automotive rules in [World Building](WORLD_BUILDING.md).

A controlled, funded replay supplies a full box trailer with **1,500 Steel**
(3,000 weight). A staffed mill consumes **7,500 paid Ore**, pays its workers and
takes **250 production hours**, plus **12.5 hours of handling** as the output is
collected. The haulier then drives roughly **2.08 km**, including a steered U-turn
and empty return, in about seven minutes under conservative resident control.
The buyer has funds for exactly this one load and ends with no remaining till.
At the replay's observed 220d supplier ask and 249.21d buyer bid, realized trading
margin is **438.15s**. Provisioning replacement fuel and distance wear leaves about
**438.00s**. The supplier's combined owner/business cash rises **813.75s** after
its paid inputs and payroll. These are finite test trades, not live guarantees.
The large margin takes about **262.6 real hours** including production/handling:
roughly **1.67s per hour**, not hundreds of sheckles every seven minutes. Engines
are off while waiting for the mill. New mines, mills, customers and working
capital are needed to increase supply; trucks do not remove those constraints.

The factory replay completes twelve units with six paid engineers, sells eleven
and retains one unsold Stake semitrailer. Ten bounded exports and one paid local
buyer leave **295.25s** of realized owner/business contribution after the inputs
and payroll for all twelve units. This excludes haulage and recovery of the
factory's **2,775.65s** default cash/material construction bill before local tax.
Assembly uses 16.5 fully staffed hours; export quotas add waiting. Unsold vehicles
are assets, not realized sales. No idle subsidy or automatic sale clears them.

These results preserve the reason to use ordinary tractors for affordable small
loads and poor access, and boats for coastal bulk routes. The new rig needs a
large initial investment, a clear full-width road, turning space and funded
customers. Tests cover its 45 mph dirt and 65 mph paved limits separately; the
resident replay does not assume continuous top-speed travel. Replacement fuel and
service figures are cost provisions based on actual consumption/distance, while
all cargo purchases, wages and sales in the replays use ordinary paid actions.

## Garage storage for haulage fleets

Store trucks, tractors, earthmovers, trailers and complete rigs at Spanner & Sons
or your own buildable vehicle-storage garage. Stop, park and step out, then use
Vehicle storage in the garage menu. Default storage is unlimited; world rules can
set a unit limit. Retrieval places an unoccupied vehicle/rig in safe clear space
outside. Cargo, refrigeration and hitches persist, but cargo cannot be used at its
old outdoor position while stored. Food still ages normally. See
[garage storage](PLAYING.md#garage-storage) for permissions and handling range.
