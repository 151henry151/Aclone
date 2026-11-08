# Playing Aclone

Start with a pilot name; keep its private recovery key and set a password in **Pilot & preferences**. Verified email recovery requires host mail setup. See [controls/FAQ](FAQ.md) and [touch controls](MOBILE.md).

After choosing your pilot name, select **Puddlewick — Main world**, recommended
for new pilots, then **Land on this world**. The landing button appears before
the full rules and galaxy map. Expand **World rules & settings** to inspect a
world's rules; player-created worlds are labelled separately. Other systems
also have server-hosted worlds, and you can still create your own parish.

Pilot name tags are compact single-line labels. By default they fade between
20 and 40 metres from you and disappear beyond that; AI neighbours keep their
**AI** suffix. Scenery view (**H**) hides them. Each world can set its own name-tag
visibility, distance, size and opacity.

## Your first day

1. Drive to the Odd Jobs Office; E/Ctrl opens it. A 15-second labour shift pays 12d for the first eight in a row, then less until a ten-minute break or some other work, and at most 200d of ordinary pay per game day. Below 50d combined cash and bank, meal relief pays 150d at most once per 30 minutes and does not count toward that cap. The button shows your current payment.
2. Buy bread/water at Harbour stores. Puddlewick automatically eats and drinks from your inventory while you are signed off, and you eat and drink yourself while signed in; other worlds may consume inventory online too, or require manual use throughout. Beer and wine are never consumed automatically in any world unless its owner turns that on. Variety reduces repeat-food penalties; keep fuel reserves too.
3. Learn a profession at school: first qualification 80d/one real minute, later ones 160d/40 minutes, subject to skill limits.
4. Take a job, or buy a business, stock inputs and fund wages. Puddlewick employment continues offline without renewal; other worlds may require **Work two cycles**. Qualified Puddlewick owners operate their factories unpaid. Actual successful production pays employee wages; signing up alone does not.
5. Keep provisions in inventory or your selected cottage/private rented room before logging off. Puddlewick feeds you from these supplies anywhere, even without a house. Going inside reduces hunger/thirst drain by 20%; other worlds may choose different rules. Hunger, thirst and starvation still continue offline if supplies run out. **Go outside** restores movement.

Your employer and shift countdown appear in the player-status sidebar; the building panel also shows
covered production checks. You can drive away while a shift runs. Renew during its
last cycle or when it ends. In a shortage, Puddlewick's **Government necessities**
shop keeps paid premium bread, water and fuel on the shelf and restocks them;
fuel costs more than typical pumps or the harbour. You can still buy if
displayed stock is briefly zero.

Shop rows show **You have** with your carried quantity. **Sell all** sells that stack in one click; if buying funds, storage or the world transaction limit (10,000 items by default) prevent that, **Sell max (N)** shows the accepted quantity and explains what stays with you. These counts update while the shop is open. Ordinary Buy/Sell buttons still use **Quantity per trade**.

Repeated buys/sales of the same item at one shop show the confirmed total quantity
and price, including when you close the window. Failed trades do not add to it;
changing goods, direction, shop or visit starts a new total.

When reversing a wheeled vehicle, steering follows actual backward speed, including while braking.

There is no free return-to-town shortcut. Plan for the return journey's fuel and provisions.
If stranded on land, walk for supplies or ask another player to bring fuel; at sea, use the
boat recovery options. Genuine bugs can still be handled by a caretaker.

