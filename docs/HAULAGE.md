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

### Bringing fuel in the motorboat

Buy fuel cans and drive the motorboat to your stranded vessel. Reboarding appears only when close enough for transfer. Reboard, use the carried fuel, then move your larger boat a hull length ahead of the motorboat and stop. **Attach motorboat tender** secures it astern. Tow both back; bring the tender itself into the landing approach, then secure it. A boathouse stores it inside; a fishing pier leaves it afloat at the berth. The motorboat keeps its own tank contents. Cargo moves with you when reboarding, subject to hold capacity. An offshore tender cannot be summoned to shore through the vehicle menu.

## Seven specialist trailers

Buy a trailer at an ordinary tractor garage with a tractor and clear dry space behind it. Use **Inventory → Your trailers**, Activities, or the nearby building window to load, unload, hitch and unhitch. Reverse the tractor hitch to the parked drawbar to reconnect. Trailers remain where parked; ownership and cargo survive reconnects and restarts. Buildings and terrain obstruct the whole trailer, and sharp reversing can jackknife it. Loaded trailers slow the tractor and increase fuel burn. Unhitch before changing vehicles.

- **Harvest hay wagon — 45s.** 6.6 × 2.5 m platform; 600 weight, or 300 hay. Open bale racks, plank deck and tied bales. Other compatible dry goods are limited to 60 weight.
- **Meadow livestock wagon — 36s.** 7.2 × 2.5 m ventilated stock body, curved roof, rear ramp, slatted sides and visible animals. Up to six cattle-equivalents and 240 weight; sheep, pigs and chickens use smaller shares. Loading transfers actual owned animals. Unloading into a farm requires sufficient grazing capacity.
- **Quarry tipping trailer — 42s.** 4.6 × 2.45 m deep steel body, reinforced sides, tipping ram and visible aggregate heap; 1,000 weight of stone, gravel, sand, ore or topsoil.
- **Forester log wagon — 60s.** 5.2 × 2.45 m bolsters, stakes, headboard and restrained logs; 900 weight of logs or sawn wood.
- **Dales liquid tanker — 55s.** 4.7 × 2.35 m tank assembly with bands, access ladder, manhole and outlet valve; 700 water or milk. Empty it before changing liquids.
- **Parish box trailer — 90s.** 4.4 × 2.35 m covered body, ribbed panels and locking rear doors; 400 weight of mixed dry goods. No livestock, loose liquids or seafood.
- **Harbour chilled fish trailer — 65s.** 4.8 × 2.4 m insulated seafood body, refrigeration unit and drainage fittings; 800 weight of ordinary and large fish, cod, halibut or tuna. Refrigeration is the model's cargo specialization, not a new general spoilage or fuel system.

Dimensions describe the load body; drawbars add about 1.4 m. Chassis rails, leaf springs, tandem axles, tyres, mudguards, brake lines, jacks, rear lamps and reflectors are modeled on every type. Weight and cargo restrictions are checked by the server. Shop trades into/from an attached trailer use the same stock, cash, tax, bulk-discount and investment rules as ordinary trades. Nearby owners can transfer directly to/from their building stock.

A death parks the attached trailer. Its load follows the world's inventory-loss rule; the trailer remains owned. Parked trailers retain their cargo. There is no free Return to town centre shortcut: plan fuel and routes or arrange assistance.

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
