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

A script is limited to 16 KiB, 16 handlers per event, roughly 100,000 executed
instructions per load/handler, a 32 MiB worker old-generation heap and a 1.5-second
execution deadline starting after the worker runtime is ready. Worker startup has
a separate 10-second deadline; both phases can be terminated without blocking the
simulation. The server reuses at most two lightweight runtime workers, with a
bounded queue of 32 waiting events. Each job still starts a fresh Lua state;
script globals cannot leak between events or worlds. Failed/timed-out workers
are discarded, and healthy runtimes recycle after 100 jobs. Empty scripts skip
the worker. This avoids starting a TypeScript loader and cloning the entire
world for each login or paid shift.

If an automatic login or task event fails, the world gets one error notice and
further automatic script events pause for 60 seconds. Events during that pause
are skipped, not queued for later replay. A successful **Validate & reload Lua**
clears the pause immediately, including when reinstalling the same source.
Repeated failures already in flight do not produce duplicate notices during the
pause. Normal gameplay continues. Existing chat history is retained, so old error
messages may remain visible after an upgrade; check for new notices after landing.
No `os`, `io`, `debug`, `package`, `require`, filesystem, JavaScript bridge,
network, dynamic source loading or coroutines are exposed. The string library
is removed to reduce allocation-based abuse. Ordinary Lua strings still work.

The worker reinitializes the script for each event. Use `getvar`/`setvar` for
state that must survive invocations; Lua global variables are ephemeral. Avoid
side effects at top level. The script is isolated from the live simulation:
only bounded messages, persistent numeric variables, reputation changes and
validated creator effects are returned. A stale result from a replaced world or script is discarded.

This is an intentionally smaller API than the original server's event catalogue.
Arbitrary admin commands, transaction cancellation, player variables, custom OSD,
cutscenes and the full set of historical events are not yet wired. The additional
creator events and timer are documented below.

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

This example deliberately uses a station-wide cooldown. Per-player cooldowns
are already available without code in **Behaviors**. Do not build an unbounded
map of players in Lua: the persistent variable budget is 64 numbers.

Scripts return at most 32 effects per event. The server validates the complete
batch before applying any effect. Invalid effects fail the event and use the
normal automatic-event pause. Execution and application are serialized per world
so concurrent events see the previous event's committed variables. Each world's
waiting queue is capped at 32 events; overflow is dropped to protect simulation
latency. The host-wide two-worker pool still applies. Validation/reload runs
`ScriptReload` in an isolated preview, validates its effects and installs the
source; preview effects are not applied to live players.

No-code rules and Lua coexist. No-code effects apply immediately, then a queued
Lua event observes the resulting state when a worker becomes available. Lua has
no cross-galaxy account privileges and cannot issue travel tickets. Scripts are
world-local programs, not arbitrary server plugins.
