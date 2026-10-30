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
12 cm per game day and snowstorm adds 48 cm; leaving either override enabled
keeps accumulating snow. Clear skies allow daytime thaw (12 cm per sunny day),
while rain/overcast skies and night do not. Winter retains its first 4 cm until
spring. A frozen night clock prevents thaw; a frozen sunny clock supplies
continuous sunlight. Roads stay exposed at any depth.

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
prices/wages/recipes, civilization tier and vehicle tuning. **Create world from
design** validates the file and creates a separate world; it cannot overwrite
occupied worlds. Players, accounts, chat, stock, investment, inventories, match
progress and script variables are excluded. Imported businesses belong to the
new world’s owner and start from ordinary building defaults. Asset-only models
become labelled gray placeholder shapes until their media is uploaded/reassigned.
A rejected import does not add a world to the registry. Use the media bundle option to retain model and texture bindings.

## Practical limits and extension points

Each world has a square map whose side is the `mapSize` setting (500–20,000 m,
editable live in **Rules**). The public Puddlewick is 12,500 m; arenas and
playgrounds, and worlds saved before map sizes existed, keep the 500 m
footprint. The central 500 m village terrain is unchanged at any size; beyond it
the countryside is generated deterministically from the world id: rolling hills,
woods, inland lakes, a harbour inlet south of the village and an island coast
that falls into open sea before the map edge. Woodland clearings, outcrops,
gravel hollows and soil banks are placed on a 400 m lattice with stable ids, so
reserves and NPC errands survive restarts. Creator objects, heightmap imports
(33 × 33 across the whole map) and the shoreline survey still work at village
scale. Limits per world:
64 models, 32 parts per model, 128 placed objects, 64 behavior rules, 128 zones,
256 terrain stamps and 500 buildings. Uploads allow 32 assets, 2 MiB each, with
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

**Catalogue** defines up to 32 custom goods and 16 professions. IDs start with `custom:` and stay stable; built-in goods/skills are unchanged. Goods have a label, short icon, weight, reference price and optional food/drink/fuel effect. Health effects range from −6000 to +6000 per serving, and maximum-health changes from −600 to +600; the latter accumulate only within ±6000 for the current life and reset on death. Inventory shows these effects. Professions have a label, tuition, lesson duration and up to eight prerequisites; cycles are rejected. Schools show actual course prices and prerequisites.

Use custom definitions in **Production**, behavior item effects, quest rewards, shop quotes and building stock. Custom supplies obey cargo limits and feed sheltered players offline. Referenced definitions cannot be deleted; changes to weight/value/effects apply to existing goods. Recipes in use must retain valid professions and items. Lua source is not statically analyzed; update scripts yourself when changing their referenced definitions.

**Building templates** copies a building's base type, recipe, shop prices and visual into a reusable construction option. Give it a `custom:` ID, name, construction price, wage, ideal active employees (1–16) and materials. Future buildings use the template; existing buildings retain their economic settings. Ideal crew size is resolved from the template, so changing it also updates existing template buildings without resetting their stock or payroll. Templates obey ordinary siting, shoreline, material and property-limit rules. At most 32 are allowed, and a template with existing buildings cannot be removed.

The **Production chain check** estimates one batch with the ideal crew using input bids, output asking prices, sales tax and wages, and lists possible suppliers. It flags missing bids/suppliers and nonpositive margins. It is a planning estimate, not guaranteed profit: delivery costs, unsold stock, shortages, repairs and idle time remain relevant. Catalogue definitions and templates travel with exported designs; accounts and inventories do not.

## Landscape editor

In **Landscape**, tap the village map to mark points or enter X,Z pairs anywhere within the world's map (±`mapSize`/2; −250…250 on compact worlds). Draw a curved/straight gravel path or a timber fence/stone wall. Set width and barrier height. New paths appear on parish maps and receive streetlights; generated roads can be disabled separately in Layout. Solid barriers stop ground movement and shots; NPC routes avoid them.

