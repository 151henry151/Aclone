# World scripting

Create a world, open F10 → Script, edit the Lua source and choose
**Validate & reload Lua**. Only the world owner can install a script.

```lua
-- SPDX-License-Identifier: GPL-3.0-or-later
on("PlayerLogin", function(e)
  setvar("visits", getvar("visits") + 1)
  announce("Another tractor in the parish. Splendid.")
end)

on("TaskStart", function(e)
  kudos(e.id, 1)
end)
```

Supported events: `PlayerLogin` (id, name), `TaskStart` (id), `ScriptReload`.
Handlers use `on(eventName, function(e) ... end)`.

- `announce(text)` adds a world message (at most 300 characters).
- `getvar(name)` reads a persisted world number, defaulting to zero.
- `setvar(name, number)` writes one of up to 64 world variables.
- `kudos(playerId, amount)` adjusts reputation by up to 100 per call.

## Runtime and limits

- 16 KiB source; 16 handlers/event; ~100,000 instructions/load or handler; 32 MiB worker heap; 1.5s execution deadline after readiness, separate 10s startup deadline.
- At most two reusable workers and 32 queued events. Fresh Lua state per job; recycle healthy workers after 100 jobs, discard failed/timed-out ones. Empty scripts skip workers. No full-world clone or TypeScript loader per event.
- Automatic failures emit one notice and pause events for 60s; paused events are dropped. Successful Validate & reload clears the pause even for identical source. Gameplay continues; historical errors remain in chat.
- No OS, I/O, debug, package, require, filesystem, JavaScript bridge, network, dynamic loading, coroutines or string library (ordinary strings still work).
- Globals reset each event: persist numbers through getvar/setvar; avoid top-level effects. Replaced-world/script results are discarded.

This is a smaller API than the historical catalogue. No arbitrary admin commands, asynchronous Lua transaction cancellation, custom OSD or cutscenes. Use synchronous **Access rules** to reject actions safely before mutation.

## Creator effects and events (0.20.0)

The studio adds `TaskComplete` (`id`, `target`: building/resource ID or empty),
`ObjectInteract` (`id`, `target`: object/building ID), `ZoneEnter` (`id`, `target`:
zone/trigger ID) and `Timer` (`time`: world simulation seconds). Timer runs every
five real seconds while someone is online; it is not an offline catch-up loop.
Zone entry is sampled once per simulation second. Interactions are checked for
proximity and current player activity before reaching Lua. The design export
contains the IDs used in target comparisons.

Additional functions:

- `player_value(id, field)` reads `x`, `z`, `health`, `hunger`, `thirst`, `team`
  or `kudos` from the event's simulation snapshot; unknown fields/players return 0.
- `heal(id, amount)` adjusts health by an integer −60,000…60,000, clamped to
  1…60,000. Use normal combat for death/estate behavior.
- `needs(id, amount)` adjusts both hunger and thirst by −50,000…50,000; lower
  values mean better-fed/hydrated. Results clamp to 0…50,000.
- `give(id, itemId, quantity)` gives/removes −100…100 known items, subject to
  carried quantity and cargo capacity. It does not transfer another player's goods.
- `teleport(id, x, z)` places an available player on the terrain at coordinates
  −240…240. Busy, sheltered, hitching and robocrow players are not teleported.
- `score(team, amount)` adjusts team 0/1's current combat (or Hornball) score by
  −100…100, clamped at zero.
- `object_visible(objectId, boolean)` shows/hides a custom placed object, including
  its collision and proximity trigger.

Example: a cooldown-controlled medical station. Replace the ID with your object
ID from the world design, then click that object in the world:

```lua
on("Timer", function(e)
  setvar("clock", e.time)
end)
on("ObjectInteract", function(e)
  if e.target == "medical-station" and player_value(e.id, "health") < 40000 then
    local now = getvar("clock")
    if now >= getvar("nextHeal") then
      heal(e.id, 10000)
      announce("Medical station ready. Mind the machinery.")
      setvar("nextHeal", now + 30)
    end
  end
end)
```

This example deliberately uses a station-wide cooldown. Per-player cooldowns are available without code in **Behaviors**. Use `getplayer`/`setplayer` for saved individual progress; each player has a separate 64-number budget.

## Effect ordering

At most 32 effects/event; validate the whole batch before applying any. Invalid batches use normal automatic-event backoff. Execution/application are serialized per world so jobs see committed variables; its queue caps at 32 and drops overflow. The host still has only two workers.

Reload previews ScriptReload in isolation, validates results, then installs source without applying preview effects. No-code effects apply first; queued Lua observes their resulting state. No cross-galaxy credentials or travel-ticket privileges.

## Player progress and gameplay events

`getplayer(e.id, key)` reads a world-local number (default zero); `setplayer(e.id, key, value)` saves it. Keys use 1–40 letters/digits/underscores/hyphens; each player has 64 keys, finite values bounded to ±10¹². `inventory_count(e.id, item)` and `has_skill(e.id, skill)` query the event player's snapshot. These four functions accept only the triggering player's ID, not another player. Progress persists through disconnect/restart; `resetScriptOnDeath` defaults true. Queued events and results from previous lives are discarded.

Additional events, after successful gameplay:

- `TradeComplete`: id, building, item, quantity, amount (hundredths of a denarius), direction (`buy`/`sell`).
- `JobChanged`: id, building, previous; empty building means quitting. Renewal is also reported.
- `SkillLearned`: id, skill.
- `BuildingComplete`: id, building, kind.
- `PlayerDeath`: id, cause, deaths; ordinary death only, after progress reset.

```lua
on("TradeComplete", function(e)
  if e.direction == "sell" and e.item == "wheat" then
    setplayer(e.id, "wheatDelivered", getplayer(e.id, "wheatDelivered") + e.quantity)
  end
end)
```

Events observe current state when their serialized worker starts, not a frozen transaction history; use event quantities/prices for the completed transaction. Existing queue/deadline limits apply and overflow/backoff can drop events. Use the authoritative no-code quest objectives for guaranteed progression, not Lua as a financial ledger. Action requirements read the last committed progress value; workers never suspend a trade mid-transaction.
