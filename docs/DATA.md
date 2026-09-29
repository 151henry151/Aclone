# Data and tuning

`data/` contains the original default content. JSON values are versioned with
the application. Keep identifiers stable: saves refer to them by key.

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