**Lanes grow on their own.** The parish lays up to **12 m of road per game day**, usually 5 m wide. It prioritizes bypasses around buildings and farm plots, then connections between towns, then isolated buildings and construction sites. Town connections grow from both ends and join existing local lanes when possible; a private lane beside a remote town does not count as a connection to the original town. Bypasses keep all approaches to a junction connected and remove the old obstructed sections only after construction finishes. Existing wider roads keep their width on the bypass.

Routes avoid buildings, all farm plots, water, solid barriers and the map edge. Public works respect towns that disable road building for both residents and guests; individual building spurs also respect the owner's road permission. An obstacle added during construction causes replanning. Roadwork and daily progress are saved across restarts, and completed lanes appear on maps, in streetlighting and in NPC routing. A world without any existing lanes has no network to extend. Impossible routes wait for conditions to change; this system does not construct bridges or cut through impassable terrain.

Paint circular grass, gravel, soil or sand patches; the first map point sets the brush centre. Scatter a Workshop tree/rock model with a seed, count and scale. Rotation/size vary deterministically; roads, buildings, water and overlaps are avoided. Crowded areas can yield fewer instances. Solid scatter uses the model's bounds; editing terrain/layout may reposition it.

Preview a PNG/JPEG heightmap (2 MiB, 2048 × 2048 maximum). Image brightness maps between your low/high heights; the server stores a 33 × 33 grid across the playable square. Blue preview cells are below sea level. **Apply previewed heightmap** replaces the procedural base; existing height brushes remain additive. Terrain, buildings and water checks use the same heights. Review shoreline businesses before applying.

**Undo last landscape edit** restores one of the last four saved path/surface/barrier/scatter/heightmap states, including after a restart. Remove individual features below the editor; remove older height brushes in Layout. Edits are free and caretaker-only. Limits: 16 paths, 16 barriers, 128 control points total, 1,200 metres of barriers, 64 surface brushes and 128 scattered instances. Exported designs include the current layout, not undo history.

## Vehicle rules

Rules include **Vehicle maintenance** (distance wear on/off), **Vehicle licences** (driver/pilot/boatmaster required for advanced slots according to their configured movement mode) and **Require map item** (hide visitor maps unless carrying a Parish map). Defaults enable gentle wear but leave licences and map ownership optional. Basic tractor, walking, ostrich and disposable robocrow controls are exempt from licences. Creator maps remain available for editing. Garage map printing and steel-part servicing are ordinary paid services, also available on existing saves.

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

## Optional annual lottery

Enable `lotteryEnabled` in Rules; `lotteryTicketPrice` is a positive integer in hundredths of a denarius and changes at the next round. It defaults off. The World menu exposes entry, jackpot contributions, odds and recent results. Draws use 365 game days from world creation (about 61 hours), independent of decorative clock speed. Each round admits at most 100 tickets per player, 10,000 total.

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

In **Editor → Rules → Automatic food and drink**, configure `autoConsumeInventory` (eat carried supplies online/offline anywhere), `autoConsumeHomeStock` (use the selected owned home or active private guest-room pantry while away), and `homeNeedsMultiplier` (0–1; 0 disables indoor drain, 1 gives no indoor benefit). Home stores always feed occupants automatically. Inventory and remote-home feeding default off for other worlds, preserving existing behavior. Puddlewick enables both once and uses a 0.8 indoor multiplier; later owner edits survive restarts.

Only a valid owned home or unexpired private booking is eligible. Public lodging/business stock and another owner’s supplies are excluded. Boat crew still use their captain’s provisions first; the normal captain rule for boat stores remains offline-only. Inventory feeding also applies to online captains when enabled. The at-home provisions estimate follows these settings and includes carried supplies when available.

### Coastal headlands in world designs

