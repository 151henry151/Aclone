# World creator studio

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

In **Rules**, configure taxation, starting cash, professions, survival, building
limits, combat, sea level and the decorative day clock. Estate rules choose whether stock/investment survive death, their share of an unclaimed asking price, and the yearly discount. The farming calendar
remains independent of the decorative clock. In **Layout**, switch generated
vegetation and roads/streetlights on or off, or choose natural weather, clear
skies, rain, snow or a storm. Weather overrides affect crops, accumulated snow
and traction as well as visuals; old snow still takes time to melt.

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
- **Workshop → Use as a vehicle:** assign a saved appearance to any of the 24
  vehicle slots. **Vehicles** loads that slot’s current speed, acceleration,
  steering, armour and fuel settings. The appearance changes the visual model;
  the existing vehicle slot determines movement and gameplay behavior.
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
A rejected import does not add a world to the registry.

## Practical limits and extension points

Worlds currently share a 500 × 500 metre terrain footprint. Limits per world:
64 models, 32 parts per model, 128 placed objects, 64 behavior rules, 128 zones,
256 terrain stamps and 500 buildings. Uploads allow 32 assets, 2 MiB each, with
images no larger than 2048 × 2048. GLB supports static embedded geometry/textures,
up to 256 nodes, 128 primitives, 32 materials and eight textures, with a combined
300,000 accessor-element budget. No external URLs, compression/extensions,
skinning, animation, sparse accessors or morph targets are accepted.

Detailed repeated imports can slow phones despite these limits. Use few colors/simple shapes; same-color parts merge. Models change visuals, not the physics engine. Road painting, heightmap uploads, imported
character animation rigs, shader scripts, arbitrary new inventory items and
arbitrary client JavaScript are outside this editor.

Developer entry points: `shared/creator.ts` owns validation/actions/effects;
`client/creator-editor.ts` owns forms; `client/creator-model.ts` owns rendering;
`server/world-design.ts` owns portable layouts; `server/asset-validation.ts`
checks renderable uploads. Test changes to all four paths: authoritative action,
saved/reloaded state, browser controls and untrusted input rejection.

## Player assistance rules

**Allow Money Gifts** (`allowMoneyGifts`) and **Allow Player Refuelling** (`allowPlayerRefuelling`) are independent boolean rules in creation's custom settings and **Editor → Rules**. Both default to true, including when loading older saves. Disabling a rule immediately prevents its action for all players, including AI residents; re-enabling it needs no restart. Existing explicit choices are preserved when loading a world. Money gifts conserve total cash and are recorded as transfers in the ledger; refuelling consumes carried Fuel and never creates free supplies.

## OBJ models and textures

Make a static mesh in Blender or another modelling tool; [Blender's OBJ exporter](https://docs.blender.org/manual/en/5.0/files/import_export/obj.html) exports geometry, UV coordinates and normals. Triangulate faces, export normals, and use one UV texture atlas. Upload the `.obj` and its PNG/JPEG separately in **Assets**. In **Workshop**, select the OBJ as the uploaded visual and the image as **OBJ texture**, set the metre bounds, then save. Bind it to scenery, a building or a vehicle as usual. A blank texture selection gives plain geometry.

Each file is limited to 2 MiB; images to 2048×2048; OBJ to 50,000 triangles and 60,000 records of each coordinate type. Positive/negative face indices and polygon faces work; curves, point clouds, animation and vertex-color shading do not. Material-library paths are ignored: no external `.mtl` or remote textures are fetched. For multiple materials or embedded textures, use the existing self-contained GLB workflow.

Visitors download models/textures automatically through the game's hosting prefix, with immutable browser caching. A wireframe box marks loading or failed geometry while collision remains stable. Exported world designs keep placeholder geometry; upload/reassign media on the destination server.

## Survival and death rules

At world creation or **Editor → Rules**, set hunger/thirst rates to zero for worlds without survival needs. Independently untick `loseSkillsOnDeath`, `loseInventoryOnDeath`, `loseJobOnDeath` or `losePropertyOnDeath` to retain those possessions/status. Keeping skills also keeps a course in progress; keeping a job retains its existing shift expiry. Ordinary death still respawns and restores the character's needs; arena knockouts keep their existing separate rules.

`deathCashRetention` and `deathBankRetention` range from 0 (lose everything) to 1 (keep everything). Loans are never erased; a retained mortgaged property keeps its loan, while released collateral goes through foreclosure. Existing estate-content and valuation rules govern released ordinary buildings. Guesthouse protections remain unchanged.

`maxOfflineDays` uses **real days**, with 0 disabling the rule. Once per absence, exceeding it triggers ordinary death under that world's configured penalties; logging in starts a new absence period. Turn needs off and retain selected possessions to make an activity-based world, or disable the absence limit too for a relaxed sandbox. These changes do not alter Puddlewick defaults.

## Local procurement

Enable `parishOrders` and set `parishOrderBudget` (integer hundredths of a denarius per real hour) in world settings. A completed, government-owned market is required as collection point. Puddlewick enables this once on upgrade; later operator edits are preserved. Disable it to remove this source of public demand and money.

## Quests and access requirements

In **Quests**, name a quest, write its instructions and add up to eight ordered objectives: buy, sell, take a job, qualify, complete construction, gather, or interact. Select a named target and optional item/quantity; “Any” matches all. Set up to eight item rewards and a reputation reward, plus whether death resets progress. Players accept from **World / F9 → Quests**; only subsequent events count. Claims require space for the entire reward and cannot be repeated. Revising a definition invalidates old progress. Rewards are creator grants, so balance them deliberately.

In **Access rules**, require a qualification, carried item or minimum Lua progress value before trading, taking a job, studying, building or interacting. All configured conditions must pass; failure displays your explanation without changing inventory, cash or employment. Target a named building/object or a construction type, or all targets. These requirements apply to human and NPC actions alike. Each world supports 32 quests and 32 requirements; designs export their definitions but never a player's progress.