State is server-saved; a new name creates a different identity. [Account recovery](FAQ.md#how-do-i-set-a-password-or-reset-it-by-email) and [hosting/backups](HOSTING.md) explain protection and limits.

## Biplane flight

The [flight guide](FLYING.md) explains persistent throttle, independent rudder and
ailerons, takeoff, stalls, gliding and safe landing. The HUD and F7 help show the new
controls. These controls replace the earlier automatic-climb system introduced before 0.91.0.

## Beer, wine and intoxication

Repeated beer or wine consumption makes steering drift and respond less accurately. Wine is stronger; effects accumulate rather than resetting between drinks. Increasing intoxication adds slow scenery sway/warping, blur and double vision; menus and chat stay sharp. Walking keeps normal controls but still has visual effects. The HUD shows **Tipsy**, **Drunk** or **Very drunk**.

Only time sobers you up, including time offline. From the maximum level, steering impairment clears in about 15 real minutes and all alcohol clears in 20; water relieves thirst without instantly curing intoxication. These are game rules, not real alcohol measurements. Death starts a sober new life. Homes prefer nonalcoholic provisions but will use beer/wine if those are the only drinks stocked.

**F9 → Options & pilot key → Drunk visual effects** cycles Automatic, Reduced and Off. Automatic respects your device’s reduced-motion setting. Reduced removes motion/double vision and retains mild softening; Off removes visual effects. Neither changes server-side steering impairment.

## Contextual controls

Building **Stockroom** and **Building Admin** tabs appear for properties you own. Use **Investment** to fund someone else’s business and collect earned returns. Movement controls show alternatives to your current vehicle and disappear indoors or while busy; a flying robocrow offers **Return to body**. Activity controls appear when relevant.

## Timed tasks

Labour, gathering and harvesting lock movement while a large centered countdown shows progress. Menus temporarily hide it; completion clears it. Disconnecting does not cancel accepted work or duplicate rewards. Starting a harvest closes its panel. If the timer reaches zero before server confirmation, **Finishing…** remains until completion; no extra click. Pending loads can require cargo space before delivery.

## Gathering resources

Use **Resources** or **M** to find finite woodland, stone, gravel and topsoil grounds outside town. On large maps such as Puddlewick the countryside holds hundreds more: timber in the woods, stone on high ground, gravel and topsoil on the lowlands. **Resources** lists the forty nearest; the maps show the rest. Approach within 10m for a direct HUD **Gather** button, reserve count and tool/cargo feedback. No menu is needed. By default logs need a chainsaw, stone a pickaxe, and gravel/topsoil a shovel. World rules may choose another gathering implement or none; Resources and the nearby refusal show local requirements. Buy required tools from Harbour stores, the spaceport or the garage. Workshop tools are for furniture, not digging. Scenic trees are not individually cuttable.

World gathering rules set load size and duration. Defaults are 3 units in 20 seconds untrained, or 6 in 12 seconds with forester (wood) or excavator (minerals/soil). The HUD and Resources menu show the local rate. Started loads retain their reserved amount and finish time after rule edits. The right implement is reusable. Capacity and recovery pace also follow world rules; increasing capacity leaves the new room to refill normally. Shared reserves, regrowth, obstruction and production chains are in [Economy](ECONOMY.md#gather-deliver-produce).

Untouched grounds look natural: timber stands with windfall, weathered stone,
gravel hollows and eroded soil banks. By default a small earth footpath marks
sites near towns or recently worked; tools are carried in your inventory rather
than left at each site. A world builder can choose completely natural scenery or
restore the old worked-site models. Appearance does not change the resource icon,
required implement, yield or remaining reserve shown by Gather.

Open **Inventory** to use supplies or **Discard 1** unwanted item. Discarding is permanent and pays nothing; sell or store goods when possible. If an empty tractor tank leaves too much cargo to switch to walking, discarding surplus frees capacity.

## Reading the terrain map

Open the parish map with **M** or by clicking the minimap. Shorelines follow the
terrain with smooth edges. **Contours: on/off** toggles the topographic overlay
and remembers your preference in this browser. Thin lines mark every 10 metres
above sea level; stronger, labelled lines mark every 50 metres. Closely spaced
lines show steep slopes; wider spacing shows gentler ground. Zoom in to inspect
local hills, or zoom out to compare routes across the island. Roads, town borders,
waypoints and building markers remain visible above the terrain overlay.

## Fishing at the dock

Buy Fishing tackle at a boathouse or Harbour stores and visit the dock in a fishing-enabled world. Its deck supports vehicles. Click it or press **E/Ctrl** for the fishing panel; centered **Cast a line**, **Reel in** and **Stop fishing** also work without Activities. Wait for a bite and reel within eight seconds (button or **F3**); cargo space is required. Missing the window returns to waiting. World rules set base mean waits (ordinary shore 75s, anywhere-mode shore 20s, coastal boat 65s, deep boat 225s by default); boat depth adjusts them. Deep catches share trawling’s world depth/shore limits (default 8m/150m). Scheduled bites keep their deadlines after rule edits. Stop fishing to move again. Controls float separately from chat on desktop and phones. While fishing, press **H** for scenery view: a compact bottom button stops fishing while waiting and becomes **Reel in** during a bite. **F3** also reels; **H/Escape** restores the HUD.

## Finding your way

**M** or the minimap opens the enlarged parish map; M/Esc closes it. Named buildings/resources, roads and player markers update live. Pan by dragging/swiping or focus the map and use arrow keys; zoom with +/−, the mouse wheel or a two-finger pinch. Zoom out below 100% to see the whole world (on Puddlewick, an 89 km square); names hide as you zoom out, and you can still click the ground for a waypoint. Below 25% zoom, buildings inside a town fold into that town's name, and a building outside every town stays clickable. **Find me** centres your marker; **Fit parish** resets bounds. On large maps the sheet shows the real coastline and lakes; once you are out in the countryside, **Find me** opens a local sheet about 640 m across centred on your tractor, and the HUD minimap follows you instead of staying on the village. Puddlewick's travel boundary is an 89 km square of open sea around a mainland about 35 km across and about 42 km from north to south. Beyond the original town footprint, broad hills and smaller rolling rises reach roughly 170m on Puddlewick. Harbour foothills ease down to the shore; compact worlds and custom heightmaps keep their terrain. Gold shows you/heading, pale blue other players, green unobstructed resources (not necessarily stocked). Each resource label has a line pointing to its actual gathering ground; follow the marker, not the displaced label. Distant terrain uses less detail to keep neighbouring towns grounded, with longer views in ordinary weather and reduced visibility in storms. Town-centre fountains use level retaining bases and benches meet the local slope. Travel to a building to use it (within 18m). Long names remain available in details/tooltips. **Waypoints:** click a building or resource name, or empty map ground. Keyboard users can pan then **Mark centre**. A gold marker appears on both maps; the driving HUD points toward the destination relative to your current camera view and shows distance, with an arrival notice within 10m. This is a straight-line guide, not autopilot or a road route. Clear it on the map or with × beside the HUD arrow. Your browser remembers one destination per world. The separate **Parish directory** lists distances and is accessible from map, journal and menu.

## Sound

Sound starts after a click/tap/key; mute and volume persist in **Pilot & preferences**. Check browser/OS volume too. **F4** toggles engine, **Space/Parp** honks. Engines idle/rev, nearby vehicles/horns pan with direction and fade with distance; homes muffle outside sound. Walking, no fuel, indoors, disconnect, hidden tabs and space silence relevant motors/ambience. Returning plays current sounds, not missed horns.

Supplied mills/sawmills/workshops/furnaces/pumps make distinct machinery sounds. Missing inputs, full output stores, unfunded wages or unfinished construction silence them; unattended production is quieter. Manual forge tasks also sound while their worker is online. Sound follows production, not chimney occupancy.

**Map travel boundary:** a dashed border marks the world's travel limit, with darker shading outside it. You can mark destinations throughout reachable open water; selecting beyond the border places the waypoint on the nearest edge. Coastlines and contours load in the background while map controls remain usable.

## Time and weather

Outdoor walkers automatically unfold a white umbrella with a hot-dog-and-tomato print when rain begins, and fold it when rain ends. It uses the left hand so the flashlight remains available. Drivers, boat passengers and characters at home keep it put away; it is a visual rain shelter, not a new consumable or survival bonus.

A game day is **10 real minutes**; the default 365-day year is **60h 50m**.
New worlds start in spring. Default spring/summer last 92 days each, autumn 91
and winter 90. Owners can change year length and seasons in Calendar rules;
check the local date before planting. Calendar edits can immediately trigger
winter crop losses and change daylight/weather. Future ageing follows the local
year. Crop growth still uses game days; signed loans keep their agreed timing.
Changing/freezing the decorative clock does not accelerate crops or ageing.
Default visual midnight matches date change.

Sunrise/sunset vary by season. Clear moonless nights have faint starlight; full moons reveal terrain. Clouds/horizon reduce natural light; overcast moonless countryside is very dark. Use **L/headlights**. Streetlights run all night; occupied-house windows shine until varied bedtimes. Occupants left inside keep chimney smoke even offline; workplace chimneys smoke when an employed player is online, within 18m and on an active shift.

Moon phases and lunar tides share the world's **F10 → Rules → Calendar** lunar
period (default 28 game days). Changing it can change the current phase and tide;
zero tidal range still keeps sea level fixed. The decorative clock does not
reset moon phases.

**Snow and storms:** Weather has variable storm starts, lengths and strengths. Lighter snowfall is common; heavy, long storms are rarer. Each winter has its own random storm frequency, so mild and severe winters emerge without a fixed schedule. Weather is seeded by world and date and survives restarts without rerolling.

World owners can tune seasonal rain/snow chances, storm thresholds and snowfall
rates in **F10 → Rules → Climate**. The descriptions here use the defaults;
check your world's rules for local values. Edits affect current weather and
future accumulation without clearing snow already on the ground.

For northern-island mountains, **F10 → Rules → Alpine climate** also sets the
permanent snow line (default 1,180–1,390 m above sea datum) and can disable
permanent summit cover. Seasonal snow remains; nearby slopes and distant peaks
use the same local settings.

Winter starts with bare ground unless snow is already lying. Snowfall gradually builds a visible layer, raising the ground surface around vegetation and tyres. Most showers add a few centimetres; depths over **15 cm (six inches)** are exceptional, targeted at roughly one heavy episode every two game winters, not guaranteed on a schedule. Successive storms can still stack. The first **4 cm** deposited in winter form a base that stays until spring. Extra depth melts only during clear daylight, never overnight, in rain or under overcast skies. One fully sunny game day melts about **6 cm**; a rare 20 cm pack returns to its winter base after about three fully sunny days. Cloudy spells prolong it. Spring releases the base to thaw gradually rather than switching it off. The HUD shows depth; the mobile calendar includes the full weather report. Frozen-night worlds do not thaw; a frozen sunny clock continuously supplies sunlight.

Trees, rocks and other land vehicles are solid when the world's contact rules
are enabled. A tractor stops at a trunk or boulder without collision damage,
condition loss or a fuel penalty. Walk around trunks; their crowns do not block
you. Driving into a stationary or slower vehicle stops you without pushing it;
a head-on contact stops both drivers. A shallow side contact can slide at reduced
speed. Worlds may disable contacts or choose stop-only behavior, so check the
local rules. Engine-off parking may be refused at arrivals, town centres, gates
and jetties; park beside the route. Offline drivers stop blocking after the
world's configured timeout, and people at home are excluded. If a rule or scenery
change leaves you inside an obstacle, move outward to escape.

Roads shed snow and stay visible, with wet-road speed/grip rather than deep-snow drag. Relative to a dry road, tractors reach about **90%** speed on dry ground, **68%** in fully wet mud, **40%** in the ordinary 4 cm snow layer, **10%** in a metre and approach **6%** in extreme drifts. Road/verge transitions are gradual. Players and NPCs share these limits, including reverse and boosted driving; aircraft do not inherit ground drag. Walking now uses the same snow factor, including Shift: open 4 cm snow allows about **40%** of ordinary walking/running pace, and a metre about **10%**. Clear roads retain near-full wet-road pace, with a gradual 2 m verge transition. Bare-ground walking is unchanged. Residents on foot follow the same limits. Owners can disable walking snow drag or change its field strength in **F10 → Rules → Walking in snow**.

Tractors tilt with the terrain under their tyres, including when parked on a hillside. Uphill travel and acceleration slow motor vehicles; downhill travel gains up to 30% over the current surface speed. Reverse follows the actual travel direction. Tractors leave fading tyre prints in mud and off-road snow. Snow tracks show compressed channels with lit shoulders and tread impressions; their shading follows the snow depth and softens as the pack melts. Snow lifts the existing terrain mesh; batched detail adds physical roof caps, roadside banks and drifts at walls, tree trunks and fences. These layers follow the reported depth and fade with the surrounding snow as it thaws; ordinary snowfall produces centimetres of buildup, not metre-high banks. Tracks and contact shadows follow the raised surfaces, while road lanes remain exposed. Deciduous trees tint in autumn, while evergreens stay green. Snowpack and wetness persist through reconnects and server restarts. On upgrading, old natural snowpacks above 12 cm are reduced to 12 cm once; future storms are not capped. Creator-forced snow and snowstorms retain their continuous snowfall rates and can deliberately produce much deeper packs.

Stars move nightly/seasonally. Two nearby moons (one about half-size) share a 28-day phase cycle (4h 40m), with a five-day mutual orbit; neither resets at year boundaries. First-person and chase camera drag look up and down. The calendar follows supplied historical information; climate, crop durations and balance are original tuning.

## Alternate road routes

Once required connections and property access are served, crews can add useful
shortcuts between towns and the spaceport. They compare the shortest existing
road journey with a fully surveyed route, including obstacles and river crossings.
The default requires both 20% and 100 m saved, and rejects routes that mostly
parallel an existing road. Construction shares the normal daily allowance; the
old roads stay available and unfinished work survives a restart.

In **F10 → Rules → Roads and river crossings**, world builders can switch alternate
routes off or change the savings and parallel-road limits. Changing these rules
discards an unfinished optional proposal for a fresh survey; already laid roads
remain. An efficient network may receive no new route. City paving and bridges
are still planned.

## River roads

Growing dirt roads can search for shallow fords and safe approaches when connecting
settlements across rivers. Crews build gradually; unfinished roads and construction
progress survive a restart. Deep water, steep banks and blocked lanes still stop a
route. A new crossing does not remove an older usable road. World builders can
change growth, width, grade and water-depth limits in **F10 → Rules → Roads and
river crossings**. Lowering the depth limit can make an existing ford impassable;
the road itself remains. This does not add bridges or paved river crossings.

## Water supply

Build a **Desalination plant** on a dry ocean shore, with its submerged intake behind it. New plants require water connected to the sea, so an enclosed edited pond does not qualify. Existing plants keep their original height-only intake survey; their stock, ownership and recipe stay intact. World owners can disable the ocean requirement for custom geography.

## Springs and pump-houses

Natural springs appear as mossy wet hollows with reeds, stones and a downhill trickle. Most are in the northern uplands; every river starts at a headwater spring. The parish map shows droplet-ring symbols at 50% zoom or closer. Stand on foot within **3 m**, open **Inventory**, and choose **Drink from the spring**. It quenches like one Water, with the same repeated-drink rules and a **20-second cooldown**. It does not create an item.

A **Pump-house** makes bottled Water from a spring, river or pond. Its standard foundation costs **900d**, plus **6 wood, 6 blocks, 1 steel and 4 gravel**; finishes and sizes alter the quoted bill. Choose one of five architectural models in Build. Rotate the intake toward fresh water. Near a spring, the preview snaps the building so the intake touches the saved source; move close to that final foundation before placing it. Each spring supports one pump. River/pond intakes reach **6–10 m** behind a dry foundation, need **0.4 m** water depth, and keep the foundation **0.3 m** above local water. Pumps on the same river need **60 m** between them. Their intakes do not reserve a river reach, so ordinary docks and fords remain available.

Train **pump operator**, deliver the materials, fund wages and stock Fuel. A normal pump batch uses **1 Fuel → 20 Water**, with two ideal employees and the usual stockroom, ownership and staffing rules. World builders may enable gravity-fed spring pumps (**no Fuel → 8 Water**) and scale spring output by flow. Headwaters have the strongest default flow. Coastline sites require a desalination plant instead; it remains **1 Fuel → 12 Water**. A removed or moved spring, dry intake or flooded foundation pauses pumping and explains why in the building panel. Existing pumps never silently switch to another source.

Cost: **1,200d plus construction tax**, then **8 timber, 8 blocks, 2 steel, 6 gravel**. Deposit fuel and wage capital; hire a **pump operator** (owners cannot employ themselves). A full-speed ten-minute batch consumes 1 fuel, pays the posted wage (default 22d gross), and produces 12 water. Dry intake/flooded foundations stop production/sound without consuming inputs/payroll; fixing terrain resumes it.

Water sells at 5d; local processors/lodging bid 5.60d. Harbour imports remain available. Construction grants no supplies; Puddlewick's seeded service is the exception described [below](#puddlewick-services). [Economy](ECONOMY.md) covers margins.

## Farming

Farm owners can set **Staff planting & spending** rules in the farm menu: approved crops, a daily seed/fertilizer cash budget, and a protected till reserve. These affect both player and NPC employees. Clear every crop checkbox to pause new staff planting. Existing crops remain harvestable; the owner can still tend plots personally. The budget covers cash purchases, not stored supplies or wages, and resets every ten real minutes (one game day).

Learn **farmer**, then own or work at a farm. Water, compost, gravel and topsoil for farm care come from its stockroom first, with carried supplies covering any shortfall. Staff can use these supplies for farm tasks without withdrawing them personally. Each starts with four plots; Main provides plant/water/fertilize/harvest, Building Admin funds seeds/wages, Stockroom lets owners load produce. In winter, a notice explains that planting resumes in spring; empty crop menus are replaced with resting plots. All unharvested crops die when winter begins, including ripe crops. Finish a 15-second harvest, or Harvest all if its longer wait still ends before winter, before the season changes. Stored produce is safe; cleared plots retain drainage and can be replanted in spring.

- **Hay grass:** spring/summer/autumn, 10 days (1h 40m), grass; baled forage for cows/sheep. Wet weather reduces the dry-hay yield; drainage helps.
- **Wheat:** spring/autumn, 18 days (3h), grain; flour/bread.
- **Potatoes:** spring/summer, 12 days (2h), root; meals/compost.
- **Hops:** spring/summer, 30 days (5h), vine; beer.
- **Grapes:** spring, 48 days (8h), vine; wine.
- **Tea:** spring/summer, 36 days (6h), leaf; packed tea.
- **Coffee:** spring, 60 days (10h), bean; roasted coffee.

Owners can buy four adjoining plots from the farm's Main panel: **150d**, then **250d**, then **350d** and 100d more per subsequent parcel, up to the world’s plot limit (default **16 plots**). Lowering the limit preserves purchased land and crops. This uses personal cash, not the farm till; no farmer skill is needed to buy land. New parcels extend beside the existing fields and require dry, level, unoccupied land clear of roads and no-build zones. Expansion preserves crops and stays with the property on sale or death. Nearby buildings cannot be built over reserved fields. Seed costs and harvest labour still apply to every plot.

Seeds draw farm investment. Irrigation follows world rules: by default each treatment costs 3 water, up to three per crop, using farm stock before carried supplies. Moisture combines rain, watering and crop thirst; its default yield factor is 60–100%. One compost fertilizes for the world bonus (default +33%); lacking compost buys imported fertilizer at Harbour's default compost price. Repeating a crop family applies the world penalty (default 20%); rotate or restore soil. [Economy](ECONOMY.md#crops-and-soil) explains drainage/restoration.

Yield estimates use the world's weather calendar. World rules set each crop’s frost sensitivity and maximum yield loss; the start of winter kills every crop still in a field. World rules set the ripe-quality window and later loss (defaults: six real hours, then 0.5% per game day up to 35%); they remain harvestable only until winter and never automatically replant. Perennial dormancy is not simulated. Livestock uses separate buildings and care cycles.

Harvest is a saved 15-second task, one worker/plot. **Harvest all** reserves every ripe plot that fits and takes half again as long as cutting those same plots one by one. When the stockroom cannot hold the whole harvest, the button reads **Harvest all · N%** and the note names that share; clicking it takes only the plots that fit, in field order, and leaves the rest. A full stockroom disables the button. Produce enters the farm stockroom; employed harvesters receive funded, taxed wages for each plot the till can cover. Owners harvest unpaid. Insufficient output room or payroll at completion leaves that plot intact. Disconnects cannot double-pay. Farms no longer produce automatic wheat; existing stock is retained, and new market crop listings start empty.

## Competitive play

Enable fighting in world rules, then join **Team deathmatch**, **Capture point** or **Capture the flag** through Activities. Teams balance automatically; default Rust/Moss bases lie west/east of the northern arena. Arena deaths preserve property/skills.

**1–6** select machine gun, grenade, plasma, rocket, javelin, mine. **Tab** fires; hold/release for javelins. Grenades bounce; mines arm in 1.5s and expire after 90s. Blast damage falls with distance; damage scales ×100/armour. Safe zones, occupied homes and teammates are protected. Arena shots cannot hit outsiders/buildings; leaving cancels in-flight weapons. Open combat outside matches can damage unprotected private buildings.

Defaults use regenerating energy (65,000); `weaponMode=ammo` gives ammunition per life. Garage refits cost 25d. Respawns restore health/ammo with three seconds' protection; firing/picking up a flag ends protection.

- Deathmatch: 10 team kills.
- Capture point: 120 uncontested seconds in the 12m circle.
- CTF: 3 captures; your own flag must be home. Touch dropped friendly flags to return them; automatic return after 30s. Death/leave/disconnect drop flags.

Rounds last ten real minutes, pause scoring if either team is empty, then restart after 15s. Winners earn 5 kudos. Optional treasury `killReward` defaults zero; each victim can reward at most once/30s. Custom arenas can change settings. Town wars/turrets/loadouts remain incomplete.

Hornball, ordered-checkpoint racing and Ultrakricket controls/rules are in [FAQ](FAQ.md#what-are-hornball-racing-fishing-and-ultrakricket).

## Travelling between stars

Take off at a spaceport. Seven-system routes show reachable jumps/intermediate stops. A jump costs 1cr per rounded-up parsec (fuel included) and takes **6 + 2 × fuel-cost seconds**. Saved arrival settles after reconnect; no trading/landing during transit.

**Shipyard & space trade** offers:

- A hangar: purchased ships remain owned; switching is free if cargo/contracts fit.
- Three drive/hold upgrade levels, each +2pc/+20 cargo, retained across ships.
- Three trade goods with station-specific quotes/spreads; shared stock replenishes 20/hour to 200, buyers fill to 400.
- Courier jobs: ten sealed cargo spaces, directly reachable destination, quoted reward. No offline expiry; cancel removes packages without reward/penalty.
- One survey/system for 15cr. Relics at Lantern, Rime and The Vessel unlock alien-ship purchase.
- Free Hearth rescue for an empty ship with no contract and less than 10cr.

Galactic credits/cargo are separate from local cash/inventory; spaceports convert subject to world caps. Account/station writes are atomic. [Connected galaxies](GALAXIES.md#player-journey) explains inter-server visits.

## Appearance and property

Choose among five architectural models per building type and six independent finishes, with size options for suitable types, using the building designer below. Existing properties keep their stock, location and capacity; garage paint is saved separately for each owned machine. Garages offer seven paints for 25d at defaults; select the owned tractor to repaint without changing the others. Costs/materials/skills/civilization tiers apply. Owners use Stockroom and Building Admin, never self-trade or paid self-employment; buying your workplace ends that job. Neighbours can still fund a till they do not own and collect a capped return after it earns. Farm owners may tend/harvest unpaid. Puddlewick also allows qualified owners to operate their factories without wages, including offline.

Buy unclaimed property or player-listed buildings (a red **For sale** tag with the asking price hangs under a listed building's name sign, visible from about 70 m), repair them and supply construction materials. To abandon an unfinished site, drive nearby, open it, expand **Cancel construction**, and confirm the displayed refund. The owner receives the world’s refund share (default 75%) of the original base cash cost; construction tax and delivered materials are not returned. Older sites without a saved cost use the lower of their saved building price and current catalogue base price. Completed buildings cannot use this refund. Homes and rooms use exterior shelter, not separate interior maps. [Economy](ECONOMY.md) covers business management and guesthouse rules.

## Building designs

Open **Build**, choose a building, then its architectural model, surface finish, size and rotation before placing the foundation. The 3D preview shows the finished design at a fixed scale for the selected building type, so larger sizes look larger; the north-up site plan shows its footprint and nearby buildings. Rotate in 15° steps with the slider or arrow buttons: 0° faces south, 90° east, 180° north and 270° west. The selected footprint must fit on dry ground outside protected areas and other premises; desalination plants need ocean intakes and pump-houses need fresh water. World construction rules set centre spacing (strictly more than 12 m by default), remote shoreline placement reach (up to 4 m) and clearances. Keep the parish arrival/respawn area (default 12 m radius) and town centres (default 8 m radius) clear, including the whole rotated building footprint. New fields and pasture expansions must also stay outside these areas.

Each built-in type offers five architectural models, with appropriate layouts such as porch cottages, bakery shops with oven rooms, tall processing mills, long boat sheds, low animal shelters and civic assembly halls. Independently choose rough stone, white clapboard, red timber, dressed stone, brick or industrial metal. Finishes do not change the roof shape or layout. Supply caches instead offer five shipping-container arrangements (20-foot, 40-foot, high cube, paired containers and a depot) in six paint colours; all use steel construction. Material bills follow the structure: stone uses more blocks, timber uses more wood, brick uses bricks, and industrial panels need steel and concrete. Every selected design needs gravel for its foundation, and specialist equipment materials remain in the bill.

Suitable buildings offer **Expanded** (1.5× storage, default 1.55× cash/material cost) and **Large** (2× storage, default 2.15× cash/material cost). World construction rules set these cost multipliers for new sites; 1× removes the expansion surcharge. The estimate includes the selected model and finish’s cash price and shows town tax separately. Lodging gains rooms too; production recipes, speed and staffing do not change. Farm fields expand separately through farm administration. Expansions add wings, halls or upper floors. Door and window heights stay human-sized.

Check the estimate for materials, what you already carry, storage, dimensions and any placement restriction. Choices persist while playing in the same browser session. Existing buildings and unfinished sites retain their original costs and capacity. Buildings placed before model choices retain their architecture, except supply caches now appear as containers. Creator-uploaded models retain their authored design and bill but can also be rotated.

## AI neighbours (optional prototype)

Enabled AI residents have labelled names, persistent memory and ordinary player rules. Name one in public chat for a public reply; **AI neighbours** starts private chat. Start a public message with **Hey guys**, **everyone**, **anyone** or **@all** to address the group: for example, “Hey guys, my farm pays 24d; anyone interested in working here or learning the farmer skill?” Everyone hears it, but at most one suitable volunteer responds; no interest can mean no reply. Group invitations share a world-configured cooldown (30 real seconds by default). A volunteer can agree to train and take the job through the normal gameplay system; advertised terms are checked on arrival. Unnamed public follow-ups work for two minutes after your last turn; another named person/private conversation switches routing. Messages use the world’s chat limit (1,200 characters by default); longer submissions are rejected, not truncated. Public, private, family and resident chat share that limit; CB also applies its own smaller limit. See World rules for local values.

Mabel stays present; others have habits. Budget caps/outages may prevent responses. Relevant public/addressed private context is saved and sent to Jev plus that resident's OpenAI/Claude provider; other players' private conversations are excluded. Delivery and training/job requests can become executable agreements, but speech is not proof of action. See [NPCs](NPCS.md).

## When the game feels laggy

The speed display separates **ms ping** (sampled every five seconds) and **FPS**; its tooltip shows interpolation buffer.

- Low FPS: choose Performance graphics, close heavy tabs, check browser hardware acceleration. Compare alone versus nearby tractors.
- High/variable ping: compare wired/Wi-Fi, stop large transfers, check hotspot signal and other players' readings. All-player spikes may mean server overload.
- Report device/browser, graphics mode, ping/FPS and nearby player count. [Host checks](HOSTING.md#connection-and-multiplayer-checks) distinguish server load.

Slow connections limit the number of world updates in transit, so old snapshots
have less opportunity to build up. Faster connections retain their normal update
window. A large first download should finish with the **CONNECTED** badge; refresh
the page after an update to load the latest client. Road construction and World
Builder changes still take effect while unchanged road geometry is reused.

Movement and connection updates continue during periodic background saves.
Sign-in and actions that need the database may briefly wait for an active save;
their results remain ordered and saved before confirmation.

AI residents may briefly wait while calculating a safe ground route. The server
splits that work across ticks so other players can keep moving. Ordinary clock
updates retain the work already done; terrain and policy edits trigger replanning. Checkpoint saves
share disk commits without lowering save durability. If a save fails, pending
public messages and ledger entries remain available for retry.

Daily road surveying also runs in short steps. Crews can finish their survey
shortly after the day boundary instead of freezing movement while planning.
The construction allowance remains unchanged; unfinished days survive restarts,
and world edits cause the survey to be checked again before roads are laid.

Version 0.115.0 network entry waits for the full world snapshot before queuing live updates, including when switching worlds. A slow first island download can still take time; the following updates start from current state.

Version 0.115.0 rendering prepares road growth and building changes in small batches while the existing view stays visible. Detailed banks are prepared when snow first appears, so driving and controls continue during preparation.

Adaptive graphics reduce sustained slow rendering. Dynamic shadows default off and can be enabled outside Performance mode; models/textures/contact shading/local lights remain. Motion buffering smooths jitter but cannot remove round-trip latency/outages. Reconnect gets current state without replaying purchases; first-visit textures (~2.7 MiB) are separate traffic.

## Reading earlier chat

Scroll inside chat (no camera zoom). Focus the log for Page Up/Down or Home/End; arrows drive the tractor. The wheel moves in small smooth steps, and page keys leave overlapping lines for context. Reduced-motion settings disable the animation; Page Up/Down also work while typing without losing drafts. New arrivals preserve your reading position; **jump to latest** resumes follow. Up to 100 recent messages, filtered for privacy; changing parish changes history. Not an unlimited archive.

## Repeating transactions

Trading lists keep scroll/quantity; admin/stock/gameplay forms retain edited amounts/choices per building/tab during the browser session, including reopening. Refresh/sign-out clears drafts. Passwords, keys and selected files are excluded. Saved wage/price displays stay live; draft edits require Save.

## Creator worlds and other galaxies (0.20.0)

Create through the galaxy directory; **F10 / World editor** opens owner tools. [World building](WORLD_BUILDING.md) covers models/rules/recipes/design import. Other galaxies require host configuration; identity travels but wealth/skills/property stay local. [Galaxies](GALAXIES.md) covers confirmation and native-home authentication.

## Towns and town government

A world can hold several towns, each with a plinth, a circular border, a treasury and its own rules. The HUD says which town you are in, or which is closest; the maps draw town borders as dashed circles. Open a plinth to see its taxes, zoning, permissions, government and residents. Alternatively, open **Build → Town government** within 18m of the town centre; this also works when a council building has been removed.

- **Residency:** **Become a resident** at a plinth (or `*sethometown` for staff). You can be a resident of one town at a time. `*town` names the town you are in and `*showresidents` lists residents.
- **Founding:** where the world's charter allows it, **Build** ends with **Found a new town**. You pay the charter cost, the plinth is raised where you stand, and you become the first resident (and mayor, unless new towns are direct democracies). Towns need dry land, clear ground and space from other towns.
- **Rules:** each town has construction, sales and wage taxes, north and south districts zoned for building categories (residential, commercial, industrial, agricultural, advanced, civic), and separate resident and guest permissions to build property, build roads and modify the environment (gather resources). Building on the outskirts can push the border outward.
- **Government:** appointed mayors are chosen by the world owner. Proprietors own their town and may put it up for sale. Elected towns open candidate registration when a term ends; candidates pay a deposit and may escrow a campaign budget that pays each supporter a promised amount per vote. Too few candidates defers the election. Voting is secret; the plinth shows tallies only. Auction towns award the mayoralty to the highest escrowed bid. Direct democracies have no mayor: residents propose rule changes, which pass with a majority once enough residents vote.

Mayors change only the rules the world's charter delegates to towns, within its tax limit.

## City development

Town government shows progress toward city
status, based on occupied buildings, businesses and distinct housed or registered
residents. The default requirements must last 30 game days. Once a city qualifies,
crews slowly pave connected streets serving dense clusters; nearby farm lanes
can remain dirt. Grey pavement appears gradually on the ground and parish map.
One connected boundary exit permits a route toward another city. Paved approaches
wait at rivers for a bridge; the map marks “Bridge needed”, and a usable ford
remains a dirt route. Temporary decline
does not immediately remove city status, and existing pavement remains.

## Puddlewick services

Default server-owned Puddlewick adds missing **Stonemason** (3 stone → 2 blocks) and **Desalination plant** (1 fuel → 12 water), ten-minute batches at defaults. Find them with M. Train mason/pump operator for paid work. New seeded services receive finite initial supplies/capital; existing businesses are never refilled on restart. Other catalog businesses await player development.

Puddlewick's public **town centre** is a fountain with benches. Its missing starter centre is restored once on a clear nearby lot, avoiding roads, farm plots and existing property; town boundaries, taxes and treasuries stay unchanged. The earlier cleanup no longer removes the public council. Each town retains its own meeting place, so Mabel's Reach does not become Puddlewick's government office. Find the centre on the map or in the parish directory and approach it to open Town government. Later deliberate demolition is respected.

Startup preserves purchased/custom properties, skips blocked sites and retries pending placements later. Completed additions are recorded: demolition/depletion does not recreate/refill them. Other worlds are untouched. The one-time 0.21.2 cleanup and exact removal scope are in [release notes](RELEASE_NOTES.md#puddlewick-cleanup-scope); owners retain prices/stock/wages. No catalog building type is banned.

## Helping other players

Click an online player's name or **World/F9 → Players & roadside help** (**Actions** on mobile). Includes NPCs and private chat.

- **Give money:** 0.01d–1,000,000d, two decimals, from cash in hand to another online player anywhere in this parish. No tax/fee; not a loan, bank withdrawal or galactic transfer. Both get private receipts; input values stay set.
- **Refuel:** carry Fuel from a stocked shop/garage; stop within 15m and at the same height. Both must be outside, stationary and free of tasks/games/passenger rides/scouting. One Fuel adds up to 8 tank units, capped at that machine’s tank capacity; surplus is consumed, not taken from your own tank. Only fuel-powered vehicles qualify.

Buttons explain blockers; the server rechecks on receipt and saves transfers. Owners independently control both features under Editor → Rules (enabled by default). Receipts remain in recent chat.

## Journal and statements

Open **World/F9 → Journal & reports** for your last return report and recent personal history. It explains deaths, released properties, trades, jobs and qualifications. Your report compares cash, savings and still-owned businesses across a disconnect.

A building’s **Statement** tab shows current production blockers. Owners and world caretakers also see operating cash flow, capital movements, traded goods and completed automatic batches. It updates as business activity arrives. Accounts begin with this upgrade; old transactions are not reconstructed.

## Parish supply orders

At public Harbour stores, open **Parish supply orders** to see funded maintenance jobs, payment and remaining demand. The same list is in **World / F9**. Carry the goods to the collection point and choose a quantity to deliver. By default each order limits each supplier to half its quantity during its first half-hour and expires after one real hour. Version 0.115.0 world rules can change the round length, early share and share-window fraction. The panel quotes the funded round’s terms; rule edits apply to the next round.

## Creator quests

World / F9 → **Quests** lists a world's stories and objectives. Accept one, follow its steps in order, then collect the reward with enough cargo space. Each quest states whether death resets it. World creators can also require items, qualifications or progress before allowing certain actions; a rejected action explains what is missing.

World creators may add local goods, courses and building designs. Schools show each course's actual price, duration and prerequisites. Custom food/drink can be consumed or stocked at home like standard supplies; cargo weight and production rules still apply. These definitions belong to that world only.

## Livestock and nutrition

Build a **Feed mill** (wheat → livestock feed), **Dairy barn** (hay/feed + water → milk), **Cheese dairy** (milk + fuel → cheese), or **Country café** (cheese + potatoes + water → suppers). Learn miller, livestock farmer, cheesemaker or cook and hire qualified workers. These are player-built businesses, not extra starter properties.

Stock a barn with two cows, bought from Harbour stores or another dairy. Two stalls produce six milk per check. Every cow, including reserves, consumes one hay bale or feed sack and one water each check even when milk storage is full or workers are absent. Fund wages and keep workers active: supplied/staffed care restores 4 condition, supplied/unattended loses 0.1, and missing feed/water loses 8. Milk needs 40% condition; reaching zero loses a cow. Sell surplus milk and keep the supply chain funded.

**Sheepfolds** keep two sheep and turn 2 hay/feed + 2 water into 4 wool. **Pig farms** keep two pigs and turn 4 feed + 2 water into 5 compost (collected manure for crop fertilizer). **Henhouses** keep four chickens and turn 2 feed + 2 water into 6 edible eggs. These are ten-minute checks at default world speed; one livestock farmer can staff any species. Buy starter animals at Harbour stores or the spaceport, then trade locally with breeders. New livestock buildings are player-built; existing properties are not reset.

**Feeding with hay:** deposit bales through the livestock building's Stockroom if you own it, or sell them to its funded hay bid. Cows and sheep automatically eat hay first and make up any shortfall with feed; their water requirement is unchanged. This also works offline and for breeding. Pigs and chickens still need manufactured feed. You do not need to click each animal to feed it.

Build a **Hay barn** for **750d + 24 wood, 8 stone blocks, 2 tools and 12 gravel**. Its stockroom holds up to **3,000 bales**. It buys and sells hay without a production recipe or employees: fund its bids and set prices in Building Admin, then store seasonal harvests for winter. Stored hay does not spoil. New barns start empty; no barn is automatically added to Puddlewick.

The same health rules apply to all herds. Every animal consumes upkeep, even if output storage is full: cows/sheep each need 1 hay/feed + 1 water; pigs 2 feed + 1 water; chickens half a feed + half a water, rounded up for the whole flock. Healthy adults increase production up to the available pasture capacity. Ordinary buyers cannot purchase the breeding stock, but owners can withdraw it deliberately.

Healthy qualified owners/employees can arrange one birth at a time using 4 feed (or hay for cows/sheep) + 4 water and investment: calf 20d/60 minutes, lamb 18d/50 minutes, piglet 20d/40 minutes, chick 6d/30 minutes. Births are checked on production ticks; keep the required parents, storage space and at least 60% condition until then. Births add young stock; healthy growth days are tracked per cohort. Sex and genetics are abstracted.

Cows, sheep, pigs and chickens appear near their completed housing, with grazing/pecking, breathing, short walks and tail movement. Stock changes update the herd without rebuilding the town. Up to eight per nearby building and 48 total are displayed in available dry, level space away from roads and buildings; the stockroom always gives the full count. Models are visual, not obstacles or individual controllable animals.

A qualified owner or employee can **Arrange breeding** in the barn: two cows, 80% condition, four hay/feed, four water and 20d investment. Keep parents at 60% condition and leave stock space for one hour. Success adds a tradable calf; failure consumes the breeding cost. Shop sales reserve the last two cows, while owners retain stockroom control. Extra adults increase both upkeep and production within the pasture limit.

### From pasture to plate

Breeding now produces **calves, lambs, piglets and chicks**. Young animals are visibly smaller and use half an adult's pasture share and ration. They produce no milk, wool or eggs and do not count toward the adult breeding minimum. The barn shows each cohort's healthy growth days: defaults are **40 for calves, 25 for lambs, 20 for piglets and 6 for chicks**. Feed, water and at least 40% condition are needed for growth; below 20%, neglected young are lost before adults. Maturing also needs enough room for the larger adult. Moving an animal preserves its progress, but time in a wagon or shop does not grow it.

Owners can **Enable continuous breeding**. Qualified care, healthy adult parents, feed/water, investment and spare pasture must all be available; no inputs or animals appear for free. NPC farmers keep their breeding reserves and seek the best funded bid for surplus adults. Existing herds remain adults.

Build a **Butcher** and learn **butcher** at school, or hire qualified staff. Five designs include a cold room and a fenced loading ramp. Park your livestock wagon beside the ramp, open the building and choose adult animals. On foot, bring one small animal (default weight at most 3). Young animals are refused with their remaining growth days. Default service lasts 30 seconds per animal and costs a third of its catalogue value; the owner can change the fee. One cow returns 12 raw beef, a pig 8 pork, a sheep 6 mutton, a chicken 1 poultry. The fee goes into the butcher's investment account. Animals and cash transfer only when the task finishes: cancellation, leaving, a changed fee or insufficient room leaves them yours. The counter separately buys adults and sells meat through its funded production.

**Raw meat must be cooked.** It spoils after two unchilled game days by default. Butcher and business-kitchen stockrooms, inn pantries, chilled trailers and fish freight holds keep it cold. Your inventory, home and ordinary livestock wagon do not. Transfers, save/reload and recoverable boat cargo preserve its age; adding fresh meat never refreshes older portions. Existing Steak remains cooked and edible.

Kitchen and restaurant owners choose a **Meat menu**: beef stew, roast pork supper, mutton pie, roast chicken or cooked Steak, with café breakfasts and pub meat pies where offered. Fund ingredients and qualified cooks. A normal business batch produces four servings in ten minutes; explicit world recipes can differ. Trade finished meals with pubs, inns and public stores.

Go inside your own **home** or a booked **inn room**, reopen its building panel and choose **Cook**. No skill is required. Ingredients come from your private pantry first, then your inventory; the default is one meal in three minutes. The panel lists ingredients, missing supplies and full storage. Stay inside, or cancel to keep the ingredients. Finished meals enter your pantry and feed you through the existing home-feeding rules. A room never uses another guest's pantry or the inn owner's stock. All quoted defaults can be changed by the world builder.

Inventory lists each food's effects. Milk restores some health; cheese and dairy suppers also increase maximum health for this life. Nutrition changes the default 65,000 ceiling by at most ±6,000 and resets on death. World owners can change both limits; health meters use your current maximum. Custom foods may have clearly labelled negative effects, but consumption alone cannot reduce health below one. Ordinary hunger/thirst can still kill. Homes prefer a different available food and automatically feed at 30,000 need by default; sheltered meals receive full food/drink value. Hunger or thirst at the default 50,000 damage threshold costs health even offline. Owners can change both thresholds. Repeated manual servings default to half their hunger/thirst benefit from the third serving; the starting serving and multiplier are world rules. Online energy regenerates at 3,000/second by default and can be changed or stopped. Check World rules for the current values.

## Choosing a tractor

Visit a completed garage to compare six tractor models at the same preview scale.
The [tractor guide](TRACTORS.md) explains each machine’s speed, carrying capacity,
fuel use, tank, handling and lights. Buy with cash, and bring fuel: new purchases
have empty tanks. Each machine retains its parked fuel and paint. You can select
an owned tractor outside in worlds with instant switching. With persistent
vehicles, retrieve it where you parked or drive a stored machine out of its garage.
Unload excess cargo before switching to a smaller machine. In first-person view,
the textured dashboard shows speed, fuel, condition and distance; switch on the
lights to illuminate the instruments.

## Vehicle care and roadside services

Garage **Vehicle service** shows current condition, recorded kilometres and elapsed hours since first recorded use (old vehicles start with no invented history). Ordinary powered travel loses 0.2 condition points per kilometre by default; F10 Vehicle running costs sets the rate (zero stops distance wear). Parking, offline time and minigames cause no wear. At zero condition, top speed is 70% and fuel use is 30% higher; you can still reach help. Other damage/armour rules are separate.

Bring **Steel** spare parts from a steelworks or shop. By default each garage service consumes one Steel, restores up to 25 points and pays 10d labour into the garage's investment. Owners pay no labour on their own premises. Stop outside, free of activities. A neighbour qualified as **mechanic** can provide the same repair within 15m using their carried Steel and Tools; Tools remain reusable. Since 0.115.0, F10 → Rules → Economy and trade sets the Steel quantity and garage labour fee; both repair methods use the same parts quantity, including zero. The panels quote local terms. Select their name to see refuelling, repair and passenger buttons; **Leave passenger ride** disembarks. Boarding requires a stopped, available driver within 10m at the same height.

World owners may require **driver**, **pilot**, or **captain** qualifications for advanced vehicles, learned at school and counted against the usual skill limit. All six tractors and walking remain unrestricted. A lost qualification prevents driving the affected vehicle until relearned. Puddlewick leaves those licences off. Boats longer than the motorboat also need **captain**; the motorboat and lifeboat do not.

Maps are free to view in Puddlewick. A creator may instead require a carried **Parish map**: garages print one for 10d by default (the map print rule can change this), and stocked public outlets may sell it at an import premium. It has no cargo weight. The requirement covers both the minimap and full map; the owner editor remains available.

## Choosing a spacecraft

The free shuttle keeps 20 cargo spaces and a 4pc drive. The 200cr hauler carries 80, travels slowly and uses 0.65cr/pc. The 240cr courier carries 25 and halves ordinary cruise time at 1.25cr/pc. The 450cr explorer trades a 35-space hold for 12pc range. The 320cr escort carries 40 and has full frontier shielding. The relic-unlocked alien scout remains a late upgrade. Hangars and fleet-wide fittings persist.

Each jump costs rounded-up distance × hull fuel rate, plus rounded-up `2 × route hazard × (1 − shielding)`. The route hazard is the higher of its endpoint ratings (0–4). This models predictable shield-energy expenditure, not random damage, piracy or combat. Travel takes six departure seconds plus rounded-up distance × hull seconds/pc, rounded up again. Shipyard shows each hull's values; jump buttons show exact credits and seconds. Suggested multi-stop routes total every leg, but each jump must be taken separately. Routes minimize stops, not necessarily fuel.

Couriers still reserve ten cargo spaces. Their rewards depend on route distance, not the hull chosen, so efficient ships improve margins. Missions and journeys survive disconnection; an already saved arrival time is unchanged by this upgrade.

## Mail, families and direct trades

Open **World / F9 → Mail, family & trades** on desktop or from the mobile Actions menu. Mail can reach anyone who has visited this world, including offline players: enter their exact pilot name. Letters stay private to sender/recipient. Each inbox holds 50; senders must wait ten seconds between letters. A full inbox rejects delivery; deleting your copy doesn't delete theirs. The latest 50 sent copies are retained. Reply from a received letter. Mail doesn't wake NPC chat models; address an online NPC in chat for conversation.

Create a family or accept a leader's invitation. Leaders invite/remove residents; members can leave. Leadership passes to the first remaining member, and an empty family dissolves. Existing named memberships are preserved, with a stable initial leader. Families have at most 32 members and 16 pending invitations; they don't share assets or powers. Family messages are private copies in members' chat, not durable letters.

A trade offer names seller/buyer, goods, quantity and unit price. The recipient sees the total and must accept. Offers don't reserve goods or cash; either party can cancel. Both must be online, stopped outside within 15m at similar height and free of activities when accepting. The server checks actual stock, cash and cargo before transferring both sides together, once. Offers expire in five minutes or become invalid on a new life. Limit: eight outgoing offers; maximum total 1,000,000d. NPCs may accept or decline through their planner, not automatically. Goods-for-goods barter is not included.

Sunrise and sunset colour the sky and clouds around the sun, fading through an afterglow. Clouds soften these colours; night visibility still depends on moonlight, starlight and nearby lamps.

### Spaceport cargo launches

The expanded launch facility places the terminal shop by its southeast entrance. The paired red-and-white barrier arms lift automatically when a player approaches from either side and stay open while traffic is nearby. The surrounding tall chain-link fence has razor wire; use the entrance. The 0.115.1 rendering correction makes that wire respond to scene lighting like the chainlink, rather than glow at night or remain a bright distant outline. Beyond it are the integration hall, operations building, workshops and logistics store, tracking dishes, a crane and parked transport trucks. These support structures are scenery, not additional businesses; the terminal retains its existing stock and services. A widening paved entrance leads to a connected concrete service yard, with marked visitor parking beside the terminal.

The parked cargo ship launches every three or four economic game days (30–40 real minutes at the fixed calendar rate), returning to the pad half a day after departure. All clients see the same phase, including when joining during flight. The spaceport panel shows status and time to the next launch. The pad remains a reserved solid area even while the ship is away. This is an ambient cargo service; player travel, bookings and inventories are unaffected.

Sound preferences separate engines, effects/machinery, environmental ambience and chat alerts. Find the four sliders below master volume in **Pilot & preferences**. World creators can add sounds that change with location, time and weather; muted and hidden tabs stay silent.

### Caretaker history

World owners can open **F6 → Overview** for public notices or **Chat logs** for all public chat, emotes and notices. Scroll inside the history and choose **Load older entries** to continue to the beginning of the available archive. **Refresh** returns to the latest entries; live dashboard updates leave your reading position alone. Private messages and letters remain excluded.

The archive starts with the messages still retained when this upgrade is installed, then saves new public messages alongside the world. Earlier messages already discarded from the game's chat buffer cannot be reconstructed. History is stored in the normal SQLite database and included in backups; it has no automatic age cutoff.

## First steps and controller play (0.78.0)

Open **World rules & leaving safely → First steps** for a short guide tailored to
this world's survival/job rules and your qualifications. Destination buttons set
waypoints; visit a business to check its actual stock, wages and vacancies. World
selection now includes rules and marks your recent destinations in this browser.
A remote visitor should retain their home-host address and pilot key; if the
remote server is unavailable, sign in at the home host and use its visitor recovery
flow. Recent destinations do not bypass cross-host account recovery.

A standard gamepad uses the left stick to drive, right shoulder to boost, A to
interact, Start for the menu and B to close it. In menus, D-pad up/down moves focus,
left/right changes a selected choice or number, and A activates buttons. Remap
axes/buttons and the dead zone in **Options → Controller settings**. Disconnecting
the pad or hiding the tab releases its driving input. Text entry still needs the
device keyboard.

Near a resource, **Gather repeatedly** performs ordinary timed loads until you
stop it or run out of room, tools or available material. **Stop gathering** is in
the floating task control. Driving away or disconnecting also stops repetition;
uncollected reserved material is returned to the node. Single-load gathering
keeps its existing behavior.

## Courses and optional contracts (0.78.0)

**World → Courses & scoreboards** lists creator routes, opening/closing world times,
prizes and weekly/all-time results. Drive your tractor to the first waypoint to
start, then follow checkpoints in order, holding position where required. Keep
the course waypoint selected to see the next target. Changing vehicle, teleporting,
disconnecting or exceeding the time limit invalidates a run. Prizes come from a
sponsor's deposited money, at most once per pilot per seven-day world-time week.
A creator can also enable build/peace/war phases; survival and property persist.

Some worlds allow commercial operating leases and auctions in building panels.
Read the prepaid rent, asset bond and expiry before accepting: stock and working
cash stay with the property when the lease ends, and asset depletion reduces the
bond refund. An operator cannot sell, mortgage or demolish it. Auctions hold the
highest bid until closing and refund outbid bidders. See [contract rules](ECONOMY.md#optional-property-contracts-0780).

## Business and chat controls

Press **Enter** or **F2** to enter chat. Enter sends a message and keeps the cursor
there; **Escape** returns to driving. Typing does not activate driving or HUD
shortcuts. Enter still activates a focused button or submits a dialog form;
use F2 to start chat when a HUD button has focus.

An owned business keeps its stock, sale prices, purchase bids and included-tax
breakdown on **Main**. Its quantity field previews totals; use **Stockroom** to
move your own goods. You cannot trade with yourself.

In **Building Admin**, use **Remove from sale** to withdraw a property listing.
Your asking price, stock and investment remain intact for later relisting.

**Staffing & hiring** lets owners set 0–16 paid places, restore the automatic
recommended limit, or dismiss individual workers. Zero closes hiring; lowering
the limit leaves existing workers in place. Dismissed workers wait one real hour
before reapplying. A worker must finish a current task before dismissal.

Compare **Estimated production margins** before changing staff. A higher margin
per batch can still mean less income per hour if production slows. Actual recorded
cash flow remains in **Statement**. Farms pay for completed harvests and have no
factory hourly forecast.

## Personal statistics

Open **Menu / F9 → Statistics**. Total playtime combines a labelled estimate from older connection logs with connected time recorded since tracking began. The estimate is a minimum: missing sessions and old space travel cannot be recovered. New time includes idle connected time and space travel, excludes offline time and paused worlds, and counts each account once even during reconnects. Reopen the page to refresh the total.

**Bug-bounty rewards received** counts operator-awarded bug-report rewards in this world, including verified historical awards when imported. It survives death; ordinary gifts and compensation do not increase it.

Money, construction and resource counters are private and specific to the world you are visiting. Earnings count sales, wages, labour and prizes; spending includes purchases, taxes and losses. Gifts, refunds and starting cash are separate receipts, while business investments and loan movements are separate capital flows. Moving cash into or out of personal savings does not inflate totals. Business tills have separate Journal accounts. These are gross flows, not net profit.

Construction counts finished buildings owned at completion, including a helper's final delivery; buying an existing property or cancelling an unfinished site does not count. Materials count completed gathering loads and caught fish; crops harvested into a farm's stockroom are listed separately. Failed or cancelled work does not count. Counters survive death. Existing death totals are retained, but money and activity before this update are unknown rather than reconstructed as zero.

## Boats and the coastal trade

Boats cannot motor onto the shoreline. A shore impact removes one percentage point of powered-boat hull condition, cuts throttle to zero and pushes the vessel a short distance back into water where clear. Release the throttle key (or reverse it) before accelerating again; holding the same key through the impact cannot keep ramming the shore. Boat service repairs condition. The collision boundary follows the tide; waves do not let you climb the beach.

Board the Parish Carrier canal boat or North Star fishing boat at a shoreline boathouse. The fishing pier also boards boats you already own and keeps them visibly moored, as does a player-built river dock on a deep river reach (small hulls including canal boats, motorboats, rowboats and the lifeboat at default size limits). Rowboats can also stop and leave at a clear bank; powered hulls return to a dock to disembark; an empty tank offshore requires a rowing lifeboat rescue. Puddlewick has a public boatyard with fuel, Fishing tackle and fish trading.

The North Star uses persistent throttle (W/S, A/D steering, B idle). Fuel is expensive and catches vary: keep reserves for bad trips. Smaller boats can use fishing tackle to catch deep-water species. Fish can be landed at the boatyard or hauled inland to harbour stores, spaceports, kitchens and inns.

The North Star (300s) has a larger hold and tank for long expeditions; the canal boat costs 60s. Nets catch continuously; hauling reveals fish. World defaults set trawl speed/capacity/fuel and new shoal intervals; vessels can override the first three. Recruit up to two consenting deckhands for shared profit and stock shared provisions. Disembark beside the boatyard within its waterfront arrival area; Inventory quotes the world’s docking radii and shore-impact damage. [Boating](BOATING.md) covers controls and crew agreements.

The [Coastal Belle charter boat](CHARTER_BOAT.md) adds paid passenger rod-fishing trips, an enclosed helm and six fishing stations. Invitations and fare settlement are under Inventory → Boating. Version 0.115.0 charter rules set local fare/duration defaults and limits, invitation counts and return-request cooldown; existing offers and bookings keep their agreed terms.

See [Boats, fishing and the coastal economy](BOATING.md) for docking, rescue, controls, fish menus and the full cost breakdown.

## Home provision estimate

While at home or in a rented room, the status below **At home · Go outside** estimates when food or drink will run out, whichever is first, in real-time hours and minutes. It uses home stores plus carried supplies when inventory feeding is enabled, the configured indoor needs multiplier (20% slower in Puddlewick), and items that supply both food and drink. It does not add time until starvation or death. Restocking updates the estimate; disabled needs do not count as a shortage. A rented room warns if its booking ends before supplies run out. The estimate assumes you remain at home under the current world rules.

## Automatic meals

Puddlewick eats and drinks from carried supplies automatically while online or offline, including during travel. If those cannot satisfy a need, it uses the stores of your selected owned home or unexpired private guest-room booking. Enter a home once to select it. A house is not required for inventory feeding. Business stockrooms and other players’ pantries are never used.

Indoors, home supplies are used first, then inventory. Needs grow at 80% of the outdoor rate in Puddlewick; the savings apply only while actually inside. Automatic eating uses the same meal thresholds and food effects as home feeding, prefers nonalcoholic choices within each source, and spends real servings. Supplies can still run out. World owners can independently switch off inventory feeding or remote home feeding and adjust the indoor multiplier under **Editor → Rules → Automatic food and drink**.

Boat crew continue to use their captain’s provisions first. Captains use boat stores automatically while offline; online captains can take provisions into inventory for automatic eating when this world permits it. The home estimate includes all supplies available while at home and excludes starvation/death time.

## Lighthouse keeping

Puddlewick’s harbour light stands about 780 metres from town; West Cape and East Cape lights mark the outer tips. Use the directory to find them. Fifteen headlands around the island have steep rock faces, grassy inland approaches and protected cliff edges: walkers and tractors stop before the drop. Build your own lighthouse on flat ground 15–65 metres inland from a tall cliff lip; the normal footprint, ownership and town rules still apply.

At sea, watch for a white flash when a lighthouse’s rotating light sweeps toward you. The light remains dim between flashes and does not cast a solid beam or illuminate your boat. Rain and storms reduce visibility. Land blocks the signal. Height above the sea and your viewpoint limit the range, up to about 30 km in good conditions. Beaches have rolling breakers and wash; cliffs have uprush and falling spray, strongest in storms.

Find a lighthouse in the parish directory and approach it to take its single keeper job. No skill, property purchase or deposit is needed. Enter the keeper quarters from its building panel and stock your private pantry with food and water. The normal indoor consumption reduction applies; provisions still run out. Leaving the job or being dismissed ends housing access immediately, but you can collect your remaining pantry supplies.

Keeper wages are funded by the navigation service, up to 8d per game day before taxes by default. Since 0.115.0, **F10 → Rules → Economy and trade** can change this cap; the lighthouse panel and jobs command show the effective wage. Raising the cap does not raise a building’s posted wage; its owner sets that in Building Admin. A zero cap pays no keeper wage but keeps the job and quarters available. In worlds requiring active shifts, renew them to keep earning; Puddlewick allows unattended employment. Private owners receive 4d per game day into Working capital. Ownership alone gives no right to live there; an owner may apply for the vacant keeper job. Larger designs still employ only one keeper and earn the same allowance. Lights continue navigating boats even when the job is vacant.

## Loan reminders and payment sources

Use **F9 → Loans & repayments**, or the loan button beneath your cash display, to review debts from anywhere. Warnings show unpaid instalments, insufficient automatic-payment funds and time until default/foreclosure. They remain available after chat scrolls away and after reconnecting.

At the lending bank, choose whether automatic payments use savings only, cash only, or savings first followed by cash. Existing loans keep savings-only payments unless changed. Business tills never fund these payments. You can also choose cash or savings for a manual repayment. Defaulting still carries the agreed consequences; the new warnings do not pause deadlines.

## Buying in bulk

Shop menus show available bulk discounts and the final total for your chosen quantity. Default private-business tiers are 100 items at 1%, 250 at 2%, and 500 at 3%; owners may change or disable them in Building Admin. Each purchase is for a single item. Selling goods to a business still pays its posted bid. Review the total if a seller changes prices or discounts while the menu is open.

## Grazing land and larger herds

Open a livestock business to see its herd, pasture capacity and operating requirements. Buy adjoining pasture parcels before adding animals. Each expansion visibly enlarges the fenced area, where the animals wander and graze. New pasture parcels use the world’s side length (default 16 m, or 256 m²); existing pastures and adjoining expansions retain their recorded dimensions after a rule change. At default rules one parcel supports four cows, six sheep, six pigs or twelve chickens. The three expansions cost 2.5s, 3.5s and 4.5s; world settings can change these limits and prices. Keep feed, water and enough workers available: a larger herd increases production and running costs together.

## Reading the parish map

Press **M** or click the minimap. The scale bar below the map shows real ground distance, switching between metres and kilometres as you zoom. Each building type has its own symbol, including aircraft for hangars and rockets for spaceports. These icons replace crowded names; hover, keyboard-focus or tap an icon to reveal its name. Click it to set a waypoint. Names also appear automatically when zoomed in with few sites visible and space available. Zoom reaches 500%; above 350%, all visible icons show their names without hovering. Zoom follows the point under your pointer or pinch. Panning and live updates preserve the area you are exploring; **Find me** returns to your vehicle and **Fit parish** returns to the main town view.

## Island gathering grounds

Puddlewick’s countryside includes eight richer areas with wood, stone, gravel and topsoil together, extra woodland clearings scattered across the island, and stone outcrops inland of the coastal cliffs. Each richer area has four sites of each resource type. Original town and countryside gathering grounds remain in place. The new grounds use the same tools, carrying limits, yields and replenishment times as existing ones. Look for their resource icons on the parish map; cliff-side sites are on accessible ground above high tide.

## Screen layout

Use **HUD ⚙** in the upper-right corner, or **F9 → HUD & layout**, to choose individual panels. Chat, minimap, health and employment, parish players, inventory, the getting-started guide, vehicle controls, location/time/weather and action shortcuts can each be hidden independently. Choices are saved in this browser. The guide and player roster start hidden; **Show all panels** restores everything and **Essential panels** restores the compact default.

The minus buttons on chat, minimap and player status hide just that panel. **Enter** restores chat from the game view; **F2** also opens chat when a HUD button has keyboard focus. **H** toggles the whole scenery view. **F9** always opens the menu. Smaller desktop windows use narrower panels, shorter scrollable lists and wrapped controls; phones retain their Map, Chat and Pilot drawers.

## Soundings and offshore navigation

The fishing boat's instrument panel and fishing-control header show **Depth** in metres below the tidal surface. The reading follows the actual seabed, rather than the height of passing swells. It remains visible when the fishing controls are collapsed, unless that HUD panel is hidden.

Puddlewick Bay is labelled on the map. Lighter water marks the bay and shallow shelf; darker water marks depths beyond 100 metres. The seabed has banks, basins and trenches, with much deeper water beyond the headlands. Water depth modestly influences fishing; it is not a guarantee of a good haul or a fish finder.

Distant land has a lightweight silhouette beyond the detailed scenery radius. As you travel farther offshore, lower land drops below the geographic horizon before higher hills. Weather limits visibility. Lighthouse lights remain dim points between brighter flashes; there is no broad light shaft or floodlighting of your boat. Clear-weather range is at most 30 km, depending on the heights of the light and observer and intervening land.

## Haulage and rescue

Buy eight specialist trailers at the tractor garage. Use **Inventory → Your trailers** to load, unload, park and reconnect them; nearby business windows support building-stock transfers and shop trades directly into the trailer. Different bodies accept different goods. Reverse to the drawbar to hitch, and unhitch before changing vehicle. Loads slow travel and use more fuel. The amber Dales fuel tanker carries only Fuel (700 weight for 57.5s by default); buy directly into it at a refinery or other fuel shop, then unload Fuel into your inventory. **Inventory → Roadside fuel** lets you pump directly or buy from nearby tankers, including parked tankers whose owner is offline. Owners set the posted price there; zero closes public sales, and owner use is free. Stop within 15 m at similar height. Prices include tax; each whole Fuel item is charged even if its last tank units do not fit. The silver Dales liquid tanker continues to carry water or milk only.

The 24s outboard motorboat carries 50 weight and can be rowed after running out of fuel. The canal boat now costs 60s. A 140s tug can rescue another captain's boat for an agreed fee, or tow its owner's stranded boat home. **Activities → Towing** handles offers, acceptance, hookup and dock delivery. Fuel deliveries in a motorboat can end by towing it home behind your larger boat as a tender. See [the full haulage guide](HAULAGE.md) for controls and cargo restrictions.

Version 0.115.0 tug rules set the suggested rescue fee, fee ceiling and offer lifetime.
Posted terms persist after edits; accepted jobs hold the full fare until delivery
or cancellation refund and do not expire.

Walking uses a hand-held **Flashlight**. Walking and the 10-weight emergency raft have no engine controls or Fuel bar; the Fuel bar returns when you board a motor vehicle. Reboard stranded boats only within transfer range. Tractors can zoom out twice as far in third-person view, using the mouse wheel, pinch or **Actions → Zoom out**. There is no free town-centre teleport; allow fuel for your return journey.

## Portable canoes

Walk to a carpenter or boathouse, stop, and open **Inventory (I / Bag)**. Buy a
canoe for 150d, or at a carpenter craft one from 8 carried Wood. It appears upside
down overhead and adds 8 carry weight. Carrying limits walking to 40% pace;
Shift cannot run, and jumping/jetpacks, vehicle changes, fishing, gathering and
construction wait until you set it down. These defaults can differ by world.

**Set canoe down** leaves owned property on clear dry ground in front of you.
Stand within 3m to pick it up again. Other players see it but cannot take it unless
the world enables public pickup, which transfers ownership. A canoe transported
as ordinary inventory can be lifted with **Lift inventory canoe**.

At your own home, **Store canoe at home** converts the overhead hull into home
inventory; the default limit is two. **Take canoe out at the door** lifts one again
when outside. Stored hulls use the standard finish when taken out. Normal saves
retain set-down position, heading, finish and ownership. Carried hulls follow
inventory loss on death; stored hulls follow property rules. Set-down hulls survive
boat-loss deaths unless the world separately enables land-hull loss.

At any clear shore or riverbank, **Launch canoe** puts your carried or nearby
set-down hull into the water. No dock is needed. Paddle with W/S or the arrows;
there is one seat, a 12-weight hold and no engine or fuel. Default speed is
1.2m/s; Shift does not increase it. Narrow headwaters can be reachable even when
the larger canal hull cannot pass. The hull needs at least 0.08m of water.

Stop beside a bank and choose **Beach canoe**. By default, the water must be
0.08–0.6m deep with a clear dry landing within 6m and no more than 1.5m above the
water. Normal paddling into the bank stops the canoe without powered-boat recoil
or damage. The canoe stays moored there: use **Board canoe** or **Pick up canoe**
from its bank. Boathouses, the fishing pier and river docks also launch, moor and
board it. Its owner, position and finish persist across server restarts.

Death afloat follows the world's boat rules: loss removes the canoe and cargo;
recovery leaves the same hull offshore with the usual cargo-spoilage deadline.
Use the ordinary recovery lifeboat or a ride from another boat to recover it.
A canoe cannot launch an emergency lifeboat merely because it has no fuel tank.

## CB radio

In a tractor, boat or aircraft, open **CB radio** in the vehicle HUD, press **V**,
or choose **Actions → CB radio** on a phone. Choose a channel and a call sign;
these, volume and squelch are saved separately for each of your vehicles. The
usual defaults are road channel **19** and emergency channel **9**. The world
owner can change these rules.

Type in **Radio message**, leave the text field, then hold **T**, or hold the
**Hold to transmit** button. Release to end early. A message occupies the air
for its speaking time and finishes automatically if you keep holding. Typed T
characters stay in your draft. On a controller, **View (8)** opens CB and the
**right trigger (7)** holds the microphone; D-pad up/down moves focus and
left/right changes the selected channel or slider. Remap radio buttons under
Pilot & preferences → Controller settings.

Only nearby stations on your channel hear you. Hills and aircraft height can
extend reach; ridges obstruct it, and open water carries signals further. A
weak message loses words or becomes static. Raise **Squelch** to hide weak
stations; **Volume** sets the received-message tone and respects the usual sound
mute. The pane shows the current carrier, remaining airtime and signal strength.
Wait when the channel is busy. Simultaneous keys cause garbled “doubling”. The
public-chat mute and lock rules also apply by default. AI neighbours do not reply.

Received traffic appears after a carrier finishes. It stays separate from parish
chat and is cleared when you leave the vehicle or disconnect. Closing the pane,
losing focus or cancelling a touch releases your microphone. Your draft stays
while you close and reopen the pane in the same vehicle; changing vehicles clears
it. Walking and disabled-world states explain why the microphone is unavailable.

A nearby boat receiving an emergency-channel call from a stranded vessel can
choose **Open rescue options**. This opens the existing player aid panel: fuel,
towing and rescue still require the usual proximity, equipment and manual actions.
A radio call never grants supplies or automatically sends a rescuer.

## Local school and relief terms

School tuition, lesson time, public labour shift length and relief terms can now
vary by world. The school and Odd Jobs panels show the current amounts and times;
check them before starting. Default standard courses remain 80d/60 seconds first,
then 160d/40 minutes, with any catalogue course using its own terms. A world can
exempt driver, pilot and captain licences from its professional skill limit. The
school disables courses that would exceed that limit; a licence exemption does
not turn later lessons into first lessons.

Default relief remains 150d for residents below 50d combined cash and bank, at
most once per 30 minutes, with 15-second public labour shifts. The ordinary wage,
daily cap and diminishing returns are unchanged. Changing world rules does not
alter a course or shift already underway.

## Local trading limits

Version 0.115.0 economy rules let the world owner change the minimum price buildings
pay suppliers (normally 1d) and the quantity per transaction. Building Admin
shows the current minimum; shop quantity controls and Sell max show the current
limit. If the owner raises the minimum above a saved bid, that building cannot
buy at the old price until it is repriced. Existing private offers retain their
agreed quantity. Cash, cargo and storage limits still apply.

## Outside investment terms

Outside investments default to a maximum return of principal plus 8%, paid only
from later earnings. World owners can change the return for new deposits and the
minimum protected operating reserve (normally 20d). Existing claim amounts stay
agreed, including when you top up at a new rate. The Investment panel quotes the
current rate and reserve; Main shows your principal, paid amount, claim and what
you can collect now. Depositing cash is not an immediate profit or a withdrawable
bank balance.

## Ammunition refit price

The garage ammunition refit button quotes the local price, normally 25d. World
owners can change it in Economy and trade, including free refits. The existing
ten-second wait after firing and full ammunition/energy refill remain in place.

## Local cash transfer limits

The world owner can limit each cash gift and each bank/investment transfer in
F10 → Rules → Economy and trade. Defaults remain 1,000,000d per gift and 100,000d
per bank deposit, withdrawal or investment transfer. Forms show the local maximum;
gift readiness updates without erasing your draft. A smaller limit leaves your
balances and agreed investment claims intact. Gifts still need an online
recipient and available cash; investments still require earned, collectable
returns. These are per-transfer caps, not taxes or total-balance limits.

## Parish lottery

If enabled, open **F9 → Parish lottery** to buy tickets or contribute your own
cash to the jackpot. This uses in-game money only. The panel shows your tickets,
odds, the saved draw countdown and recent winners. Every contribution goes to
the pot; no money is generated. Insufficient cash rejects the purchase.

World owners choose the interval (365 game days by default). Changing it keeps
the current round's deadline and paid tickets; later rounds use the new interval.
Disabling new entries still honours existing tickets, including offline winners.
Empty draws carry the pot forward. Ticket price changes apply next round.

## Arrivals and new lives

Each world can choose its arrival and ordinary respawn point. New arrivals and
new lives appear on the ground at that site; a world-owner edit does not move
people already playing, and reconnecting keeps your current position. Boat
recovery and arena respawns still use their specific destinations. Death costs
follow the world's existing rules. Returning to town normally requires travel
or assistance; there is no free respawn shortcut.

## Coastal cargo boats and freight quays

The Coastal cargo boat is now 60 m long and 16.8 m wide, with a 3.75 m draft.
Its 2,000-weight hold, 320-unit tank and 240s price remain the same. People and
pallets keep their normal size. Use the outside berth at a boathouse, fishing
pier or suitable freight quay; the full hull needs clear, deep water. River docks
still refuse this ship. Crew stand on the side decks, and the chase camera backs
out to show the hull. Existing ownership and cargo survive the change.

Buy a Coastal cargo boat at a boathouse, with the Captain skill if required.
Its default 2,000-weight hold is separate from your 60-weight bag and shared
provisions. Load meals for the crew through **Boat provisions & crew**; goods
in the freight hold remain merchandise. W/S set persistent throttle, B idles it,
F4 switches the engine and C opens the wheelhouse view.

Stop at a boathouse berth, fishing pier or compatible freight quay and open
**Inventory → freight hold**. Load/unload your bag or an owned dockside stockroom,
or buy and sell directly with shops within 30 m of the shore entrance by default.
Transfers have a progress countdown; cancel before completion to move nothing.
Full holds, unsuitable goods, empty sellers, unfunded buyers and changed quotes
are refused. Stock and cash move only when the transfer finishes successfully.

Step ashore to leave freight with the visible moored vessel; return to that
landing to board it again. The default coaster is too large for river docks.
World builders can give a canal boat its own freight hold for river use.
Build an open **Freight quay** from the Build menu, facing deep water; its
preview checks the whole berth. Quays board owned boats; boatyards sell them.

Crew shares use realized freight margin after sold-goods cost and consumed fuel
and provisions. Settle at the dock before spending the cash owed to your crew.
See [Coastal freight](HAULAGE.md#coastal-freight) for prices, cargo restrictions,
construction materials, recovery and a measured profitable example route.

## Rowboats and storm shelter

Buy a **Rowboat** at a boathouse or the fishing pier for **4s** at default prices.
It carries **30 weight**, a rower and one passenger, and needs no fuel. Hold W/S
or the arrows to row at up to **1.6 m/s**; Shift adds no rowing power. The passenger
rides without steering or rowing. Rowboats cannot be carried or used as motorboat
tenders. Your ordinary inventory is the small boat's load, rather than a separate
freight hold.

Stop beside a clear dry shore or riverbank, then use **Inventory → Boating →
Disembark on foot**. The entire hull must stay afloat in at least **8 cm** of water;
the boat's centre must be no deeper than **80 cm**, with a dry bank within **4 m**
and no more than **1.2 m** above the water. Gentle contact at rowing speed stops the
hull without powered-boat damage or recoil. Steep cliffs, obstacles and deep water
are not landing places. Have your passenger disembark first. The boat stays
visible with its oars stowed and persists through restarts. Return to its shore
landing to board it again. Boathouses, the pier and compatible river docks also
work. By default only its owner can board a beached rowboat; worlds that allow
public pickup transfer the existing boat to someone who does not already own one.

**Storms can capsize small craft.** Canoes, rowboats and lifeboats are vulnerable
in exposed bay or sea water. Rivers, ponds, sheltered shore water and calm or
merely rough weather are safe from capsizing. Motorboats and canal boats are
vulnerable only in a large storm, beyond the world's true-ocean thresholds:
by default more than **50 m deep**, at least **1.5 km clear of land**, and wave
amplitude at least **1.8 m**. Trawlers, charter boats, tugs and cargo boats are
exempt by default. Shore clearance is sampled conservatively; it is not a
precise charted line.

Read **Sea and shelter** in Inventory before departure. It shows the current
sea state and the next **five minutes** of storm forecast. A private warning
appears when you enter dangerous water ahead of or during a storm. Turn back
promptly: at default rules you receive at least five minutes without capsize
risk, or longer when the estimated return at your boat's available speed needs
it. The allowance is calculated once on entry and does not grow if you continue
farther out. Afterward, risk rises over five minutes. Reaching shelter resets
exposure; reconnecting does not. The allowance estimates distance and speed,
not a navigable route around every obstruction. Keep an accessible refuge in view.

A capsize kills everyone aboard, including passengers and paid crew, through the
ordinary respawn rules. Small craft follow the world's boat loss/recovery policy.
A capsized motorboat or canal boat and its cargo are destroyed even in a world
that normally allows recovery. A public loss notice names the boat, position and
sea state. All these defaults can be changed by the world builder.

## Working workshops and hangars

Industrial bay doors open during the world's business hours and close for the
night. Their rooms show the trade at work: tractors on garage lifts, brewery
kettles, sawmill machinery, warehouse racks, forge hearths and boats undergoing
repair. The flying-club hangar has two biplanes; the parked one uses your selected
aircraft paint. Warehouse stock, hay stacks and livestock reflect the building's
current contents. Confirmed boats stored at a boathouse appear in its workshop
or lifting hall and disappear when boarded again.

Doors roll, slide or swing over a few seconds, with nearby machinery sounds for
rolling/sliding doors. World owners can change the hours or leave doors open or
closed. These are visual interiors; normal building interaction and collision
rules still apply. Performance graphics retains the large equipment with fewer
details, and world owners can reduce or hide interiors in F10 → Rules.

## Parking and arriving

Use **Find tractor** on the HUD, in **Menu** or **Inventory**, or in **Actions** on
phones. The navigation arrow and distance point to your nearest owned parked
tractor, including its garage if individually stored. Spare tractors in shared garage
storage have no outdoor marker. This also works while using another
vehicle; it does not choose an aircraft or another player's tractor. Worlds that
require a printed Parish map still require one for navigation. If there is no
parked tractor, the menu button explains that instead of changing your destination.

In worlds with **Vehicles persist in the world** enabled, switching to walking
leaves your tractor or grounded aircraft where you stopped, with its own fuel,
paint and condition. The driver's body steps down beside it; an attached trailer
stays with the machine. Return within the world's boarding reach (3 m by default)
to board. The HUD shows its distance and direction, and **Mark parked vehicle**
adds a waypoint. Your parked machines also appear as gold squares on the parish
map and minimap. Individually stored machines are marked at their garage; invisible
spare-tractor storage does not leave markers at the old parking spots.

An empty tank stays empty while you walk. Buy Fuel into your inventory, return to
the machine and choose **Refuel parked vehicle**, or use Fuel from Inventory while
beside it. The control explains missing fuel, a full tank or an out-of-range
vehicle. The amount per Fuel follows the world's item definition. Other players
can help when the world's roadside-refuelling policy allows it.

By default, only your current (last-used) tractor stays outside, wherever you leave
it. Your other tractors wait invisibly in garage storage with their fuel, paint,
condition and any parked hitched trailer intact. Visit any completed tractor garage
and choose **Trade & services outside** to switch models. Selecting a spare stores
the previous tractor, even if you arrived on foot, and drives the chosen machine
out to a clear point. Buying another tractor works the same way. Your currently
parked tractor must still be boarded where you left it; selecting that same model
at a distant garage does not recall it.

World builders can turn **Store spare tractors in garages** off to keep several
tractors parked outdoors. Already stored spares remain safely in storage until
retrieved. Individually stored machines can appear in garage interiors; shared
spare storage is invisible. Boats and aircraft keep their existing parking,
mooring, crew, lifeboat and refuelling rules.

Press **E/Ctrl**, click a building or use the touch/controller interaction to park
at a clear kerb and walk to its entrance. The panel opens after you enter. For garage repairs, trailer purchases, bulk
loading or butcher-ramp work, choose **Trade & services outside** beside the
nearby-building control (also in the mobile actions menu) to keep your current
vehicle and hitch. Existing range and cargo checks still apply; a nearby parked
hitched trailer remains available to its owner for shop trades. Close
the building panel or press Escape to walk back outside. Mounting and dismounting take 1.6 seconds
at defaults, with movement held during the sequence. Full building arrivals take
2–4 seconds; the owner can select quick or immediate arrivals. Home and booked
lodging offer **Depart on foot** and **Depart in tractor**. If your tractor has
been moved, walk to its current marker instead.

Signing off while driving leaves an empty, unlit vehicle visible to others.
Signing back in restores your seat; signing off on foot returns you on foot.
Vehicles left on public roads beyond the parking grace can be towed to a clear
home kerb or garage. The default grace is seven game days (70 real minutes of
world simulation), including offline catch-up; the default fee is 20d, recorded
in your journal. Own property, garage storage and hangars are protected. Without
a safe destination or funds for the fee, towing is deferred. Absence-limit removal
also clears the absent player's parked vehicles.

Other worlds keep instant switching unless their owner enables persistence.
Check **World rules & leaving safely** and the first-steps guidance for your
world's choices.

## Player-built river bridges

Open **Build → River bridges** while standing on a dry river bank. Use your current
bank, click the opposite bank on the local survey map and choose a single- or
two-lane span. **Survey selected span** checks the full foundations, dry ramps,
grade, reserved land, existing roads and boat clearance before quoting the bill.
A rejected survey explains what to change. The preview shows span, clear width,
approach length, clearance, total materials and founding deposit.

Bridges are major shared projects. At default prices an 8 m × 40 m main span costs
800s plus 600 Steel, 200 Wood, 1,000 Gravel and 400 Stone; approaches add cash,
Gravel and Stone. The founder pays a 10% cash deposit and owns the reserved site.
Nearby players with construction permission can contribute explicit cash and
carried materials; **contributions are final and nonrefundable**, including on
removal. Deliver goods to either end, enter quantities and select **Contribute
selected amounts**. Other players' payments update the remaining bill. The deck
opens only when the entire bill is funded and the site remains safe. The default
limit is two unfinished projects per founder and 64 projects/bridges per world.

Finished bridges carry tractors and loaded trailers. Keep your whole rig inside
the rails; approach and reverse along the lane. Boats pass underneath if their
configured air draft fits; bridge foundations occupy only the dry approaches.
The default design leaves 10 m beneath the main deck above surveyed high water.
Public, free bridges connect ordinary and paved roads; existing ford routes stay.
Town and city journeys can select a suitable crossing. An isolated bridge alone
does not start an unrelated public road to its location.
Private or tolled crossings are excluded from automatic public road routing.

Access is public and toll-free by default. World owners may make crossings
owner-only or set a toll. At either bridge office, **Buy passage** explicitly pays
the displayed toll to the world treasury. Movement never charges automatically.
A passage lasts until your whole rig has cleared the bridge; reversing and
retreating do not charge again. Access changes or wear do not remove the deck
under an occupant. Death clears private passage permissions.

Condition wears by 0.01 per economic game day by default; new entry closes below 20. **Pay for repair** restores up to 25 condition for 500d and 10 Steel on the
reference 320 m² span, scaled by area. The owner or a caretaker can remove a
bridge only with an empty crossing; no contributions are refunded. Keep parked
vehicles, buildings and new fields outside its reserved passage and ramps.
Terrain, water or obstruction edits trigger a safety inspection: entry closes
while it runs, and a failed check explains what needs restoring. The saved deck
stays in place. All design, funding, access, wear and repair rules are in
**F10 → Rules → Player-built bridges**; displayed live terms override defaults.
