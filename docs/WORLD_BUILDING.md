# World creator studio

New to the editor? Follow the [illustrated world-building guide](WORLD_BUILDING_GUIDE.md) for screenshots and worked examples. This page is the compact reference.

Owners edit designs/models/rules/layouts; visitors interact and play without edit permission. Test in a separate world and export before major edits.

## Start a world

From the galaxy directory choose **Create a world**. Choose an economy village,
vehicle playground, team deathmatch, capture the flag, capture point or blank
creator canvas. Expand **Customize economy, survival, time and combat** and tick
**Use these custom rules** to override the preset before creating the world.
Arenas disable hunger/thirst by default and clear village businesses except the
spaceport. The blank canvas clears that village too; terrain, the shoreline and
existing activity landmarks remain. Each host permits eight worlds per owner
and 100 worlds total.

Land, then open **Editor / F10**. On a phone, use **Menu → World editor**. Edits apply live and persist.

Use **Editor → Buildings → Manage existing buildings as caretaker** to edit another property’s stock, prices, wages or capital. Normal building panels use personal ownership; caretaker authority does not make every business yours.

Open **Caretaker dashboard** from the world menu, or press **F6**. On a phone it is under **Actions → Caretaker dashboard**. Only the world creator receives it. The dashboard lists every pilot and AI resident (cash, bank, hunger, thirst, health, skills, job, inventory, loans and the activity log) and every building (till, stock, prices, staff, production, guest stores and accounts). It refreshes every few seconds. Private letters, secret ballots and the terms of unaccepted trades stay sealed.

## Build a capture-the-flag arena

1. Create a **Capture the flag arena** world.
2. In **Arena**, name the teams, set bases at least 20 metres apart, choose a
   round duration, score limit, spawn protection and allowed weapons. Fixed
   modes make every join use that game. Saving different arena rules ends the
   current match so old flag carriers cannot carry into the new layout.
3. Use **Landscape** to sculpt hills. **Layout** can undo individual brushes.
   Add safe or no-build regions in **Zones**; remove them in Layout.
   Building placement and geometry edits also preserve a 12 m clearance around the
   parish respawn, 8 m around each town centre, and the full radius of explicit spawn
   zones. These arrival clearances apply even without a no-build zone. Existing
   buildings are not automatically moved; renaming them remains allowed.
4. Use **Workshop** and **Objects** to place cover, flags/signs and obstacles.
   Bases and the capture ring render at their configured coordinates.
5. Invite two players and use **Activities** to join. Existing team balancing,
   friendly-fire protection, flag return, respawning and scoring use the new
   settings. **Players choose** leaves mode selection open, sharing the displayed
   round/score settings across modes.

In **Towns**, edit the town charter: whether players may found towns (cost, required skill, town limit, minimum spacing), the initial and maximum border radius, whether borders grow from outskirts construction, whether building outside every border is allowed, governed by the nearest town or forbidden, the forms of government towns may use (the first is the default for new towns), which rules town governments may change, the maximum town tax, tax notice days, election term/registration/voting days, minimum candidates, candidate deposit, whether campaign payments are allowed, candidate skill, voter residency days, proposal quorum and voting days, and the default zoning for new towns. The owner can also change any town's rules or appoint its mayor from its plinth. Exported designs include the charter.

In **Rules**, configure taxation, starting cash, professions, survival, building
limits, combat, sea level and the decorative day clock. Estate rules choose whether stock/investment survive death, their share of an unclaimed asking price, and the yearly discount. The farming calendar
remains independent of the decorative clock. In **Layout**, switch generated
vegetation and roads/streetlights on or off, or choose natural weather, clear
skies, rain, snow or a storm. Weather overrides affect crops, accumulated snow
and traction as well as visuals. Snow adds
12 cm per game day by default and snowstorm adds 48 cm; leaving either override enabled
keeps accumulating snow. Clear skies allow daytime thaw (12 cm per sunny day),
while rain/overcast skies and night do not. Winter retains its first 4 cm until
spring. A frozen night clock prevents thaw; a frozen sunny clock supplies
continuous sunlight. Roads stay exposed at any depth.

## Climate rules

**F10 → Rules → Climate** controls seasonal precipitation, storm strength and
snowfall. The same controls are available when creating a world, and travel with
exported world designs. Missing settings use the defaults below; existing worlds
retain their weather unless their owner changes a rule.

Wet-event chances range from 0 to 1: spring and summer default to **0.64**, autumn
to **0.9**. Each winter draws its chance between **0.25** and **0.75**; the minimum
must not exceed the maximum. These are chances per two-day weather opportunity,
not the fraction of time raining. Zero disables that season's natural wet events;
one still retains the gaps before and after events. Date/world seeds, event
onsets, duration and temperatures retain their existing formula.

The storm-strength threshold defaults to **1.1**, range 0–10. Lower thresholds
make more wet events storms; long snowy events also become storms. Blizzard chance
defaults to **0.028**, range 0–1, and applies to snowy events in any season.
Natural snowfall is **0.018 × event strength**, plus **0.15** during blizzards,
in metres per game day. Forced snow and snowstorm default to **0.12** and **0.48**
metres per day. Each snowfall rate accepts 0–10; zero stops its contribution.
Layout weather overrides ignore natural wet-event chances and use the forced rates.

Changes apply immediately to weather and future accumulation, preserving the
snow already on the ground. They do not reset dates or reroll event timing.
The local rules summary and resident observations report the effective values.
Invalid bounds reject the whole edit or import. Snow lines, season lengths and
calendar speed are separate from these precipitation controls.

## Alpine climate

**F10 → Rules → Alpine climate** applies to worlds with the northern-island
alpine biome. Permanent snow begins at **1,180 m** above sea datum and reaches
full coverage at **1,390 m** by default. Both heights accept 0–10,000 m; full
coverage must be strictly above the start. The **Permanent summit snow** switch
is on by default. Disable it for bare summer summits without removing seasonal
snow, changing mountain heights or stopping snowfall. Near terrain and distant
mountains follow edits immediately, without rebuilding their geometry.

When lowland rain becomes alpine snow, its rate is **0.018 + intensity × 0.06**
metres per game day. Both rate coefficients accept 0–10; set both to zero to stop
that accumulation. Already-snowy weather keeps the general Climate rates. Clear
weather creates no snowfall, and the existing altitude/temperature formula is
unchanged. Worlds without this biome remain unaffected.

Controls are available at creation, persist in saved worlds and exported designs,
and appear in local summaries and resident observations. Existing snowpack is
preserved. Missing keys use the defaults; invalid or inverted limits reject the
whole edit/import.

## Calendar rules

**F10 → Rules → Calendar** controls the year and seasons. `calendarYearDays`
defaults to 365; `calendarSpringDay` to zero-based day 59; and
`calendarSpringDays`, `calendarSummerDays`, `calendarAutumnDays` to 92, 92, 91.
Winter is the remaining 90 days, split across the year boundary. Use whole days:
a year is 4–3,650 days, each named season 1–3,650 days, and spring start 0–3,650.
Leave at least one winter day; spring start cannot exceed winter's length.
For example, a 120-day year with spring starting on day 10 and seasons of
30/40/30 days leaves 20 winter days. Invalid combinations reject the whole edit
or import. New worlds start at their spring boundary.

A game day stays 600 real seconds. Seasons govern planting, winter crop losses,
weather and daylight; year length also governs future ageing, building wear,
estate discounts and new loan periods. **Editing the calendar can immediately
change the season, weather, daylight and estate prices, or kill unharvested crops.**
It preserves saved time, existing ages, snowpack, land and signed loan timing.
Crop growth days, lottery intervals, lunar timing and existing deadlines remain
independent. Defaults and old saves retain the original behavior. These fields
persist in saves/designs and appear in local rules and resident observations.

**F10 → Rules → Calendar** sets the lunar phase period, default **28 game days**.
Acceptable periods are 1–3,650 days, including fractions. The same value drives
the two visible moons and lunar tides; solar motion and wave strength retain
their existing behavior. Tidal range remains a separate rule; zero range keeps
sea level fixed regardless of the lunar period.

