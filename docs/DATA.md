# Data and tuning

`data/` contains the original default content. JSON values are versioned with
the application. Keep identifiers stable: saves refer to them by key.

- `appearance.json`: validated cottage styles and garage paint choices/pricing.
- `crops.json`: planting seasons, growth days, seed cost, base yield, family and water demand.
- `items.json`: display name, integer weight, price in hundredths of a denarius,
  optional food, drink or fuel effect.
- `recipes.json`: integer input/output quantities, profession, seconds and tier.
- `buildings.json`: default prices, wage, stock, capacity per item, construction
  materials, recipe key and minimum civilization tier.
- `vehicles.json`: 24 slots with mode, speed in metres/second, acceleration, turn
  rate, fuel rate, carry capacity, armour percentage, price and original colour.
- `weapons.json`: six weapons, damage, building damage, speed, gravity, delay,
  energy cost, radius and lifetime.
- `settings.json`: default world rules. A world stores a copy on creation;
  subsequent owner edits affect only that world.
- `galaxy.json`: systems with coordinates, and ships with range/capacity/prices.

Prices are internal units: 48d is written as `4800`; 12s is `120000` at the
normal exchange rate. Item quantities, cargo capacities and wages must not be
negative. Do not change unit conventions without a migration.

The default production interval is 600 real seconds. World-level production
interval currently controls the shared boundary for all recipes. A building's
stored input/output definition references the default recipe catalog; edits to
catalog recipes apply after server restart. Stock and trading-price edits to
existing buildings persist in that world's snapshot.

Confirmed and reported mechanisms from the supplied spec informed the design.
Unspecified prices, recipes, mass/handling values, travel prices, first-lesson
timing, available crops and Ultrakricket timing are original tuning. Do not
present these numbers as recovered original-game data.

To add a recipe: write conservation/storage/wage tests, add its item definitions,
add the recipe and building, add a procedural visual if needed, test the UI and
update the guides. Do not embed special-case prices in client HTML.

The live editor can also save a per-building production override (input/output
maps, profession and a 10–86,400-second interval) and per-world vehicle speed,
acceleration, steering, armour and fuel overrides. These stay in the world
snapshot; they do not modify the shared default JSON files. Custom recipes use
their own production boundaries. Previously purchased vehicles are retained in
the pilot's per-world fleet and are not charged for again when selected.

## Seasonal and combat rules

Farms use `farming.ts`, not the old automatic farm recipe; the recipe key still
identifies the farmer profession. Four plot records hold planted/ready times,
care, previous crop family and optional harvest reservation. World owners cannot
replace farm plots with a custom production recipe. Existing stock is preserved.
New public-market coffee/potato quotes are filled in on load without overwriting
existing quotes, and without creating free stock.

`environment.ts` provides the fixed 600-second economic calendar and seeded
three-day weather fronts. `dayLength` changes only the visual clock. Midnight
matches the date boundary at default speed. The original crop values and planting
windows are documented in [PLAYING.md](PLAYING.md).

`weaponMode` is `energy` or `ammo`; `killReward` is a nonnegative integer up to
100000 hundredths of a denarius. Old saves receive missing default settings.
Projectile physics uses bounded 20ms substeps; at most 24 projectiles per player
and 512 per world can exist. Match parameters and ammunition allotments are in
`combat.ts`. Ship fittings, trade quotes and route planning are in `galaxy.ts`.
The `market:SYSTEM` metadata records station stock and hourly replenishment.

## Living-world fields (0.5.0)

Optional `World.climate` stores snow cover and wetness in 0–1 units; integration
splits at daily climate boundaries and works during restart catch-up. Missing
fields start clear/dry. `resources` stores remaining reserve and last-update time
by stable gathering-ground ID; replenishment is lazy, bounded by node capacity.

Buildings can contain `lodging` with open status, hourly integer price, and guest
records (expiry simulation time plus item stock). Snapshot projections remove
all pantry stocks and send only the recipient's in `self.roomPantries`; the latter
is a projection, not authoritative save state. Optional plot `drainage` persists
across harvests; soil restoration clears the previous family once before planting.

`data/crops.json` defines frost and wet-soil sensitivity. New professions derive
from recipe skills, plus innkeeper, forester and excavator. Recipe times scale by
`settings.productionSeconds / 600`; custom production uses its explicit interval.
Existing public market/starport quotes gain the new items with zero stock, keeping
custom existing prices and inventories intact.

## AI resident persistence (0.10.0)

Enabling the prototype adds four SQLite tables without rewriting ordinary saves:
`npc_residents` stores identity, notebook and plan progress; `npc_journal` stores
append-only observations and outcomes; `npc_control` stores operator pause state;
`npc_calls` stores durable cost reservations and returned token counts. The meta
key `npc-budget-config` records the active controller's rates and limits for the
CLI. Player/account records have an optional `npc` flag; world chat has monotonic
message IDs. All are included in normal backups. Never publish a populated
database. See [memory and retention](NPCS.md#operator-controls-and-memory).
