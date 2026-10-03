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

Production defaults to 600 real seconds, with catalog intervals scaled by `productionSeconds / 600`. Catalog recipe edits apply after restart; saved stock and business quotes persist. Prices, handling, travel, lessons, crops and Ultrakricket timing include original tuning, not recovered historical constants.

To add a recipe: test conservation/storage/wages, add items/recipe/building/visuals, check UI and update guides. Keep prices in catalogs, not client HTML.

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

## Estate and lending persistence

`Building.estate` holds the unclaimed date and base price; current stock/investment determine equity at quote/purchase time. `World.estateRulesVersion` marks the one-time Puddlewick defaults migration. `retainEstateContents` is boolean; `estateEquityShare` and `estateAnnualDiscount` are 0–1. `World.harbourShipment` prevents duplicate periodic imports on restart.

Private `Player.credit`, `loans` and `loanSequence` persist observed earnings/employment, repayment history, principal/interest, next instalment, arrears and loan IDs. `Building.lien` links collateral to borrower/loan. Accounting is integer money with fractional interest carried between ticks; scheduled boundaries support offline catch-up. Save/restore the entire database; deleting individual debt/lien records breaks financial relationships.

Death and inactivity rules: `loseSkillsOnDeath`, `loseInventoryOnDeath`, `loseJobOnDeath`, `losePropertyOnDeath` default true; `deathCashRetention`/`deathBankRetention` default 1 (range 0–1); `maxOfflineDays` defaults 0 (disabled, otherwise real days). `Player.inactivityProcessed` records the last-seen epoch already penalized, avoiding repeated inactivity deaths during one absence. Connected players refresh `lastSeen`; ordinary offline survival still runs independently.

Business accounts persist on buildings; personal history (80 events), departure baselines and the latest return report persist on players. Snapshots strip account/departure details from public buildings/players; only owners and world caretakers receive statements. SQLite ledger records now include an optional JSON `details` column (building, item, quantity); existing records remain valid. Back up before upgrading; older executables with positional ledger inserts require the matching older database backup.

## Procurement persistence

`World.procurement` retains the funded round, delivery counts and supplier allowances across saves. `procurementVersion` applies the one-time Puddlewick enablement. Hourly grants and expired escrow appear explicitly in the ledger; purchases do not alter shop prices or stock.