Changing the period can immediately change the current phase and tide, without
resetting saved time. Moon phases follow the economic date, including across
year boundaries; freezing or moving the decorative clock rotates the sky without
resetting those phases. Existing five-day phase offset and binary-moon motion
remain unchanged. Year and season edits do not retime the lunar cycle.
`lotteryDrawDays` in the same Calendar fieldset independently controls the lottery
interval; see [Parish lottery](#optional-parish-lottery).

The period is available at world creation, appears in local rules and resident
observations, and persists in saves and portable designs. Missing keys use 28;
invalid/non-finite values reject the whole edit or import.

## Make a tree, vehicle or building

**Workshop** starts with a tree, building or rover template. Edit the name and
parts: box, cylinder, cone or sphere, each with color, position, dimensions and
rotation. Dimensions use metres and angles use degrees. Drag the live preview
to rotate. Save the model before assigning it elsewhere.

A model can also use an image or a self-contained GLB uploaded in **Assets**.
PNG/JPEG images appear as upright, two-sided panels. GLB models are grounded,
centered and uniformly fitted inside the chosen width/height/depth, preserving
aspect ratio. Remove primitive parts if you only want the uploaded visual.
Failed GLB loads retain a wireframe placeholder.

- **Objects:** place, name, rotate, resize, duplicate and remove scenery. Set a
  radius and **Solid obstacle** for collision, or leave it passable as a trigger.
  Click the object or approach and press E/Ctrl to use its interaction button.
- **Layout:** select a functional building to load its saved name, position,
  rotation and visual assignment. Changing appearance retains its business,
  owner and inventory. Custom bounds define its collision footprint. Occupied
  homes and buildings with running tasks cannot be moved until occupants leave.
- **Workshop → Use as a vehicle:** assign a saved appearance to any of the 34 vehicle slots. **Vehicles** configures that slot's movement, performance, economy, cockpit, components and capabilities independently for this world. Slots 9–24 in the menu are available for original designs; walking, creature, scout and lifeboat modes are reserved.
- **Production:** select a building, profession and batch duration, then choose
  up to eight input and output items with quantities. Recipes use normal stockroom/payroll/capacity/scheduling without JSON.
  Farms keep their crop-plot mechanics. Editing a recipe resets batch progress.

You cannot delete a model while objects, buildings or vehicle slots still use it.
Designs do not bundle media; upload/reassign it on another server.

## Add behavior without code

In **Behaviors**, create named rules:

- **Player interacts:** a specific custom object or building. A building with
  such a rule gains a **World interaction** button on its Main tab.
- **Player enters region:** crossing into an object radius, a zone or the
  12-metre region around a building. Entry is sampled once per simulation second.
- **Repeat timer:** each online, outdoor player, at most once every five seconds.
- **Player arrives:** when a human player lands/connects to this world.
- **Player finishes a task:** all tasks, or a selected building/resource target.

Optionally require a team or a carried item. Choose a message, health change,
hunger/thirst change, item grant/removal, teleport, score change or object
visibility. Use multiple rules on the same trigger to compose effects. Imported
rules may have up to eight effects; the editor changes the first and preserves
additional effects. Signed amounts can remove items or reduce health/needs;
health effects stop at one health point, so damage rules do not silently bypass
the normal death/estate system. Lower hunger/thirst values are better.

Example: place a **Water tree**, create an interaction rule targeting it, choose
**Give / remove item**, **Water**, quantity **1**, cooldown **30**. A visitor can
receive one water every 30 seconds, provided their vehicle can carry it. A second
rule can display a welcome message. Items are world-local supplies, not payments
from another player’s stockroom. Timers and effect bounds prevent accidental
unbounded work; use reasonable cooldowns on public worlds.

Cooldowns and entry detection are runtime state and reset after a server restart
or design save. Variables saved by Lua persist. Item effects that exceed cargo
capacity or available quantities do nothing; they never create negative stock.
Teleporting is ignored while a player is busy, at home, hitching or in a robocrow.
Choose clear, safe destination coordinates. Creator scripts/rules may give supplies
inside their own world but do not grant account access or inter-server balances.

## Advanced scripting and reusable designs

**Script** provides bounded Lua events and effects, with no network/filesystem or
OS access. See [the complete scripting guide](SCRIPTING.md) for event payloads,
examples, cooldowns, limits and failure behavior.

**Transfer → Download world design** exports settings, terrain, zones, custom
models, placed objects, behavior rules, scripts, building layouts/appearances,
prices/wages/recipes, civilization tier and vehicle/trailer tuning. **Create world from
design** validates the file and creates a separate world; it cannot overwrite
occupied worlds. Players, accounts, chat, stock, investment, inventories, match
progress and script variables are excluded, except the cargo of parked fuel tankers. Parked fuel tankers retain their position, heading, Fuel load and sale price; attached rigs and other trailers are omitted. Imports validate clear dry placement and tuned capacity, and assign these tankers to the new world owner. Imported businesses belong to the
new world’s owner and start from ordinary building defaults. Asset-only models
become labelled gray placeholder shapes until their media is uploaded/reassigned.
A rejected import does not add a world to the registry. Use the media bundle option to retain model and texture bindings.

## Practical limits and extension points

Each world has a square map whose side is the `mapSize` setting (500–100,000 m,
editable live in **Rules**). A new economy world starts at 12,500 m. Public
Puddlewick's travel boundary is an 89 km square around a mainland about 35 km
across and about 42 km from north to south. Arenas and playgrounds, and worlds
saved before map sizes existed, keep the 500 m footprint. The central 500 m village terrain is unchanged at any size; beyond it
the countryside is generated deterministically from the world id: rolling hills,
woods, inland lakes, a harbour inlet south of the village and an island coast
that falls into open sea before the map edge. Woodland clearings, outcrops,
gravel hollows and soil banks are placed on a 400 m lattice with stable ids, so
reserves and NPC errands survive restarts. Creator objects, heightmap imports
(33 × 33 across the whole map) and the shoreline survey still work at village
scale. Limits per world:
64 models, 32 parts per model, 128 placed objects, 64 behavior rules, 128 zones,
a default 256 terrain stamps (configurable in Landscape limits) and 500 buildings. Uploads allow 32 assets, 2 MiB each, with
images no larger than 2048 × 2048. GLB supports embedded geometry/textures,
up to 256 nodes, 128 primitives, 32 materials and eight textures, with a combined
300,000 accessor-element budget. No external URLs, compression/extensions,
sparse accessors or morph targets are accepted. Up to eight five-minute animation clips, four skins and 64 joints per skin are allowed. Choose a clip index and playback speed in Workshop; -1 keeps it static. Nearby animation is capped at 24 models.

Detailed repeated imports can slow phones despite these limits. Use few colors/simple shapes; same-color parts merge. Models change visuals, not the physics engine. Shader scripts and arbitrary client JavaScript are outside this editor. Imported rigs play their authored clips; they do not replace the built-in human character controller.

Developer entry points: `shared/creator.ts` owns validation/actions/effects;
`client/creator-editor.ts` owns forms; `client/creator-model.ts` owns rendering;
`server/world-design.ts` owns portable layouts; `server/asset-validation.ts`
checks renderable uploads. Test changes to all four paths: authoritative action,
saved/reloaded state, browser controls and untrusted input rejection.

## Player assistance rules

**Allow Money Gifts** (`allowMoneyGifts`) and **Allow Player Refuelling** (`allowPlayerRefuelling`) are independent boolean rules in creation's custom settings and **Editor → Rules**. Both default to true, including when loading older saves. Disabling a rule immediately prevents its action for all players, including AI residents; re-enabling it needs no restart. Existing explicit choices are preserved when loading a world. Money gifts conserve total cash and are recorded as transfers in the ledger; refuelling consumes carried Fuel and never creates free supplies.

## OBJ models and textures

Make a static mesh in Blender or another modelling tool; [Blender's OBJ exporter](https://docs.blender.org/manual/en/5.0/files/import_export/obj.html) exports geometry, UV coordinates and normals. Triangulate faces, export normals, and use one UV texture atlas. Upload the `.obj` and its PNG/JPEG separately in **Assets**. In **Workshop**, select the OBJ as the uploaded visual and the image as **Primitive/OBJ texture**, set the metre bounds, then save. Bind it to scenery, a building or a vehicle as usual. A blank texture selection gives plain geometry.

Each file is limited to 2 MiB; images to 2048×2048; OBJ to 50,000 triangles and 60,000 records of each coordinate type. Positive/negative face indices and polygon faces work; curves, point clouds, animation and vertex-color shading do not. Material-library paths are ignored: no external `.mtl` or remote textures are fetched. For multiple materials or embedded textures, use the existing self-contained GLB workflow.

Visitors download models/textures automatically through the game's hosting prefix, with immutable browser caching. A wireframe box marks loading or failed geometry while collision remains stable. Media-free designs keep placeholder geometry. **Transfer → Export design + media** includes up to 8 MiB of content-hashed media (32 assets, 2 MiB each), plus author, licence and source credits. Import validates every hash and asset before creating a world. Only export media you have permission to redistribute; uploaded media does not automatically become GPL-licensed.

## Survival and death rules

At world creation or **Editor → Rules**, set hunger/thirst rates to zero for worlds without survival needs. Independently untick `loseSkillsOnDeath`, `loseInventoryOnDeath`, `loseJobOnDeath` or `losePropertyOnDeath` to retain those possessions/status. Keeping skills also keeps a course in progress; keeping a job retains its existing shift expiry. Ordinary death still respawns and restores the character's needs; arena knockouts keep their existing separate rules.

The **Boats and death** group independently controls boats. **Lose all owned boats
on death** (`loseBoatsOnDeath`) removes active, moored and stored boats plus their
contents. Puddlewick enables this once on upgrade; later owner edits persist.
Other worlds default to recovery: an offshore vessel stays in place after its
captain dies. **Recoverable cargo lifetime** (`boatCargoSpoilageDays`, 0–365 game
days) defaults to five; zero disables spoilage. **Keep tank fuel in recoverable
boats** (`retainBoatFuelOnDeath`) defaults on. The lifetime/fuel options apply only
when boats survive death; each abandoned cargo keeps its assigned lifetime.
Paused worlds and a frozen day/night clock pause spoilage. See [boat recovery](BOATING.md#death-and-boat-recovery)
for lifeboats and passenger transfers. Ordinary fuel emergencies remain recoverable
under either death policy.

`deathCashRetention` and `deathBankRetention` range from 0 (lose everything) to 1 (keep everything). Loans are never erased; a retained mortgaged property keeps its loan, while released collateral goes through foreclosure. Existing estate-content and valuation rules govern released ordinary buildings. Guesthouse protections remain unchanged.

`maxOfflineDays` uses **real days**, with 0 disabling the rule. Once per absence, exceeding it triggers ordinary death under that world's configured penalties; logging in starts a new absence period. Turn needs off and retain selected possessions to make an activity-based world, or disable the absence limit too for a relaxed sandbox. These changes do not alter Puddlewick defaults.

## Local procurement

Enable `parishOrders` and set `parishOrderBudget` (integer hundredths of a denarius per real hour) in world settings. A completed, government-owned market is required as collection point. Puddlewick enables this once on upgrade; later operator edits are preserved. Disable it to remove this source of public demand and money.

## Quests and access requirements

In **Quests**, name a quest, write its instructions and add up to eight ordered objectives: buy, sell, take a job, qualify, complete construction, gather, or interact. Select a named target and optional item/quantity; “Any” matches all. Set up to eight item rewards and a reputation reward, plus whether death resets progress. Players accept from **World / F9 → Quests**; only subsequent events count. Claims require space for the entire reward and cannot be repeated. Revising a definition invalidates old progress. Rewards are creator grants, so balance them deliberately.

In **Access rules**, require a qualification, carried item or minimum Lua progress value before trading, taking a job, studying, building or interacting. All configured conditions must pass; failure displays your explanation without changing inventory, cash or employment. Target a named building/object or a construction type, or all targets. These requirements apply to human and NPC actions alike. Each world supports 32 quests and 32 requirements; designs export their definitions but never a player's progress.

## World catalogues and building templates

**Catalogue** defines up to 32 custom goods and 16 professions. IDs start with `custom:` and stay stable; built-in goods/skills are unchanged. Goods have a label, short icon, weight, reference price and optional food/drink/fuel effect. Health effects range from −6000 to +6000 per serving, and maximum-health changes from −600 to +600; the latter accumulate within the world nutrition adjustment limit (default ±6,000) for the current life and reset on death. Inventory shows these effects. Professions have a label, tuition, lesson duration and up to eight prerequisites; cycles are rejected. Schools show actual course prices and prerequisites.

Use custom definitions in **Production**, behavior item effects, quest rewards, shop quotes and building stock. Custom supplies obey cargo limits and feed sheltered players offline. Referenced definitions cannot be deleted; changes to weight/value/effects apply to existing goods. Recipes in use must retain valid professions and items. Lua source is not statically analyzed; update scripts yourself when changing their referenced definitions.

**Building templates** copies a building's base type, recipe, shop prices and visual into a reusable construction option. Give it a `custom:` ID, name, construction price, wage, ideal active employees (1–16) and materials. Future buildings use the template; existing buildings retain their economic settings. Ideal crew size is resolved from the template, so changing it also updates existing template buildings without resetting their stock or payroll. Templates obey ordinary siting, shoreline, material and property-limit rules. At most 32 are allowed, and a template with existing buildings cannot be removed.

The **Production chain check** estimates one batch with the ideal crew using input bids, output asking prices, sales tax and wages, and lists possible suppliers. It flags missing bids/suppliers and nonpositive margins. It is a planning estimate, not guaranteed profit: delivery costs, unsold stock, shortages, repairs and idle time remain relevant. Catalogue definitions and templates travel with exported designs; accounts and inventories do not.

## Landscape editor

In **Landscape**, tap the village map to mark points or enter X,Z pairs anywhere within the world's map (±`mapSize`/2; −250…250 on compact worlds). Draw a curved/straight gravel path or a timber fence/stone wall. Set width and barrier height. New paths appear on parish maps and receive streetlights; generated roads can be disabled separately in Layout. Solid barriers stop ground movement and shots; NPC routes avoid them.

**Lanes grow on their own.** The parish lays up to **12 m of road per game day**, usually 5 m wide. It prioritizes bypasses around buildings and farm plots, then connections between towns, then isolated buildings and construction sites. Town connections grow from both ends and join existing local lanes when possible; a private lane beside a remote town does not count as a connection to the original town. Bypasses keep all approaches to a junction connected and remove the old obstructed sections only after construction finishes. Existing wider roads keep their width on the bypass.

Routes avoid buildings, all farm plots, water, solid barriers and the map edge. Public works respect towns that disable road building for both residents and guests; individual building spurs also respect the owner's road permission. An obstacle added during construction causes replanning. Roadwork and daily progress are saved across restarts, and completed lanes appear on maps, in streetlighting and in NPC routing. A world without any existing lanes has no network to extend. Impossible routes wait for conditions to change; this system does not construct bridges or cut through impassable terrain.

Paint circular grass, gravel, soil or sand patches; the first map point sets the brush centre. Scatter a Workshop tree/rock model with a seed, count and scale. Rotation/size vary deterministically; roads, buildings, water and overlaps are avoided. Crowded areas can yield fewer instances. Solid scatter uses the model's bounds; editing terrain/layout may reposition it.

Preview a PNG/JPEG heightmap (2 MiB, 2048 × 2048 maximum). Image brightness maps between your low/high heights; the server stores a 33 × 33 grid across the playable square. Blue preview cells are below sea level. **Apply previewed heightmap** replaces the procedural base; existing height brushes remain additive. Terrain, buildings and water checks use the same heights. Review shoreline businesses before applying.

**Undo last landscape edit** restores one of the last four saved path/surface/barrier/scatter/heightmap states, including after a restart. Remove individual features below the editor; remove older height brushes in Layout. Edits are free and caretaker-only. Default limits: 16 paths, 16 barriers, 128 control points total, 1,200 metres of barriers, 64 surface brushes and 128 scattered instances. Configure these in Rules → Landscape limits; the editor shows local capacities. Exported designs include the current layout, not undo history.

## Vehicle rules

Rules include **Vehicle maintenance** (distance wear on/off), **Vehicle licences** (driver, pilot or captain required for advanced slots according to their configured movement mode), **Require the captain skill for boats longer than the motorboat** (`requireCaptainSkill`, on for new worlds; public Puddlewick adopts it once and qualifies existing owners) and **Require map item** (hide visitor maps unless carrying a Parish map). Defaults enable gentle wear but leave the general licences and map ownership optional. Basic tractor, walking, ostrich and disposable robocrow controls are exempt from licences. The motorboat and lifeboat stay open when only the captain rule is on. In the vehicle editor, **Requires captain** forces or waives the rule for that slot; otherwise length above the motorboat's 4.3 m decides. Creator maps remain available for editing. Garage map printing and steel-part servicing are ordinary paid services, also available on existing saves.

## Gathering ground scenery

**F10 → Rules → Gathering scenery** controls `gatheringScenery`: **natural**,
**worked-near-settlements** (default), or **always-worked**. Natural grounds have
no tools or wear. The default adds a small earth footpath inside a town or within
`gatheringTownDistance` metres of its edge (default **100**, range **0–5000**),
while a site's reserves are depleted, during an active gathering task, or within
`gatheringRecentSeconds` of its last recorded use (default **600** simulation
seconds, range **0–86400**). Zero disables the recent-use window; a zero town
buffer still includes sites inside the town. Regrown remote sites lose their wear
after the window expires. Always-worked restores the legacy wheelbarrows, shovels,
hammers and cut timber for compact village worlds. Changes apply to loaded sites
and travel with saved worlds and exported designs. Custom Resource visuals take
precedence. These rules affect scenery only, not gathering, inventory tools or
business buildings.

## Solid scenery and vehicle contacts

**F10 → Rules → Solid scenery and vehicle contacts** configures land contacts.
`solidScenery` defaults to `trunks-and-boulders`; choose `trunks` or `off` to
remove rock contacts or all procedural scenery contacts. This does not remove
visible scenery. Turning creator scenery off removes its procedural obstacles as
well as its meshes. Roads, farm plots, pastures, building sites, airfields, water
and reserved arrival areas remain clear of generated trees. Coastal outcrops and
stone gathering-ground boulders share their positions with their visible models.

`vehicleCollision` defaults to `glancing`; `stop-only` stops entrants at every
contact, while `off` permits players to pass through one another.
`pedestrianBlocking` defaults true and can be disabled separately.
`vehicleGlancingDegrees` defaults **15°** (0–45); `vehicleGlancingSpeed` defaults
**0.7** (0–1). Shallow side contacts slide at that speed multiplier. Rear-end
contacts stop the entrant; opposing moving vehicles stop both drivers. Contacts
never push the other player and cause no damage. Trunks and rocks stop vehicles
without fuel or condition penalties; walkers slide round trunks. Crowns do not
block. The same collision rules run on the server and in local prediction.

`offlineVehicleObstacleSeconds` defaults **60 seconds** (0–86,400); zero ignores
an offline driver immediately. Signed-off vehicles remain visible until their
blocking timeout expires. Home occupants, passengers, boats and airborne
players do not block land travel. Grounded aircraft do. `clearRouteParking`
defaults true: engine-off parking is refused in arrival/town-centre reservations,
the spaceport gate and jetties. Existing arrival/town clearance settings determine
those buffers. Turning this rule off permits parking there; it does not move any
vehicle. The later bridge feature must register its narrow passages with this
same policy.

In **F10 → Vehicles**, `length` and `width` set each land vehicle's oriented
footprint; the walking slot uses `collisionRadius`. All these rules and catalogue
edits persist in saves and portable designs. Rule changes preserve vehicle
ownership, position, fuel, cargo and condition. Someone inside a newly solid
object can move outward. New road surveys, NPC routes and construction previews
consult the shared obstacle placements. Graphics quality changes only visual
detail, never the location of solid trunks.

## Walking in snow

**F10 → Rules → Walking in snow** controls `walkingSnow` (default **on**) and
`walkingSnowScale` (default **1**, range **0–2**). Ordinary walking and Shift use
the tractor's snow-depth lookup and its 2 m verge transition. Roads keep today's
clear/wet-road pace; bare-ground walking does not change.

Strength 1 uses the tractor factor exactly. Strength 0 removes the additional
field penalty, leaving wet-road pace everywhere in snow. Larger strengths apply
the field-to-road speed ratio more strongly; 2 squares that ratio. Unticking the
switch restores the previous walking pace. Turning uses the shared snowy grip.
Residents and player prediction use the same rules. These settings are saved,
shown in the rules summary and included in exported designs; old saves missing
them use the defaults, including Puddlewick. Other vehicles are unaffected.

## Flight and public runway

**Rules → Flight and public runway** controls landing sink, bank, minimum/maximum
pitch, slip and speed. Defaults are 8 m/s, 25°, −15°/+25°, 40° and 44.7 m/s.
**Strict landing contacts** selects the legacy 3.5 m/s, 12°, −0.1-radian/+20°,
0.35-radian slip and 36 m/s limits instead. Untick it to use the individual limits.
The airbrake toggle and drag coefficient (0.08), approach speed (24 m/s), keyboard
and touch authority (0.5), released-stick stability (1.6), throttle rate (0.24 per
second) and wheel braking (5.5 m/s²) apply immediately and also govern prediction.
Zero stability disables the return toward a steady attitude. Analog sticks retain
their full input range.

Ground contact also exposes the slope-sampling wheelbase (4 m), wing half-span
(4 m), wing terrain clearance (1.2 m), minimum speed for a ground wing strike
(8 m/s), and abrupt-drop threshold before wheels unstick (0.15 m). Public strip
placement uses a 10 m level clearance beyond the paint and allows at most 2 m of
grading relief by default. These values share the same validated settings and
portable-design flow as the other flight rules.

Public runway targets default to 400 m long and 30 m wide. Placement and safe legacy
upgrades are checked on server startup, use a shorter level site when needed, and
never move existing hangars or private property. The level clearance stays inside
town; a blend may extend onto clear neighbouring countryside. The shoulder blend
defaults to 18 m and changes live, so check neighbouring terrain before editing it.
These settings are available during world creation and travel with saved worlds
and portable designs. Missing flight settings use the new defaults.

## Economy and survival presets

Creation offers the existing active-work village, **Relaxed owner economy**, **Harsh survival village**, **Civilization frontier**, arenas and a blank canvas. These are starting rules, not claims of exact historical balance. Relaxed disables needs and jobs, lets qualified owners operate supplied businesses without wages, and keeps skills/property on death. Harsh doubles needs, disables unattended production and grants one real hour of needs grace after death. Frontier enables combat, owner operation and larger ownership limits; safe zones still apply.

`jobsEnabled` controls employment and paid labour. `ownerOperation` enables the qualified owner’s **Operate without wages** control; `activeWork` determines whether its two-cycle shift must be renewed. This never pays the owner wages or supplies free inputs. Farms keep their existing owner plot controls. `postDeathGraceSeconds` (0–86400) pauses needs only after rebirth, online or offline; ordinary offline survival continues. Puddlewick keeps jobs enabled, owner operation disabled and no grace. Every arrival shows the actual rules in private chat; **World → World rules & leaving safely** summarizes them before departure.

## Texture and resource authoring

In **Assets → Paint an original texture**, paint a 256 × 256 tile with mouse or touch, fill the tile and save it as PNG. Assign it to primitive models or an OBJ UV atlas in Workshop, or to grass, gravel, soil and sand in **Terrain textures**. **Resource visuals** assigns models to logs, stone, gravel and topsoil without changing their gathering rules. Uploaded imagery is cached by content hash. Loading/failure indicators keep collision bounds visible while media arrives.

## Audio zones

**Editor → Audio zones** places woodland, shore or storm ambience, or binds an uploaded MP3 to coordinates/a placed object. Set radius, volume, looping, clock hours (including overnight intervals) and a weather condition. Equal start/end hours mean all day. Hidden objects are silent. Non-looping clips play once per entry; at most four nearby zones are audible.

Use original or licensed mono/stereo clips no longer than 30 seconds (2 MiB upload limit). Invalid or oversized decoded audio stays silent. Loading is serial, with eight cached clips; there is no playback before a user gesture or in hidden tabs. Media bundles retain uploaded sounds; plain design exports omit their audio zones. Radio streams are not supported.

Players can separately adjust **Engines**, **Effects & machinery**, **Ambience**, and **Chat alerts** under **Pilot & preferences**. Master mute/volume still controls all four. Preferences persist in the browser; arrival history never triggers a backlog of chat alerts.

## Books, tutorials and events

**Books** binds up to eight text pages to a carried item; create a custom book in Catalogue or attach instructions to existing equipment. Readers use **Inventory → Read**. Reading consumes nothing and can satisfy an **Interact** quest objective targeting the book. Pages render as text, never HTML or scripts. Distribute books through shops, rewards or behavior rules.

Use **Quests** for ordered tutorials (read, gather, buy, study, take a job), including explicit rewards and reset-on-death policy. **Town events** announces recurring festivals/markets and links an existing quest. First day is measured from world creation; one game day is 600 real seconds. Repeat 0 means once. Events create no money and never replay a backlog of missed notices after downtime. Players find current events from the World menu. Both definitions travel with exported designs.

## Optional parish lottery

Enable `lotteryEnabled` in Rules; `lotteryTicketPrice` is a positive integer in hundredths of a denarius and changes at the next round. It defaults off. The World menu exposes entry, jackpot contributions, odds and recent results. Set `lotteryDrawDays` in Calendar to choose an interval of 1–3,650 whole game days
(default 365, about 61 real hours). A game day remains 600 real seconds,
independent of decorative clock speed and lunar period. First activation uses
the next interval boundary measured from world creation. Existing rounds retain
their deadline, pot, tickets and ticket price when the interval changes; later
draws use the new interval, measured from that deadline. The panel shows the
saved countdown separately from the current interval. Missing fields use 365;
creation, summaries, resident observations, saves and portable designs include
the setting. Invalid values reject the edit/import atomically. Each round admits at most 100 tickets per player, 10,000 total.

Every coin comes from a player's cash: no treasury faucet or house cut. Empty draws carry their jackpot; downtime resolves the existing draw once, without simulating fictional entries. Paid tickets remain valid if the owner disables new entries. Offline winners receive local cash, including after character death. Jackpot, entries, deadline and result history persist across restarts; exported designs omit those balances. This is in-game money only.

## Advanced robocrows

Enable `crowAbilities` together with `fighting` for open-world drone combat. **Activities** offers Scout (fast/unarmed), Interceptor (machine/plasma, stronger hull) and Bomber (slower, grenades/rockets). Each launch consumes one Disposable robocrow; weapon costs and safe zones still apply. Mark and recall move only the drone, costing 25,000 energy with a ten-second cooldown. Return restores the pilot's original vehicle and location; destroying a drone returns its pilot without death penalties or kill rewards.

Drones cannot trade, carry objectives, start jobs or enter team matches. This keeps recall separate from CTF transport. Puddlewick keeps ordinary scouting and disables advanced classes. These classes are Aclone's adaptation, not a reconstruction of eight undocumented historical ranks.

## Construction designs

Built-in types offer five architectural models with six independent finishes; supply caches use container designs and paint colours. Suitable types offer larger layouts and storage capacities. Model, finish and size travel with exported world designs. Placement checks the rotated footprint, including service yards, against terrain, other buildings and protected zones. See [Building designs](PLAYING.md#building-designs) for costs and controls. Catalogue-based custom templates use the same designer; templates with a creator model keep their authored geometry and material bill, with rotation available.

## Foundations and terrain coordinates (0.78.0)

New construction samples its rotated footprint, fixtures and entrance apron.
Sites with over 2 m of ground-height variation are rejected before charging.
Accepted buildings get a saved level foundation and simple entrance steps,
shared between placement preview and the live model. Existing buildings are not
moved. Later caretaker terrain edits can change access: review buildings after
large edits rather than expecting automatic flattening of neighbouring land.

Terrain coordinates are metres, centred at (0,0), with X increasing across map
columns and Z across rows. The 33×33 heightmap spans the entire playable square:
cell spacing is `mapSize / 32` metres. Height values are metres above the common
origin; terrain brushes add to the base height. Saved coordinates, roads, resource
markers and rotated building positions are covered by ten-round-trip regressions.
OBJ import retains its existing size/triangle/texture limits. ATM conversion is
not supplied: compatibility requires permitted sample files and verification;
public engine source does not grant rights to historical art.

## Courses and round phases (0.78.0)

The **Courses** editor provides an editable JSON example inspired by island time
trials. A course has a stable ID, title, opening/closing seconds of world time,
10–3600 second time limit, reward (hundredths of a denarius), and 2–32 checkpoints.
Each point has X/Z, a 2–20 m radius and optional 0–60 second hold. Consecutive
checkpoints must not overlap. Up to sixteen routes can coexist.

Saving the same ID revises its route, clears boards and invalidates current runs;
weekly prize claims remain. Only the sponsor may edit a funded course. Sponsors
deposit prize money through the course panel and reclaim unused money after
closing. Boards persist across restart; weekly boards reset every seven real-speed
days of world time. Design exports contain route definitions, not money or scores.
This editor uses structured text, not a map-drawing course editor.

The optional **Build / peace / war** template sets three 60–86400 second phases.
Combat is disabled during build/peace; construction is disabled during war. Safe
zones still apply. Existing arena capture/CTF rules provide objectives and scores;
results are archived when a round ends (latest 100 retained). Property, inventory
and survival persist: this is not an economy reset. Disabling the cycle restores
the previous fighting rule and keeps the result archive. Puddlewick is unchanged
unless its caretaker explicitly enables these options.

## Automatic food and drink

In **Editor → Rules → Automatic food and drink**, configure `autoConsumeInventory` (eat carried supplies while signed off), `autoConsumeInventoryOnline` (also while signed in; follows the signed-off setting when unset), `autoConsumeAlcohol` (let automatic meals include beer and wine; off by default in every world), `autoConsumeHomeStock` (use the selected owned home or active private guest-room pantry while away), and `homeNeedsMultiplier` (0–1; 0 disables indoor drain, 1 gives no indoor benefit). Home stores always feed occupants automatically. Inventory and remote-home feeding default off for other worlds, preserving existing behavior. Puddlewick enables inventory feeding while signed off and remote-home feeding, keeps inventory feeding off while signed in, and uses a 0.8 indoor multiplier; later owner edits survive restarts.

Only a valid owned home or unexpired private booking is eligible. Public lodging/business stock and another owner’s supplies are excluded. Boat crew still use their captain’s provisions first; the normal captain rule for boat stores remains offline-only. Inventory feeding also applies to online captains when enabled. The at-home provisions estimate follows these settings and includes carried supplies when available.

## Odd Jobs

In **Editor → Rules → Odd Jobs**, `labourShiftPay` is the ordinary 15-second shift in hundredths (1200 is 12d) and `labourDailyCap` is the ordinary pay a resident can earn in one game day (20000 is 200d). The first eight shifts in a row pay the full rate; later shifts pay two thirds, one half, one third, then one quarter. A ten-minute gap, a job, gathering, a harvest or a craft restores full pay. Meal relief ignores the cap and the streak. New worlds use the defaults in `data/settings.json`. Public Puddlewick is moved to 12d once (`labourRulesVersion`); a later edit is kept. Other existing worlds stay at 1d until edited.

### Coastal headlands in world designs

World-design JSON preserves `terrainMapSize` (the island footprint, separate from the larger navigable ocean) and up to 32 `coastalBluffs`. A bluff has `id`, `x`, `z`, `angle` in radians (local +Z toward water), `width` (half-width, 80–250 m), `inland` approach length (150–500 m), `height` above mean sea (15–65 m), and a deterministic numeric `seed`. Export Puddlewick’s design for examples. The ordinary height brush does not move these fixed cliff lips; edit the design and import it into a test world to reposition them. Keep them away from existing properties and put their seaward face on the shoreline. Imported headlands use the same safety boundary and lighthouse siting rules. Automatic placement/migration is limited to the public Puddlewick world.

### Business discount and farm policies

World-design exports include each building's optional `bulkDiscounts` array of `{quantity, percent}` tiers and farm `farmPolicy` (`crops`, optional `dailyLimit`, `reserve`). Configure these through the business owner's normal building menu before exporting. Empty discount tiers disable discounts; missing tiers use defaults except at public import/export outlets. Cash amounts in farm policy JSON use the smallest internal currency unit (100 = 1 denarius). Empty approved crops pause staff planting. Runtime staff expenditure is saved in the world but is not copied into a new world design.

## Designing a custom vehicle

Open **F10 → Vehicles**, select a slot and name it. Start with its movement mode: ground, road, fixed-wing flight, boat, amphibious hovercraft or vertical flight. Expand the sections to tune acceleration, top speed, steering, armour, fuel burn and tank size, cargo capacity, purchase price and passenger places. Speeds use metres per second, lengths use metres, fuel burn uses tank units per real second, and prices use hundredths of a denarius (10,000 = 1s). Configure persistent throttle independently. Snow/rain traction and uphill torque change handling without changing other worlds.

For a boat, enable trawling, provision storage and up to two paid deckhands independently. Paid crew require shared provisions. Set the net capacity, towing speed and towing fuel burn alongside the hold and tank. Death settings can follow the world's rules, remove owned vessels, or leave a boat offshore for recovery. Recovery has its own cargo spoilage period in game days and fuel-retention switch; zero spoilage days means no expiry. Existing docking, rescue, crew-consent and settlement rules still apply.

Coastal Belle's charter invitations use the configured passenger places, including zero to prevent boarding. Its Inventory panel reports the same berth and tank limits. Disembark existing passengers before reducing berths below occupancy; empty excess fuel before reducing the tank. The catalogue defaults remain six passengers and 192 fuel units.

Upload original GLB/OBJ assets and PNG/JPEG artwork in **Assets**, then save named models in **Workshop**. Use a Workshop model as the complete body, and attach up to sixteen additional component models with individual positions, scale and yaw. Wheels rotate with movement, steering components turn with steering, and propellers run with a fuelled engine. Coordinates are local to the vehicle: +Y is up and +Z is forward. Keep models lightweight; reusing an asset does not make its geometry free.

**Cockpit and instruments** sets the driver's eye position, optional dashboard artwork and live speed, fuel, heading, altitude, pitch and condition readouts. **Tyres and tracks** sets front/rear track spacing, tyre widths and wheelbase independently, plus optional tread artwork. At most four distinct uploaded tread textures are used in one world. **Lighting** sets the main beam's power/range and up to twelve coloured lamp lenses, with steady or blinking operation and headlight/cabin/deck switches. Additional lenses are emissive; they do not each create an expensive shadow-casting light.

Save and test driving, docking, fuel consumption, cargo limits and camera placement before inviting players. The server rejects invalid combinations and edits that would strand occupants or shrink loaded storage. **Restore built-in settings** returns that slot to its original configuration. World designs preserve these definitions; use a media bundle to transfer uploaded models and artwork between servers.

### Fuel tanker tuning

In **F10 → Vehicles → Fuel tanker trailer**, set the purchase price in denarii
and capacity in weight units. Defaults are 5,750d (57.5s) and 700 weight, from the
trailer catalogue. Price accepts 0–1,000,000d in hundredths; capacity accepts whole
values from 1 to 100,000. A reduction below an existing tanker's load is refused:
unload first. These settings affect garage purchases, load checks, cargo panels
and load-dependent handling, and survive world saves and design export/import.
They do not alter the Dales water/milk tanker. Fuel-to-tank conversion uses **Rules → Roadside fuel → Tank units per Fuel item** (8 by default), shared with ordinary inventory use and carried assistance.

### Roadside fuel rules

**Rules → Roadside fuel** defaults to sales on, offline sales on, a 10,000-Fuel
transaction limit, shop-relative price ceiling 0 (off), resident purchasing on,
and resident price factor 1.25. The price reference is the cheapest Fuel listing
at a completed shop, including empty shops; without a listing it is the world
catalogue price. Resident purchases also require no usable shop within normal
trade reach and enough money left for meals and shelter. Prices of zero close
public sales. Owners pump and transfer their own stock free even with sales off.

The shared refuelling defaults are 15 m horizontal range, 3 m height difference,
0.5 m/s stopped-speed allowance and 8 tank units per Fuel. These affect tanker
service and carried roadside assistance; the conversion also affects ordinary
Fuel use. Rules are world-local and survive saves and portable designs. Purchase
price/capacity remain in the separate Vehicles trailer editor above.

## Livestock pastures

Dairy barns, sheepfolds, piggeries and henhouses receive a fenced 16 × 16 metre pasture when suitable clear land is available. Owners may buy up to three adjoining parcels through the business's livestock controls. Each parcel supports four cows, six sheep, six pigs or twelve chickens at the default capacity setting. Expansion needs dry, clear terrain and cannot overlap buildings, crop fields, roads, other pastures or protected areas.

**Pasture capacity multiplier** and **Pasture price multiplier** in Rules customize stocking density and expansion cost. More healthy, supplied animals increase production and staffing needs; feed and water use scales with the herd. Animal purchases and breeding respect the same capacity. Existing animals are never deleted during migration: if an old farm has no suitable pasture site, its original production remains available, but it cannot add animals until suitable grazing land is provided.

### Portable canoe rules

F10 → Rules → **Portable canoes** controls purchase price (15000 hundredths =
150d), carried weight (8), carpenter wood cost (8), walking multiplier (0.4), home
limit (2), handling range (3m) and stopped speed (0.5m/s). Building interactions use
the ordinary building-access range. Public pickup is off by default; enabling it
transfers an unoccupied set-down hull to whoever picks it up. Land-hull death loss
is separately off by default, regardless of **Lose all owned boats on death**.
Carried canoes instead follow inventory loss and home stock follows property
rules. Rules persist in saves and portable designs; personal canoe placements
remain save state. A lower home limit prevents new deposits without deleting
existing stock. Canoe weight and price also update the inventory catalogue.

Canoe water rules in the same fieldset set paddling speed (1.2m/s), hold capacity
(12 weight), minimum water depth (0.08m), maximum step-out depth (0.6m), bank reach
(6m), maximum bank rise (1.5m) and the gentle-contact speed threshold (2m/s).
These are shared by authority, prediction and the shore controls. The canoe is
structurally fuel-free with one occupant; use this fieldset rather than the generic
vehicle editor. Established docks support boarding and mooring in deeper water.
Raising the minimum depth can leave a moored canoe needing to be lifted or eased
back into nearby clear water. Personal hulls remain save state, not design objects.

## CB radio rules

F10 → Rules → CB radios configures local vehicle transmissions. Defaults enable
40 channels, road channel 19, emergency channel 9, a 3km ground range and 1.5×
over-water range. Antenna elevation extends reach; a bounded terrain survey
attenuates signals behind ridges. Ground, boat and aircraft antenna offsets,
elevation scaling, terrain sample count and attenuation are configurable.

Speech defaults to 12 characters/second, with a 0.5-second minimum and 1,200-character
limit. Keys within 0.12 seconds can collide; later callers who hear the carrier
receive a busy refusal. Squelch defaults to 0.12. Reception below 0.2 becomes
static; below 0.7 it loses words. These thresholds, the retained traffic count,
handle limit and emergency prompt range are also rules. Channel choices clamp to
a reduced channel count without deleting saved per-vehicle settings.

Public-chat mute and lock restrictions apply by default; disabling radio moderation
explicitly removes those restrictions from CB transmissions. Resident radio use
is disabled by default and enabling it does not add an AI reply routine. Channel
9 rescue cues are local and manual. Selected channel, handle, volume and squelch
persist per driver and vehicle; active transmissions and received logs are transient
and never enter the public chat archive. Portable designs retain the world rules.
Players open the vehicle dashboard with V, the CB HUD button or mobile Actions.
Keyboard, touch and configurable controller push-to-talk use the same authority.
Disabled worlds show an explanatory dashboard state. Radio volume controls the
received-message tone and respects master mute; squelch changes server reception.

## Survival and needs rules

F10 → Rules → **Survival and needs** exposes needs, health, nutrition, standard
school and public labour terms. Missing keys in older worlds use the same defaults; no save migration is
required. Portable designs and newly created worlds include these settings.

- `schoolFirstPrice` and `schoolLaterPrice`: 8,000 and 16,000 hundredths of a
  denarius (80d/160d), each from 0 to 1,000,000. Zero allows free standard tuition.
- `schoolFirstSeconds` and `schoolLaterSeconds`: 60 and 2,400 seconds, each from
  1 to 86,400. A course in the world catalogue overrides both price and time.
- `licencesCountSkills`: true. Turn it off to exempt driver, pilot and captain
  from `maxSkills`. They remain qualifications and still make the next standard
  course use the later price/time. Already learned skills are never removed.
- `labourReliefPay`: 15,000 hundredths (150d), from 1 to 1,000,000.
- `labourReliefMeans`: 5,000 hundredths (50d), from 0 to 1,000,000. Cash plus bank
  must be strictly below this threshold. Zero disables means-tested relief.
- `labourReliefCooldown`: 1,800 seconds, from 0 to 604,800. Zero removes the wait
  between eligible relief shifts; the means test still applies.
- `labourShiftSeconds`: 15 seconds, from 1 to 3,600. It changes public labour,
  not personal tool crafting, harvesting or qualified production cycles.

The school, help text, rules summary and resident plans quote the current terms.
Ordinary shift pay and daily caps remain in **Odd Jobs**, including its existing
diminishing returns. Relief stays outside the ordinary cap. An active course or
shift keeps the price/reward and end time agreed when it started; later edits
apply to new work. Resident tuition planning and skill-limit checks use the same
rules as players.

- `needsAutoFeedThreshold`: 30,000, integer 1,000–1,000,000. Automatic meals
  trigger here and aim below half this value, using whole servings. The same
  threshold applies to enabled automatic inventory/home/crew stores.
- `needsDamageThreshold`: 50,000, integer 10,000–1,000,000. Hunger/thirst cap here
  and either need at this threshold causes damage, online or offline. Set it
  strictly above the automatic meal threshold; change both together if needed.
- `baseMaximumHealth`: **65,000**, integer 10,000–1,000,000. This 0.115.0 change
  raises the former 60,000 default. New lives start here; existing health recovers
  normally to the configured maximum, rather than receiving an immediate heal.
- `nutritionAdjustmentLimit`: 6,000, integer 0–999,999, strictly below base health.
  Nutrition may raise or lower the maximum by this amount. Zero disables its
  effect on the ceiling. Nutrition still resets on ordinary death.
- `repeatServingFrom`: 3, integer 1–100. Consecutive manual servings of the same
  item use the penalty from this serving onward. Choosing another item resets
  the count. A value of 1 applies even to the first serving.
- `repeatServingMultiplier`: 0.5, from 0–1. It affects hunger/thirst relief, not
  health effects. Zero removes relief for penalized servings; 1 removes the
  penalty. Automatic sheltered meals retain full relief.
- `energyRegeneration`: 3,000 units/second online, integer 0–65,000. Zero stops
  regeneration. The existing energy capacity stays 65,000.

HUD and caretaker meters, pantry forecasts, resident need deadlines, and the
live rules summary use these values. Empty stores provide no protection. Invalid
threshold/health pairs are rejected together without changing other rules.

## Economy and trade rules

Creation and F10 → Rules → **Economy and trade** include:

- `minimumBuyPrice`: 100 hundredths (1d), integer 1–1,000,000. This is the
  minimum bid a building may pay suppliers. Set 50 to allow 0.5d bids. It does
  not limit the building's selling price. Raising it leaves existing quotes
  stored, but blocks sales into cheaper bids until the owner reprices them.
  Paused bids stay paused. Saved configured prices survive reload unchanged.
- `transactionItemLimit`: 10,000, integer 1–100,000. Limit new shop trades,
  stockroom transfers, gifts/discards, owner item commands, boat provisions and
  private trade offers. Existing private offers keep their agreed quantity.
  Carry capacity, stockroom capacity, buying funds and import limits still apply.
  Shop Sell all/Sell max and tax previews use the same limit. Trailer shop trades
  follow it; loading a trailer remains governed by its own capacity rules.

Missing rules retain the original defaults. Old saves without a bid rule retain
legacy repair of free/underpriced purchase bids. Portable designs preserve both
rules. Bulk discount tiers keep their separate catalogue validation bounds.

Outside investment also exposes `outsideReturnPercent` (default 8%, range 0–100)
and `outsideOperatingReserve` (default 2,000 hundredths / 20d, integer 0–1,000,000).
Zero percent offers principal recovery without profit; zero reserve removes only
the floor, while payroll/input needs still protect operating cash. Collection
still requires actual earnings above the till watermark and cannot take the
protected reserve. Owner withdrawals still protect outstanding investor claims.

The return rate applies to new deposits. A top-up adds a claim at the new rate;
previous claim amounts remain agreed contracts. World reload preserves newly
quoted 25% claims, while launch-era unversioned claims retain their historical
repair. Export/import carries the rules, never player investments.

Garage and roadside service share `vehicleServiceSteel` (default 1, integer
0–100). A zero setting needs no Steel; roadside mechanics still need Tools and
the qualification. `vehicleServiceFee` (default 1,000 hundredths / 10d),
`mapPrintPrice` (1,000 / 10d), and `ammunitionRefitPrice` (2,500 / 25d) each accept
integer 0–1,000,000 hundredths. Zero means free. Garage owners retain their labour
exemption; map printing still pays the garage and service still restores up to
25 condition points. Panels and resident plans quote these rules. Missing keys
use the same defaults, and portable designs include all four.

`maximumMoneyGift` defaults to 100,000,000 hundredths (1,000,000d), and
`cashTransferLimit` defaults to 10,000,000 hundredths (100,000d). Both accept
integer 1–1,000,000,000 hundredths. The latter applies to both directions at banks
and to owner/outside investment transfers, including collections. These fields
limit each new transfer without rewriting balances or agreed claims. Player
controls and resident transfer plans follow the limits; independent stock,
property-price, lending and household-budget rules still apply. Missing keys
use the defaults, and portable designs retain both fields.

`parishOrderPeriod` sets supply-round duration in real seconds: default 3,600,
integer 60–86,400. `parishOrderShare` (default 0.5, range 0–1) caps each supplier
at that fraction of the order, rounded up, during `parishOrderShareWindow`
(default 0.5, range 0–1) of the round. A zero share bars early deliveries; a zero
window opens demand immediately. Funded rounds keep their posted terms through
rule edits and reloads, including legacy half-order/half-round terms. New rounds
use the new settings; changing duration does not duplicate escrow or reuse order
IDs. `parishOrderBudget` remains the budget per round, so shorter rounds increase
funding frequency. Downtime funds only the current round. Missing keys use the
named defaults; portable designs carry all three rules.

`exportShipmentInterval` defaults to 1,800 real seconds and accepts integer
60–86,400. It changes the existing Puddlewick public export/bunker shipment
schedule; other worlds and private/emergency shops remain excluded. Changing it
starts a new interval at the edit time, avoiding retroactive departures. Saving
the same value does not restart the clock. The persistent time cursor preserves
processed departures through reloads; legacy half-hour cursors convert without
replay. Missing settings retain the default. Portable designs carry the rule,
not shipment history. Existing cargo reserves, settlement caps and the maximum
48-departure downtime catch-up remain in force.

Government import pricing exposes `governmentImportPremium` (25%, range 0–500),
`governmentWaterFloor` (1,000 hundredths / 10d), `governmentBreadFloor`
(10,000 / 100d), `governmentFuelFloor` (4,500 / 45d), and
`governmentImportBidMargin` (100 / 1d). Floors accept integer 0–1,000,000; the
bid margin accepts integer 1–1,000,000. Prices take the highest applicable floor,
premium on other public sells and margin above public bids. Fuel also considers
private sellers. Zero premium/floors retain the bid-margin protection. On-demand
imports still require the resulting quote to meet catalogue value and exceed
public bids; exceptionally cheap configured prices can disable that fallback.

Changing any of these rules republishes all three prices at the treasury-owned
Government necessities shop in Puddlewick's economy world. Unchanged settings
and unrelated edits preserve manually configured food quotes; periodic fuel
repricing continues as before. Private shops, other worlds, stock, ownership and
cash are unaffected by publishing prices. Initial shop pricing uses the same
formula. Import-cost accounting and catalogue prices remain separate. Missing
keys use named defaults; portable designs carry all five rules.

`lighthouseWageCap` defaults to 800 hundredths (8d) per game day and accepts
integer 0–1,000,000 under Economy and trade. Keeper pay is the lower of this cap
and the building's posted wage, before world/town wage taxes. Editing the cap
does not overwrite posted wages; Building Admin clamps newly saved keeper wages
to the cap. Raising the cap allows a higher posted wage. Zero stops keeper pay
while preserving employment and quarters. Daily scheduling, active-shift rules,
the separate 4d private-owner allowance and other buildings' wages stay the same.
The player panel, jobs command, resident observations and payout use one rule;
missing keys use the default, and portable designs/reloads retain the cap.

## Loan offer rules

**F10 → Rules → Loan offers** controls new quotes. `loanPersonalBaseApr` defaults
to 10 and `loanPersonalAprSpread` to 18; `loanMortgageBaseApr` to 6 and
`loanMortgageAprSpread` to 8. Each accepts 0–100 percentage points. APR is base
plus `(creditScoreMaximum-score) / loanRateScoreSpan × spread`, rounded to two decimal places. The score maximum defaults to 850.
`loanRateScoreSpan` defaults to 350 and accepts integer 1–1,000. Zero base and
spread offer interest-free loans. Minimum eligibility scores are
`loanPersonalMinimumScore` 540 and `loanMortgageMinimumScore` 500; each accepts
integer 300–850. Altering thresholds can extend the default approximate rate
bands; preview a quote at the bank.

`loanTerms` defaults to `6,12,24,36,60`. Enter a nonempty comma-separated,
ascending list of distinct whole months from 1 to 120, without spaces. The bank
selector and resident plans use that list. `loanMaximumActive` defaults to 3 and
accepts integer 0–100; zero closes new lending. `loanMortgageLtv` defaults to
0.75 and accepts 0–1 of the building's structural value, excluding stock and
operating capital. Existing ownership, lien, affordability and bank-capital
checks still apply.

These settings affect new offers only. Signed loans keep their APR, monthly
payment, duration and collateral; repayment remains available when lending is
closed. Missing keys use named defaults. Creation, rules summaries, portable
designs and reloads retain all loan fields. The Credit score fieldset controls the score calculation.

## Credit score rules

**F10 → Rules → Credit score** provides the existing score table as 16 rules.
Point values accept integers 0–1,000. Currency divisors accept integer
1–100,000,000 hundredths. The combined patch must satisfy minimum ≤ starting ≤
maximum; invalid edits are atomic. Zero weights disable their contributions.

- `creditScoreMinimum` 300, `creditScoreMaximum` 850 and `creditScoreInitial` 550
  set the score bounds and baseline.
- `creditHistoryMonthlyPoints` 3 adds points per recorded bank month, capped by
  `creditHistoryMaximum` 60.
- `creditOnTimePoints` 6 per on-time repayment is capped by
  `creditOnTimeMaximum` 120.
- `creditEmploymentPoints` 60 is multiplied by the observed employed fraction
  and rounded to whole points.
- `creditAssetUnit` 50,000 hundredths buys one whole score point from finished
  nongovernment structural assets, capped by `creditAssetMaximum` 35. Existing
  operating-lease landlord ownership still determines whose asset it is.
- `creditLatePoints` 25 per late episode and `creditDefaultPoints` 100 per default
  are jointly capped by `creditPenaltyMaximum` 220.
- `creditDebtPoints` 100 multiplies the ratio of outstanding principal/interest
  to assets plus cash and savings. The denominator is at least
  `creditDebtDenominatorMinimum` 10,000 hundredths. Round the result, then cap
  it at `creditDebtMaximum` 100.

Add history, punctuality, employment and asset points to the baseline; subtract
late/default and debt penalties; clamp to the score bounds. The bank and new
loan rates use the configured maximum. Loan eligibility thresholds remain
separate controls. Editing weights changes computed scores, without inventing
employment or payments, moving money, or rewriting signed loans. Missing fields
retain defaults; new worlds, portable designs, summaries, resident observations
and reloads use the same rules.

## Charter offer rules

**F10 → Rules → Charter offers** controls new invitations and return requests.
`charterDefaultFare` defaults to 7,500 hundredths (75d), with
`charterMaximumFare` 100,000 (1,000d). Both accept integer 0–100,000,000;
the default cannot exceed the ceiling. Duration fields use real minutes:
`charterMinimumMinutes` 15, `charterDefaultMinutes` 60 and
`charterMaximumMinutes` 180. Each accepts integer 1–1,440, ordered minimum ≤
default ≤ maximum. `charterMaximumOffers` defaults to 16 per captain, integer
0–100; zero closes new invitations. `charterReturnCooldown` defaults to 60 real
seconds, integer 0–3,600; zero permits immediate repeat requests.

Inventory uses these defaults and bounds. Issued offers and accepted tickets
retain their agreed fares and durations; changing limits never rewinds elapsed
trip time. Full fare escrow, proportional early-return settlement, full
cancellation refunds and one-time settlement remain unchanged. Passenger places
and tank capacity stay in Vehicles. Missing saved fields use defaults; rules
summaries, resident observations, portable designs and reloads preserve all seven.

## Tug rescue rules

**F10 → Rules → Tug rescue offers** provides `towDefaultFee` 20,000 hundredths
(200d), `towMaximumFee` 10,000,000 (100,000d), and `towOfferSeconds` 600 real
seconds. Both fees accept integer 0–100,000,000 with default ≤ maximum; lifetime
accepts integer 1–86,400. Inventory uses the local suggestion and ceiling. Zero
fees permit free services without altering self recovery's always-free policy.

New offers record their expiry; editing rules does not reprice or shorten posted
offers. Legacy offers without an explicit expiry keep the original 600-second
lifetime. Acceptance is allowed at the expiry instant, refused afterward, and
maintenance removes expired offers. Accepted jobs do not expire. Acceptance
holds the full agreed fee, delivery pays it once, and cancellation refunds it in
full; those conservation rules cannot be disabled. Rules summaries, resident
observations, portable designs and saves retain the fields; missing settings
use named defaults. Physical tow limits and boat-death recovery stay separate.

## Resident household forecast rules

**F10 → Rules → Resident household budget** controls estimated living reserves:

- `npcHouseholdSeconds`: 21,600 real seconds by default (six hours), integer
  60–604,800. Explicit trip and strategic horizons take precedence.
- `npcStrategicSeconds`: 86,400 real seconds by default (one day), integer
  60–604,800. Protect this longer household reserve when planning property,
  construction, business procurement, owner withdrawals and saving ambitions.
  Home-provisioning choices and their completion checks use the same horizon.
- `npcPantryBufferSeconds`: 900 real seconds by default (15 minutes), integer
  0–86,400. Add this coverage to pantry targets and absence checks. Zero permits
  exact coverage in a valid home or room; it never creates shelter. Housing
  purchase budgets protect the greater of the strategic horizon and the explicit
  absence plus this buffer.
- `npcBudgetNeedAllowance`: 15,000 need units, integer 0–1,000,000. Subtract
  this allowance from current need plus forecast consumption before pricing
  replacement food and drink. Higher allowance lowers the immediate reserve.
- `npcBudgetCarriedShare`: 0.5, fraction 0–1. Credit this fraction of carried
  nutrition; valid home/personal-room stocks retain full nutritional credit.
- `npcBudgetFuelThreshold`: 8 tank units, numeric 0–1,000,000. Below it, with no
  fuel carried, reserve one Fuel purchase at a known stocked quote or catalogue
  fallback. Zero removes the fuel reserve.

Budgeting uses perceived suppliers and ordinary prices. It changes discretionary
spending estimates without creating cash, changing nutrition, or forbidding
emergency purchases. Valid rooms include rent for the uncovered forecast time;
expired rooms and another player's house do not count as shelter. Household and
homecoming forecasts use the existing `homeNeedsMultiplier`; zero is supported
without NaN. Daily replacement-cost comparisons remain 86,400 real seconds and
exclude fuel, independently of the ordinary forecast horizon and fuel threshold.
All six fields are validated, summarized, included in resident observations and
portable designs, and retained on reload. Missing keys use named defaults.

## Resident cash and portable reserve rules

**F10 → Rules → Resident cash and portable reserves** exposes thirteen policy
values. These guide residents' ordinary actions; they never grant money, waive
ownership or storage checks, or change a human player's bank permissions.

- `npcCareCashFloor` defaults to 12,000 hundredths (120d) for emergency savings
  withdrawals; `npcBankCashFloor` defaults to 40,000 (400d) for ordinary banking.
  Both take the maximum with the computed household reserve.
- `npcBankDepositShare` defaults to 0.5, fraction 0–1. Deposit that share of cash
  above the protected reserve, rounded down and capped by `cashTransferLimit`.
  Zero disables saving deposits while leaving withdrawals available.
- `npcBankMinimumDeposit` defaults to 1,000 hundredths (10d). A proposed deposit
  must reach it and be positive. All three currency fields accept integer
  0–100,000,000; withdrawals cannot exceed savings or the transfer limit.
- `npcPortableWater` 6 and `npcPortableBread` 3 set specific carried reserves.
- `npcPortableMinimum` 3 and `npcPortableMaximum` 12 clamp other food/drink
  reserves. Require minimum ≤ maximum. `npcPortableNutrition` 24,000 sets their
  nutrition target: divide by the item's larger food/drink value, round up,
  then clamp. Nutrition accepts integer 0–1,000,000.
- `npcPortableEquipment` 1 keeps that many of each Tools, Fishing tackle,
  Pickaxe, Chainsaw, Shovel and Fuel item. Other non-provisions are unreserved.
- `npcFishingSurplus` 3 permits that many fish above the portable reserve before
  fishing stops. Actual cargo capacity still applies.
- `npcTradeFoodReserve` 1 and `npcTradeDrinkReserve` 2 retain the distinct smaller
  reserves used for opportunistic trades; drink takes precedence for an item
  providing both nutrients. Cargo recovery/unloading keeps the portable reserve.

All item counts accept integer 0–100, including zero. Water/Bread counts are
independent of the generic minimum/maximum. Cargo recovery and surplus unloading
also obey `transactionItemLimit`; repeated bounded recovery actions can unload a
large excess. Setting reserves above carrying capacity cannot create room or
supplies. Carried fuel still takes priority over discarding cargo when stranded.
Missing keys retain defaults; creation, summaries, resident observations, portable
designs and reloads preserve all fields. Invalid joint bounds reject atomically.

## Resident business budget rules

**F10 → Rules → Resident business budgets** exposes input-stock policy:

- `npcInputReserveBatches` defaults to 6; `npcInputMaximumBatches` to 24.
  Both accept integer 0–1,000, with reserve ≤ maximum. Measured sales can raise
  targets within these bounds; fallback input reserves use the minimum.
- `npcInputSalesHours` defaults to 2, range 0–168. Multiply observed hourly
  sales batches by this coverage, round up, then clamp to the batch bounds.
  Zero retains only the minimum target. Hourly measurement uses at least one
  hour of account history, preserving its existing rate calculation.
- `npcOutputCapacityShare` defaults to 0.75, fraction 0–1.
- `npcOutputMinimumBatches` defaults to 12, integer 0–1,000.
- `npcOutputBufferMultiplier` defaults to 2, range 0–10.

For each output, the backlog cutoff is the lesser of its capacity fraction and
its per-batch quantity times the larger of the minimum output batches or the
planned input batches multiplied by the buffer multiplier. At that cutoff,
stop buying inputs. Any blocked coproduct stops the whole recipe. Zero capacity
share therefore stops automatic input buying, even with empty output stock.
Input targets also respect actual input storage and remaining output room.

Input cash forecasts, acquisition reserves and procurement limits share the
reserve-batch rule. Existing payroll reserves remain separate. Manual farming,
actual recipe quantities and catalogue breeding minimums are unchanged. Rules
never create supplies, waive ownership, or bypass cash/stock checks. Ordinary
bid maintenance pauses and reopens against the configured target. All input-buffer fields
are validated, summarized, included in resident observations and portable designs,
and retained across reload; absent keys use named defaults.

The same fieldset exposes eight working-capital policies:

- `npcPayrollReserveBatches`: 6 payroll cycles by default, integer 0–1,000.
  Production and acquisition forecasts reserve this many full crew payrolls,
  separately from input-stock reserves.
- `npcMinimumPayrolls`: 3 by default, integer 0–1,000. Minimum bid funding
  protects this many payrolls; non-production retained cash uses the greater
  of this many wages and the cash floor. A peer employer must fund this many
  wages to influence a competitive wage quote.
- `npcBusinessCashFloor`: 2,000 hundredths (20d), integer 0–100,000,000.
  The minimum retained capital for non-production businesses and hay merchants;
  production businesses use their input/payroll forecasts instead.
- `npcStartupBatches`: 3 by default, integer 0–1,000. Construction forecasts
  include this many batches of recipe inputs and the full ideal crew's wages.
- `npcStartupMaterialMultiplier`: 1.1 by default, range 1–10. Multiply quoted
  construction material cost by this contingency and round up. Setting 1 removes
  the contingency; it never changes actual material quantities or prices.
- `npcHayReserveItems`: 40 bales by default, integer 0–10,000. Set the hay
  merchant's own stocking target and buying-cash reserve. The cash floor still
  applies to retained capital; zero stops discretionary hay restocking.
- `npcHayCustomerStockLimit`: 40 bales by default, integer 0–10,000. A potential
  customer must hold fewer bales than this to justify merchant restocking.
  Zero selects no customers.
- `npcHayCustomerFundedItems`: 10 bales by default, integer 0–10,000. A potential
  customer must fund this many bales at its posted bid. Zero removes this planning
  check; actual sales still require real funds and space.

Hay purchases and deposits also obey `transactionItemLimit` and actual capacity.
Zero cash/payroll reserves never release protected investor claims or grant funds.
Farm seed/harvest costs and initial breeding-herd requirements remain catalogue
costs. These eight fields use the same validation, summary, observation, portable
export/import and persistence paths as the input buffers, with missing-key defaults.

## Resident pricing rules

**F10 → Rules → Resident pricing** controls optional resident price plans:

- `npcHaulageMargin`: 0.08 by default, fraction 0–1. Share the price-spread
  allowance between input bids and surplus output asks.
- `npcTravelTimeValue`: 5 hundredths per real second, range 0–10,000. Price
  estimated round-trip time alongside fuel and divide by the useful load.
  Zero removes time value, while fuel still costs money.
- `npcInputMinimumAllowance`: 100 hundredths (1d), integer 0–1,000,000.
  The input-only minimum delivery allowance. Choose the greatest of this,
  the price spread and estimated per-item travel costs, rounding up.
- `npcMaximumInputBid`: 10,000,000 hundredths, integer 0–10,000,000.
  New and remembered input quotes must also meet the existing `minimumBuyPrice`.
  Zero, or a ceiling below that floor, produces no new quote. Existing posted
  bids and accepted terms remain unchanged by the rule edit.
- `npcBidReopenFraction`: 0.5, fraction 0–1. Reopen or raise a bid only when
  input stock is strictly below this share of its target. Zero disables these
  automatic changes; full-stock pauses and explicit human instructions still apply.
- `npcWageMarginShare`: 0.8, fraction 0–1. Share of forecast revenue after input
  costs available for proposed wages, divided by the target crew. Zero prevents
  raises; the planner never cuts an existing wage through this calculation.
- `npcProductionPriceMultiplier`: 1.05, range 1–10. Multiply replacement input
  and payroll cost before allowing for sales tax and rounding the output ask up.
- `npcMinimumOutputAsk`: 1 hundredth, integer 0–1,000,000. Apply this ask floor
  after the cost calculation; zero never removes a positive production cost.
- `npcSurplusMinimumStock`: 12 items, integer 0–100,000, and
  `npcSurplusCapacityShare`: 0.25, fraction 0–1. Review output prices only when
  stock reaches the greater of the item count and capacity fraction.
- `npcPricingMinimumLoad`: 6 and `npcPricingMaximumLoad`: 1,000 items,
  integers 1–100,000, minimum ≤ maximum. A surplus markdown needs a useful
  funded delivery in this range. Both input and output load estimates also obey
  `transactionItemLimit`, vehicle capacity and actual supplier/customer storage.

No known supplier/customer or no profitable route means no offer. A full tax
rate cannot yield a sustainable positive-cost ask. These are forecasts followed
by ordinary paid/authorized actions, not guarantees of demand or income. All
fields validate atomically, appear in summaries and resident observations, and
survive portable design transfer and reload. Missing keys retain named defaults.

## Loan affordability budgets

**F10 → Rules → Loan offers** also controls new-loan affordability:

- `loanLiquidityReserve`: 20,000 hundredths (200d), integer 0–100,000,000. Available liquidity is cash plus savings minus existing debt and this protected reserve, floored at zero.
- `loanIncomePaymentShare`: 0.35, range 0–1; `loanLiquidPaymentDivisor`: 2, range 1–1,000. Monthly payment capacity is the income share plus available liquidity divided by the selected term and this divisor, less current payments, floored at zero.
- `loanPersonalLimit`: 100,000 hundredths (1,000d), integer 0–10,000,000. The unsecured limit is the lesser of this ceiling and income times `loanIncomeBorrowingMonths` (6, range 0–120) plus available liquidity times `loanLiquidBorrowingShare` (0.5, range 0–1). Zero ceiling closes new personal loans. Mortgages retain their separate structural-value limit.
- `loanMinimumAmount`: 1,000 hundredths (10d); `loanMaximumAmount`: 10,000,000 hundredths (100,000d). Both accept integer 1–10,000,000, with minimum ≤ maximum. Bank inputs and refusals show local bounds; all credit, payment-capacity and bank-capital checks still apply.

**Resident business budgets** adds `npcLoanMinimumShortfall` 1,000 and
`npcLoanMaximumShortfall` 10,000 hundredths (10d–100d). Both accept integers
0–10,000,000, with minimum ≤ maximum. Residents consider only positive shortfalls
within these bounds and the cash-transfer limit. Setting both to zero stops new
financing plans. `npcLoanPaymentBuffer` is 3 (range 1–1,000) and
`npcLoanProfitBatches` is 20 (range 0–1,000): payment times the buffer must be
strictly below estimated batch margin times those batches. Zero profit batches
stops financing. Approval, a funded bank and no outstanding resident loan remain
required. Estimates do not guarantee sales or repayment.

Edits affect future offers/plans; existing debt, APR, instalments, liens and
repayments remain intact. Missing fields use the defaults; all fields survive
creation, summaries, portable designs and save/reload.

## Resident owner withdrawal reserves

**F10 → Rules → Resident cash and portable reserves** includes the separate
small owner-withdrawal forecast. `npcOwnerCashFloor` defaults to 4,000 hundredths
(40d), integer 0–100,000,000. It targets that cash balance before adding a fuel
allowance when the tank is below `npcOwnerFuelThreshold` (10 units, range
0–1,000,000) and no Fuel is carried. The allowance uses the cheapest stocked
positive-price Fuel supplier; without one, `npcOwnerFuelFallback` defaults to
800 hundredths (8d), integer 0–100,000,000. Zero cash target or fuel threshold
removes that component; a zero fallback removes only the unquoted allowance.

These forecasts are distinct from emergency care and household reserves. An
ordinary withdrawal can take no more than needed, transferable surplus after
investor claims and operating reserves. Changing rules moves no money. Missing
keys retain defaults, and all fields survive designs and saves.

## Resident pantry and lodging budgets

**F10 → Rules → Resident household budget** includes:

- `npcPantryNeedAllowance`: 20,000, integer 0–1,000,000. Subtract this need allowance when estimating pantry purchases for the planned absence plus the coverage buffer. Zero budgets enough nutrition without that allowance; actual feeding and readiness remain governed by survival rules.
- `npcUnhousedProvisionItems`: 2, integer 0–100. Without a home, plan this many provisions when the corresponding need is at least 15,000. Zero stops this reserve purchase; urgent care remains separate.
- `npcProvisionDrinkCashReserve`: 1,500 hundredths (15d), integer 0–100,000,000. Protect this cash when buying food while thirst is at least 15,000. Zero removes that cash protection.
- `npcProvisionBatchLimit`: 20, integer 0–10,000. Cap each source purchase or owned-stock withdrawal; zero stops these shopping actions. Carried supplies can still be stored. Shopping and deposits also obey the world transaction limit, stock, funds, cargo and storage bounds.
- `npcLodgingBufferSeconds`: 1,200, integer 0–86,400. Add this padding to the planned absence, then round up to whole booking hours within the existing 1–24 hour lodging range. Zero removes the padding.
- `npcLodgingCashReserve`: 2,000 hundredths (20d), integer 0–100,000,000. Retain this much cash after a planned room booking. Zero allows spending all available cash on the quoted room.

These are ordinary forecasts and actions, not cash or supply grants. Existing
room bookings and personal pantry ownership are unchanged. Missing values use
the defaults; creation, summaries, designs and reloads retain every field.

## Resident farm forecast budgets

**F10 → Rules → Resident business budgets** includes these forecast assumptions:

- `npcFarmYieldShare`: 0.5, range 0–1. Estimate the whole units harvested from that share of catalogue yield, both for sustainable asks and acquisition viability. Zero (or a fraction producing no whole units) rejects a price/acquisition forecast; it does not stop actual farming.
- `npcFarmWaterBudget`: 6 and `npcFarmCompostBudget`: 1, integers 0–1,000. Include these input quantities when estimating a crop's sustainable price, alongside seed and harvest wages. Zero removes the relevant forecast cost. These assumptions do not change actual irrigation, fertilizing or crop outcomes.
- `npcFarmCustomerFundedItems`: 20, integer 1–10,000, and `npcFarmCustomerStockLimit`: 20, integer 0–10,000. Consider expansion demand only when a buyer can fund that many units at its posted bid and has fewer units than the cutoff. A zero cutoff disables this signal. Busy plots, previous receipts, crop/household reserves and clear land remain required; sales are not guaranteed.

Edits grant no goods or cash. Existing plots, land costs, bids, wages and harvests
are unchanged. Defaults apply to missing fields, and settings survive creation,
summaries, portable designs and save/reload.

## Resident experiment budgets

**F10 → Rules → Resident business budgets** includes small trading experiments:

- `npcExperimentCashFloor`: 2,000 hundredths (20d), integer 0–100,000,000. This minimum planned funding applies to an owned shop, an outside investment and an acquired producer's initial till. Zero removes the floor while retaining quoted costs.
- `npcExperimentOwnerFundingUnits`: 4, integer 1–1,000. Multiply an owned shop's cheapest bid, or an acquisition's estimated initial till, by this value before applying the cash floor and available-funds limits. Outside investments keep their separate one-bid minimum.
- `npcExperimentRestockBatches`: 2, integer 0–1,000. Limit a small input-restocking experiment to this many batches, within the ordinary input target. Zero stops those restock experiments.
- `npcExperimentLoadLimit`: 8, integer 0–10,000. Cap speculative trading, restocking, output sales and surplus fish. Zero stops these goods-transfer experiments. The world transaction limit, buyer room/funds, stock and cargo capacity also apply.

These choices use ordinary paid actions. Household and operating reserves,
investor claims and cash-transfer limits remain protected. Edits grant no money
or goods; defaults apply to missing keys and all values survive designs/reloads.

## Resident property and optional spending budgets

**F10 → Rules → Resident cash and portable reserves** exposes five cash policies.
All values are integer hundredths, from 0 to 100,000,000:

- `npcPropertyCashReserve`: 20,000 (200d). Both general property and farmer purchase choices retain this amount after the quoted price; startup budgets remain separate.
- `npcPaintCashThreshold`: 20,000 (200d). Optional tractor painting is considered strictly above this cash balance, and still requires enough cash for the actual paint price.
- `npcFarmFundingTillThreshold`: 10,000 (100d). Suggest seed/fertilizer funding only when the farm till is below this balance. Zero disables this suggestion.
- `npcFarmFundingCashThreshold`: 15,000 (150d). Consider that funding only strictly above this personal cash balance. This is an eligibility threshold, not a post-deposit reserve.
- `npcFarmFundingAmount`: 5,000 (50d). Proposed deposits cannot exceed actual cash or the world transfer limit. Zero disables this suggestion.

Zero property/painting/cash thresholds remove only their eligibility cushion.
Changing a rule grants nothing and executes no purchases or transfers. Existing
ownership, accounts and stock remain intact; plans still use ordinary actions.
Rules persist in saves and portable designs and are included in resident observations.

## Resident training and town ambition budgets

**F10 → Rules → Resident cash and portable reserves** includes:

- `npcGroupTrainingCashReserve`: 5,000 hundredths (50d), integer 0–100,000,000. An unqualified resident considers a group invitation to train for work only with tuition plus this cushion. Zero still requires tuition. Needs, preferences, skill limits, active studies and known job terms remain relevant; interest is not acceptance or a payment.
- `npcTownFoundingCostMultiplier`: 4, from 0 to 100, editor step 0.25. Optional town ambitions require cash covering the household reserve plus this multiple of the charter cost. Zero removes this extra gate, but actual charter, cottage and household costs must still be affordable. Existing home, profitable funded holdings, permission and clear-site requirements still apply.

These rules persist in saves/designs, appear in resident observations, and change
only future choices. They grant no money, qualifications, property or employment.

## Resident breeding reserves

**F10 → Rules → Resident business budgets** exposes four replacement-herd policies:

- `npcBreedingCashThreshold`: 15,000 hundredths (150d), integer 0–100,000,000. Consider breeding only when the barn till is strictly above this balance.
- `npcBreedingFeedReserve`: 20 items, integer 0–10,000. Require at least this much feed, counting hay only for cattle and sheep.
- `npcBreedingWaterReserve`: 20 items, integer 0–10,000. Require at least this much Water.
- `npcBreedingSpareAnimals`: 2, integer 0–10,000. Target the species' minimum herd plus this many replacements, within actual barn and pasture capacity. Zero suppresses replacement suggestions.

Zero cash/feed/water reserves remove only extra planning cushions. Actual fees,
rations, health, qualifications, permissions and pregnancy/capacity checks still
apply through the same refusal check used by ordinary breeding. Settings edits
start no pregnancy and grant no animals, money or supplies. Values persist in
saves/designs and appear in resident observations.

## Resident portable shopping targets

**F10 → Rules → Resident household budget** exposes `npcShoppingFuelTarget` 2,
`npcShoppingDrinkTarget` 6 and `npcShoppingFoodTarget` 3 items. Each accepts an
integer from 0 to 10,000. These optional shopping targets count all carried items
in the corresponding category, including drinks other than Water and food other
than Bread. Classification checks Fuel first, then drink, then food. They differ
from per-item portable reserves and home-pantry forecasts.

Zero suppresses that category's optional restock; urgent care, using carried
supplies and pantry planning retain their own policies. Actual funds, stock,
cargo and the world transaction limit bound each purchase. Owner-business plans
also retain the existing portable Water/Bread reserves before depositing carried
inputs and respect the transaction limit. Changing rules grants no goods or cash.
All three targets persist in saves/designs and appear in resident observations.

Resident consumers of the **transaction item limit** also bound trade routes,
owned stock transfers, farm/output sales, construction purchases, worker errands
and career sales. Paired legs use the same quantity. A small limit does not reduce
actual gathering yield: excess stays in inventory for later sales. Service parts
can be bought in smaller instalments before arranging service. These policies
change future plans, not inventories, money or posted agreement terms.

## Resident trade and storage loads

**F10 → Rules → Resident trade and storage loads** exposes eight integer item
counts, each from 0 to 10,000:

- `npcGeneralSupplyTarget`: 3. Optional general-purchase and carried-stock target; also the allowance for a free source.
- `npcConstructionLoadLimit`: 20. Ceiling for explicit construction procurement and general purchases, including non-construction supplies.
- `npcParishSupplyLoadLimit`: 20. Load obtained from a supplier for a parish order; cargo already carried can still fulfil the order within its ordinary limits.
- `npcGeneralTradeLoadLimit`: 10. Optional general trading route load.
- `npcStorageDepositLoadLimit`: 10. Deposit into an owned stockroom.
- `npcStorageWithdrawalLoadLimit`: 5. Withdraw from an owned stockroom.
- `npcRoomStorageLoadLimit`: 3. Transfer into or out of a guest's room pantry.
- `npcCareerTradeLoadLimit`: 1,000. Longer-term trading career load, including carried trading stock.

Zero suppresses the corresponding optional transfer leg. World transaction limits,
stock, funds, reserves, cargo and storage still apply. Edits make no transfer and
rewrite no order or agreement. Values survive saves/designs and are visible to
resident planning. Separate business and farm delivery policies remain separate.

## Resident business cargo

**F10 → Rules → Resident business cargo** exposes integer budgets from 0 to
10,000, stored in saves and portable designs and included in the rules summary:

- `npcBusinessCollectionLoad`: 20 items collected from an owned producer.
- `npcSmallInputPurchaseLoad`: 5 items in an optional small input purchase.
- `npcSmallInputPurchaseBatches`: restock when input stock is below 2 batches, subject to the existing production stock target.
- `npcCarriedSurplusSaleLoad`: 25 carried surplus items sold in an optional sale.
- `npcFarmCollectionLoad`: 25 crop items collected from an owned farm.
- `npcOwnedSourceReserveBatches`: retain 3 batches of inputs when transferring stock from another owned business.
- `npcBusinessOutputSaleLoad`: 30 producer output items collected and delivered to a buyer.
- `npcFarmOutputSaleLoad`: 20 crop items hauled to a buyer, returning receipts to the farm.

Zero load disables that optional transfer; zero small-input batches disables that
restock suggestion. Missing gathering implements still have a separate one-item
purchase. Zero supplier reserve removes only the optional input buffer: breeding
animals remain protected. Actual stock, cargo/storage, cash, household reserves
and the world transaction limit still apply. Rule edits transfer nothing. Old
saves without these fields retain the defaults above.

The same business-cargo fieldset also exposes fallback input and crop-demand budgets:

- `npcRoutineSupplyBatches`: 2 batches for routine input purchasing when no calculated stock target exists, including livestock.
- `npcRoutineDepositBatches`: 4 batches for depositing carried inputs under that fallback.
- `npcCropDemandBatches`: 6 downstream production batches when choosing a crop for funded buyer demand.

These accept integer 0–10,000 values; missing keys retain those defaults. Zero
suppresses the respective input fallback or removes the crop forecast buffer.
Calculated producer stock targets keep precedence; urgent funded production need,
seed costs, crop rotation and staff planting policies still apply. Routine animal
replenishment retains its half-minimum-herd quantity basis. Enterprise supply
uses the existing `npcInputReserveBatches` for fallback feed/water targets, while
replacement breeding animals retain their actual minimum target.

## Resident journey budgets

**F10 → Rules → Resident journey budgets** exposes these planning rules, saved
in worlds and portable designs and included in the rules summary:

- `npcJourneyDistanceMultiplier`: 1.5, range 1–10. Multiply straight-line route legs to budget for indirect travel.
- `npcJourneySpeedFraction`: 0.6, range 0.01–1. Estimate travel at this fraction of the selected vehicle's tuned speed, retaining a minimum divisor of 1.
- `npcJourneyFuelFallbackPrice`: 4,500 hundredths per Fuel item, integer 0–100,000,000. Use only when no stocked positive Fuel quote exists; zero removes this allowance.
- `npcEquipmentPaybackLoads`: 8, range 0–1,000. New gathering equipment must cost no more than this many loads' estimated receipts after travel. Zero excludes paid new implements while allowing owned ones.
- `npcDriveFuelThreshold`: 10 tank units, range 0–1,000,000. Below this level, residents consider affordable refuelling before touring. Zero suppresses optional shopping; empty vehicles can still walk or use carried fuel.

Missing fields retain these defaults. The cheapest stocked positive Fuel quote
takes precedence over its fallback; walking has no fuel cost. Vehicle tuning,
cargo room, stock, household reserves and actual cash still apply. These estimates
change plans, not actual vehicle consumption, item refuelling or money balances.

Resident refuelling experiments also use `npcDriveFuelThreshold`: equality stops
optional purchases, and zero disables them. An empty tank can still use carried
fuel through the ordinary action.

## Resident living advice and lodging suggestions

**F10 → Rules → Resident household budget** includes `npcAdviceCashFloor`
(default 12,000 hundredths, integer 0–100,000,000), `npcAdviceMealItems` (3) and
`npcAdviceDrinkItems` (6), both integer 0–10,000. Living-cash advice is the greater
of the floor and the observed meal/drink price allowance. It retains the existing
selection by nutrition value. Zero removes each component; missing supplies are
still reported as unavailable and no advice grants cash or provisions.

**Resident pricing** includes `npcLodgingOfferRate`: default 600 hundredths per
real hour, integer 0–1,000,000. This is the suggested rate for a resident owner's
ordinary innkeeper configuration action; zero permits a free offer. Editing it
does not change any posted rate, paid booking or balance. Rental costs still use
the actual posted rate. Saves, rules summaries, observations and portable designs
carry these fields; missing fields retain the defaults above.

## Resident account trade budgets

**F10 → Rules → Resident account trade budgets** exposes five integer policies
for existing resident currency conversion and account-based station trading:

- `npcExchangeCashReserve`: 20,000 local hundredths retained before optional conversion, range 0–100,000,000.
- `npcExchangeCreditLoad`: 10 credits per suggested conversion, range 0–1,000,000.
- `npcAccountTradeCreditReserve`: 10 account credits retained before optional purchasing, range 0–1,000,000.
- `npcAccountTradeBuyLoad`: 5 items per suggested station purchase, range 0–10,000.
- `npcAccountTradeSellLoad`: 100 items per suggested station sale, range 0–10,000.

Zero load suppresses its optional leg; zero reserve removes only the cushion.
Actual exchange caps and rates, the ordinary 100-item account transaction ceiling,
station stock/warehouse space, ship capacity, reserved courier cargo and available
funds still apply. Editing a rule transfers nothing and does not change rescue
eligibility or existing journeys. Local conversion uses the current world;
off-world planning uses the resident's saved last local world until landing in
another. Defaults apply when world context or fields are absent. Saves, portable
designs, observations and summaries preserve these policies.

## Construction rules

**F10 → Rules → Construction rules** configures `constructionMinimumSpacing`
(default 12 m), `constructionPlacementReach` (4 m), `spawnClearance` (12 m),
`townCentreClearance` (8 m) and `constructionRefundShare` (0.75). Distance rules
accept 0–1,000 m; the refund share accepts 0–1. Values persist in saves and designs.

Building centres must be strictly farther apart than the minimum spacing;
rotated footprints must also remain clear. Remote shoreline placement accepts
the reach boundary. Respawn/town clearances protect buildings, fields and
pastures; explicit spawn zones retain their own radii. Zero removes only the
corresponding buffer or reach, retaining terrain, property and footprint checks.

Unfinished-site cancellation floors the configured share of its recorded base
cash cost, excluding taxes and delivered materials. Editing the asking price
cannot inflate a recorded refund. Older receipt-less sites use the lower saved
price/catalogue base. Zero means no cash refund. The build menu and cancellation
panel display the current share; a rule change affects subsequent cancellations.

The same fieldset exposes `expandedConstructionCostMultiplier` (1.55) and
`largeConstructionCostMultiplier` (2.15), each 1–10. Both cash and material
requirements use the multiplier, rounded up after model/finish costs. A value of
1 removes the expansion surcharge. Standard sizes, footprints, storage, rooms
and production stay unchanged; existing sites retain their recorded bills and
refund base. Preview estimates and server charges use the same world rules.

`maximumFarmPlots` defaults to 16 and accepts multiples of four from 4 through 64. Four disables further purchases beyond the starting parcel. Lowering the
limit preserves existing land and crops, which remain usable. New purchases add
four plots and retain normal costs, ownership, funds and land-clearance checks.
Saves and portable designs preserve purchased plot counts; designs omit active
crops and stock. The farm panel shows its purchased count and current limit.

`pastureParcelSize` defaults to 16 m and accepts integer side lengths from 8 to
64 m. A newly claimed pasture records that dimension; its adjoining expansions
use the same size. Existing parcels without a saved dimension retain the original
16 m default. Rule edits do not move fences, animals or claimed land. Capacity and
price policies remain separate. Clearance checks, road reservations, fences,
grazing routes and displayed areas all use the saved dimension, including after
save/design reload. A barn without clear grazing land keeps its empty-state panel.

## Gathering rate rules

**F10 → Rules → Gathering rules** exposes `gatheringBaseYield` (3),
`gatheringSkilledYield` (6), `gatheringBaseSeconds` (20) and
`gatheringSkilledSeconds` (12). Yields are integers 1–1,000; durations are integer
seconds 1–600. Forester applies to logs; excavator to the other gathering grounds.
Skill chooses time independently of yield. Started tasks retain their reserved
amount and end time; subsequent tasks/repeats use current rules. Both HUD and
Resources show local rates, and resident plans use them for loads and estimates.
Gathering experiments require room/stock for the selected load and limit their
sale to experiment/transaction allowances, buyer funds and storage.
Implements, shared stock, permissions and cargo limits remain enforced. Values
persist in saves/designs; missing fields retain the shipped defaults.

## Deposit rules

**F10 → Rules → Gathering rules** also exposes `resourceLogsCapacity` (18),
`resourceOtherCapacity` (30), `resourceLogsRegrowthSeconds` (1,800) and
`resourceOtherRegrowthSeconds` (600). Capacities are integers 1–10,000 and base
intervals are integer seconds 10–86,400. The existing **Gathering grounds** recovery
multiplier scales those intervals; each complete interval restores three units.
Standard survey fields inherit these rules, including frozen northern grounds and
saved additions; a non-default authored capacity or interval stays a local
override. Raw surveys, stable IDs and locations are preserved in saves/designs.

Owner edits retain earned stock and fractional interval progress, including when
changing the multiplier and base interval together. Lower caps clip stock; raising
a cap creates headroom that refills normally, even at untouched grounds. Reserved
loads keep their quantity and completion time; cancellation returns stock once up
to current capacity. HUD/Resources show effective capacity and shared stock.
A capacity below the selected gathering load leaves that ground unavailable until
rules allow a complete load. Offline recovery remains capped at local capacity.

## Gathering implement rules

**F10 → Rules → Gathering implements** selects one requirement per material:
`gatheringLogsImplement` defaults to `chainsaw`, `gatheringStoneImplement` to
`pickaxe`, and `gatheringGravelImplement`/`gatheringDirtImplement` to `shovel`.
Each accepts `none`, `chainsaw`, `pickaxe` or `shovel`. Required implements are
reusable; workshop tools remain production inputs. `none` removes only that
material's implement requirement. Stock, cargo, permissions and timed loads still
apply. Edits grant no tools and preserve already-started reservations/end times.

Resources lists local requirements and the nearby HUD names a missing implement.
Resident career, experiment, ordinary and construction plans share the requirement,
including tool procurement and no-tool routes. Values persist in saves/designs,
summaries and observations; omitted fields retain the defaults.

## Crop yield rules

**F10 → Rules → Crop yield rules** exposes `farmCompostYieldBonus` (0.33, range
0–5) and `farmRotationYieldPenalty` (0.2, range 0–1). These are fractions: compost
multiplies yield by one plus its bonus; repeating a previous crop family multiplies
it by one minus the penalty. Weather, moisture and soil still apply, followed by
floor rounding and the existing minimum one unit. Zero removes that modifier.
Existing compost applications remain recorded; new estimates and harvest
reservations use current rules, while started harvests keep their reserved amount.
Soil restoration still clears the previous family using real topsoil and compost.

Farm panels show the configured fertilizer percentage and yield estimate. Residents
avoid fertilizer spending with a zero bonus; their fallback fertilizer valuation
uses the configured bonus. Zero rotation penalty removes their rotation tie-break,
retaining demand and seed-cost priorities. Permissions, staff budgets and the
ordinary import price remain enforced. Values survive saves, portable designs,
observations and summaries; omitted fields retain the defaults above.

### Irrigation formula

In **F10 → Rules → Crop yield rules**, configure the existing moisture formula:

`moisture = min(cap, (rainFraction × rainContribution + baseline + treatments × treatmentContribution) / cropThirst)`

`yieldMultiplier = dryYield + moistureYield × moisture`

Rain fraction is the rainy-day share of the crop's full growth period, as before.
Other yield factors (compost, rotation, frost, wet rot and lateness) still apply,
followed by flooring and the minimum one-unit harvest. There is no fixed +33%
irrigation bonus. The defaults preserve the shipped behavior:

- `farmIrrigationBaseline` 0.25, `farmIrrigationRain` 0.9 and
  `farmIrrigationTreatment` 0.25: each ranges from 0 to 5. Setting a contribution
  to zero removes that source of moisture.
- `farmIrrigationCap` 1, range 0–1: caps the displayed moisture fraction.
- `farmIrrigationDryYield` 0.6 and `farmIrrigationMoistureYield` 0.4, each range
  0–5: set yield without moisture and the additional yield per moisture unit.
- `farmWheatThirst` 0.5, `farmPotatoesThirst` 0.4, `farmHopsThirst` 0.7,
  `farmGrapesThirst` 0.5, `farmTeaThirst` 0.8, `farmCoffeeThirst` 0.7 and
  `farmHayThirst` 0.35: each ranges from 0.01 to 10. Larger values need more
  moisture; zero is rejected to keep the divisor valid.
- `farmIrrigationWaterCost` 3, integer 0–1,000: water per treatment. Zero is free.
  Farm stock is consumed before carried water. Residents preserve drinking reserves.
- `farmIrrigationTreatments` 3, integer 0–100: maximum treatments per crop.
  Zero disables watering; lowering the limit retains existing treatments and their
  moisture contribution. Empty or ripe plots cannot be watered.

Existing plots use the current formula for estimates and new harvests. Harvests
already started retain their reserved amount. Both resident farm planners share
the cost and limit. These rules persist in saves and portable world designs, appear
in rules summaries and resident observations, and fall back to the same JSON
defaults in older worlds. Editing a rule grants no water or harvested stock.

### Ripe quality

**F10 → Rules → Crop yield rules** also exposes:

- `farmRipeQualitySeconds`: 21,600 (six real hours), integer 0–604,800. Full
  quality lasts through this interval after ripening; zero starts decay immediately.
- `farmLateLossPerDay`: 0.005 (0.5%), range 0–1. Loss per existing 600-second game day
  after that interval. Zero disables lateness loss.
- `farmLateMaximumLoss`: 0.35 (35%), range 0–1. Caps the lateness loss; zero
  disables it. One permits loss down to the general minimum one-unit harvest.

The factor is `max(1 - maximumLoss, 1 - max(0, ageInDays - windowInDays) × lossPerDay)`.
It multiplies the weather/soil-adjusted crop yield before integer rounding. The
farm panel shows local values. Changes affect estimates and new reservations;
started harvests retain reserved amounts. Winter expiry remains unchanged.
These values persist in saves/designs and appear in summaries and NPC observations;
older worlds fall back to the same JSON defaults.

### Crop frost sensitivity

**F10 → Rules → Crop yield rules** preserves the shipped frost-day calculation:
`yieldFactor = max(1 - maximumLoss, 1 - frostDays / cropDays × sensitivity)`.
Frost days have temperatures below zero during the crop’s full growth period.

- `farmFrostMaximumLoss`: 0.65, range 0–1. Caps frost yield loss at 65% by default.
- `farmWheatFrostSensitivity` 0.25, `farmPotatoesFrostSensitivity` 0.7,
  `farmHopsFrostSensitivity` 0.5, `farmGrapesFrostSensitivity` 1,
  `farmTeaFrostSensitivity` 0.4, `farmCoffeeFrostSensitivity` 1.3 and
  `farmHayFrostSensitivity` 0.2: each ranges from 0 to 5.

Zero sensitivity disables frost yield loss for that crop; zero maximum loss
removes it for all crops. Ordinary final floor rounding and the minimum one-unit
harvest remain. The farm panel shows local sensitivity and cap. Current settings
affect estimates and new harvest reservations, while started harvests retain
their reserved quantities. Winter still kills every field crop, including with
frost loss disabled. Settings persist in saves/designs, summaries and resident
observations, with the same JSON defaults for older worlds.

## Fishing wait rules

**F10 → Rules → Fishing rules** exposes base mean bite waits in real seconds:
`fishingShoreWaitSeconds` 75, `fishingAnywhereWaitSeconds` 20 (shore in mode 5),
`fishingCoastalWaitSeconds` 65 and `fishingDeepWaitSeconds` 225. Each accepts finite
values from 1 to 3,600. Boat context takes precedence over anywhere mode.

The exponential distribution permits quick bites and long quiet spells. Boat
waits retain the existing seabed-depth multiplier. Rules change new schedules,
including waits after a missed bite; existing casts retain recorded catch and
bite deadlines. Species selection and the eight-second response window remain
unchanged. Fishing mode still controls availability and tackle is still required.
Activities/dock help shows the current base mean. Rules persist in saves/designs,
summaries and resident observations, with JSON defaults for older worlds.

### Offshore fishing limits

**F10 → Rules → Fishing rules** exposes `fishingDeepDepth` (8 m, range 0.1–1,000)
and `fishingShoreDistance` (150 m, range 0–1,000). Rod deep-species eligibility and
trawl deployment share these limits. Depth uses the existing mean tidal surface,
not wave crests. Coast checks retain the conservative 10 m grid margin and explicit
small-islet checks; positive clearance is an approximate conservative boundary.
Zero clearance removes the buffer while retaining water depth and world bounds.

Shore-rule edits invalidate cached coastal decisions immediately, including across
client snapshots. Catches already in a net and encounter clocks are retained;
hauling remains possible after an area becomes ineligible. The trawling panel
shows local limits. These rules use the same save/design, summary, observation
and legacy-default paths as fishing wait rules. Larger clearance searches scan
more terrain on cache misses; unchanged locations reuse cached results.

### Trawl defaults

**F10 → Rules → Fishing rules** also exposes:

- `trawlSpeed`: 2.4 m/s, range 1–8.
- `trawlNetCapacity`: 640 weight units, integer 10–5,000.
- `trawlFuelPerMinute`: 8.5 tank units/minute, range 0.06–60. Existing vessel
  `trawlFuel` overrides remain in units/second.
- `trawlShoalMeanSeconds`: 360 paid towing seconds, integer 1–86,400.

Per-slot vehicle tuning overrides the first three; the boating panel quotes the
effective values. Shoal changes use an exponential distribution with the local
mean. Existing encounter clocks, voyage luck, catches and paid progress survive
edits. Catch mix, depth/crew modifiers and reference catch interval remain unchanged.
Lowering net capacity retains fish and refuses deployment if the net or its pending
next fish cannot fit; hauling remains available. Raising the capacity can resume a
formerly full net. Rules persist in saves/designs, summaries and observations with
shared JSON legacy defaults. They grant no fish, supplies or free towing time.

## Vehicle running costs

F10 → Rules → **Vehicle running costs** controls maintenance wear and trailer
penalties. `vehicleWearPerMetre` defaults to 0.0002 condition points per metre
(0.2/km); range 0–1, with zero disabling distance wear. The existing
`vehicleMaintenance` switch gates both wear and condition's speed/fuel effects.
Mileage still records actual powered travel; parked/offline vehicles, walking
and minigames do not wear. Edits retain condition and mileage. Garage service
shows the local rate, condition and recorded distance.

Trailer speed factor is `1 / (trailerSpeedBase + load × trailerLoadSpeedPenalty)`;
fuel factor is `trailerFuelBase + load × trailerLoadFuelPenalty`. Load is cargo
weight divided by trailer capacity, including private cargo in client prediction.
Both bases default to 1.12 (range 1–10); load coefficients default to 0.33 for
speed and 0.3 for fuel (range 0–10). Zero coefficients remove the load contribution;
base 1 and coefficient 0 remove that penalty. No trailer always gives factors 1.
These multipliers combine with existing vehicle, terrain, load and condition
effects. Live edits preserve cargo and fuel. Missing fields use shipped defaults;
saves, portable designs, summaries and resident observations retain the rules.

Refuelling distance and tank units per Fuel already belong to **Roadside fuel**
(default 15 m and 8 units). Keep those existing rules for tanker sales, roadside
help and inventory refuelling.

## Boat navigation rules

F10 → Rules → **Boat navigation** exposes `boatShoreImpactLoss` (default 1
condition point, range 0–100). This applies to powered-hull shore collisions,
independently of distance maintenance. Zero disables damage but preserves
collision blocking, recoil and the throttle cut-out; gentle canoe landings and
unpowered craft retain existing exemptions. Edits do not restore existing damage.

`boatHouseArrivalRadius` defaults to 30 m for afloat boathouse arrivals;
`boatLandingArrivalRadius` to 14 m for afloat pier/river arrivals;
`boatLandingShoreRadius` to 5 m for shore boarding at those landings. All accept
0.1–100 m. Afloat distance is measured from the oriented hull, and the existing
water-path check still rejects dry obstructions. These radii do not resize docks
or move boats. Boathouse shore menus retain their independent 40 m range.
Inventory shows the local values; saves/designs, summaries and resident
observations carry them, with defaults for missing keys in old worlds.

### River dock eligibility

Boat navigation also includes `riverDockDraft` (default 1.2 m, range 0.1–20),
`riverDockMaxLength` (14 m, 0.1–50) and `riverDockMaxBeam` (3.6 m, 0.1–20).
The dock requires river water at the configured depth across its sampled berth,
a dry landing, correct orientation and unobstructed space. Sea and pond sites
remain ineligible. Size limits apply to configured boat hull dimensions, while
land vehicles remain ineligible regardless of size. These limits do not resize
the jetty or guarantee a larger hull can navigate the surrounding river.

Live edits recheck access. Raising required draft or lowering size limits can
close an existing dock to a vessel; no dock, mooring, cargo or fuel is deleted.
Restore the limits to regain access. Placement and boarding refusals quote local
limits, and Inventory shows them. Save/design and summary/observation support
and missing-field defaults follow the other navigation rules.

## Communication rules

F10 → Rules → **Communication** sets `chatMaxLength` (default 1,200 UTF-16
characters, integer range 1–12,000) for public, private, family and resident
messages. Most ordinary characters count once; some emoji count twice. Blank
messages are rejected. Existing moderation and family privacy remain in force.
CB uses the smaller of this value and `radioMaxLength`; durable letters retain
their separate limit. Inputs update to the local cap, while existing messages
and drafts remain intact. If a draft exceeds a newly lowered limit, shorten it
before sending; the server rejects oversized submissions without truncation.

`npcGroupReplyCooldown` defaults to 30 real seconds (range 0–86,400). Group
salutations still select at most one interested, available resident. Zero removes
only the shared delay; it does not make uninterested/offline residents answer.
Changing the setting keeps saved reply times, so the new delay is measured from
the same last reply, including after restart.

NPC providers receive the local chat limit in their response schema and validate
it before publication. Their independent generation budgets remain ceilings;
a higher chat limit does not promise longer AI replies. Old worlds with missing
keys use defaults. Creation, summaries, resident observations, saves and portable
world designs include both settings. Edits neither erase history nor reset time.

## Arrival and respawn

**F10 → Rules → Construction rules** includes `respawnX` and `respawnZ`, default
**0 / 17 metres** from the world origin. Fractional coordinates are allowed,
within the world's configured map bounds (the global coordinate range is
±50,000 m). Positive X is east; positive Z is south. Use the editor's layout to
choose a clear land site. These coordinates serve new arrivals, ordinary deaths
and the existing submerged-land-vehicle fallback. Characters arrive at the
actual ground height. Rejoining and editing rules leave current players in place.
Boat recovery docks and arena respawns keep their existing overrides; death
penalties and the prohibition on a free town-teleport action remain unchanged.

The existing `spawnClearance` rule (default 12 m) moves the construction reserve
with the point. Town-centre reservations and explicit spawn zones remain.
Changing coordinates rejects points outside the map, below high tide/inland
water, or obstructed by buildings, solid props or barriers. The clearance rule
provides the obstruction buffer; zero removes that buffer but still rejects an
occupied point. Nothing is demolished or relocated to make room.

Keep the site usable when editing terrain or objects afterward. Unchanged legacy
coordinates do not prevent unrelated rules edits. Old saves missing these fields
use the original 0/17 point. Creation, local summaries, resident observations,
saves and portable designs carry both coordinates; rejected imports leave the
destination unchanged.

## Landscape limits

In **F10 → Rules → Landscape limits**, choose capacities for owner-authored terrain
and landscape edits. Defaults reproduce existing worlds: `terrainStampLimit` 256,
`landscapePathLimit` 16, `landscapeBarrierLimit` 16, `landscapeSurfaceLimit` 64,
`landscapeScatterGroupLimit` 16, `landscapeScatterPerGroupLimit` 64,
`landscapeScatterLimit` 128, `landscapeLinePointLimit` 16,
`landscapePointLimit` 128 and `landscapeBarrierLengthLimit` 1,200 metres.

Supported ceilings are 512 terrain stamps; 64 paths, barriers or scatter groups;
256 surfaces; 128 instances per group and 512 total; 32 points per line and 512
points total; and 4,800 metres of barriers. Counts and length limits are whole
numbers. Zero disables new content in that category; a line always requires at
least two points. Per-line/per-group and overall capacities both apply. Larger
layouts require more rendering and terrain sampling work, so increase only what
your world needs. Crowded scatter may still place fewer objects than requested.

Lowering a limit never deletes existing work. Changes that would put the current
layout or any of its four retained undo states above a limit are rejected. Remove
unwanted features first; if an older, larger layout remains in undo history, keep
the higher limit until that state has left the four-change history. Removing
individual terrain stamps in Layout remains available. Undo itself continues to
validate the restored landscape normally.

After an accepted edit, the Landscape tab refreshes its layout and usage from the
server while preserving your typed fields. Consecutive edits therefore build on
the accepted layout. The Landscape editor uses local limits for mouse/touch
points, typed coordinates, scatter counts, surfaces and terrain brushes. Without
a Workshop model, scatter remains unavailable. Geometry bounds, brush dimensions,
model references, duplicate-ID protection and the 33 × 33 heightmap format stay
unchanged. World creation, summaries, resident observations, saved worlds and
portable designs carry these settings; missing keys use the defaults. Imports
validate both settings and contents atomically, including layouts above the old
limits; undo history is not part of a portable design.