World-design JSON preserves `terrainMapSize` (the island footprint, separate from the larger navigable ocean) and up to 32 `coastalBluffs`. A bluff has `id`, `x`, `z`, `angle` in radians (local +Z toward water), `width` (half-width, 80–250 m), `inland` approach length (150–500 m), `height` above mean sea (15–65 m), and a deterministic numeric `seed`. Export Puddlewick’s design for examples. The ordinary height brush does not move these fixed cliff lips; edit the design and import it into a test world to reposition them. Keep them away from existing properties and put their seaward face on the shoreline. Imported headlands use the same safety boundary and lighthouse siting rules. Automatic placement/migration is limited to the public Puddlewick world.

### Business discount and farm policies

World-design exports include each building's optional `bulkDiscounts` array of `{quantity, percent}` tiers and farm `farmPolicy` (`crops`, optional `dailyLimit`, `reserve`). Configure these through the business owner's normal building menu before exporting. Empty discount tiers disable discounts; missing tiers use defaults except at public import/export outlets. Cash amounts in farm policy JSON use the smallest internal currency unit (100 = 1 denarius). Empty approved crops pause staff planting. Runtime staff expenditure is saved in the world but is not copied into a new world design.

## Designing a custom vehicle

Open **F10 → Vehicles**, select a slot and name it. Start with its movement mode: ground, road, fixed-wing flight, boat, amphibious hovercraft or vertical flight. Expand the sections to tune acceleration, top speed, steering, armour, fuel burn and tank size, cargo capacity, purchase price and passenger places. Speeds use metres per second, lengths use metres, fuel burn uses tank units per real second, and prices use hundredths of a denarius (10,000 = 1s). Configure persistent throttle independently. Snow/rain traction and uphill torque change handling without changing other worlds.

For a boat, enable trawling, provision storage and up to two paid deckhands independently. Paid crew require shared provisions. Set the net capacity, towing speed and towing fuel burn alongside the hold and tank. Death settings can follow the world's rules, remove owned vessels, or leave a boat offshore for recovery. Recovery has its own cargo spoilage period in game days and fuel-retention switch; zero spoilage days means no expiry. Existing docking, rescue, crew-consent and settlement rules still apply.

Upload original GLB/OBJ assets and PNG/JPEG artwork in **Assets**, then save named models in **Workshop**. Use a Workshop model as the complete body, and attach up to sixteen additional component models with individual positions, scale and yaw. Wheels rotate with movement, steering components turn with steering, and propellers run with a fuelled engine. Coordinates are local to the vehicle: +Y is up and +Z is forward. Keep models lightweight; reusing an asset does not make its geometry free.

**Cockpit and instruments** sets the driver's eye position, optional dashboard artwork and live speed, fuel, heading, altitude, pitch and condition readouts. **Tyres and tracks** sets front/rear track spacing, tyre widths and wheelbase independently, plus optional tread artwork. At most four distinct uploaded tread textures are used in one world. **Lighting** sets the main beam's power/range and up to twelve coloured lamp lenses, with steady or blinking operation and headlight/cabin/deck switches. Additional lenses are emissive; they do not each create an expensive shadow-casting light.

Save and test driving, docking, fuel consumption, cargo limits and camera placement before inviting players. The server rejects invalid combinations and edits that would strand occupants or shrink loaded storage. **Restore built-in settings** returns that slot to its original configuration. World designs preserve these definitions; use a media bundle to transfer uploaded models and artwork between servers.

## Livestock pastures

Dairy barns, sheepfolds, piggeries and henhouses receive a fenced 16 × 16 metre pasture when suitable clear land is available. Owners may buy up to three adjoining parcels through the business's livestock controls. Each parcel supports four cows, six sheep, six pigs or twelve chickens at the default capacity setting. Expansion needs dry, clear terrain and cannot overlap buildings, crop fields, roads, other pastures or protected areas.

**Pasture capacity multiplier** and **Pasture price multiplier** in Rules customize stocking density and expansion cost. More healthy, supplied animals increase production and staffing needs; feed and water use scales with the herd. Animal purchases and breeding respect the same capacity. Existing animals are never deleted during migration: if an old farm has no suitable pasture site, its original production remains available, but it cannot add animals until suitable grazing land is provided.
