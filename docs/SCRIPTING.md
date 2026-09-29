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
wall deadline including worker startup. At most four script workers run at once. An error is reported in the world chat.
No `os`, `io`, `debug`, `package`, `require`, filesystem, JavaScript bridge,
network, dynamic source loading or coroutines are exposed. The string library
is removed to reduce allocation-based abuse. Ordinary Lua strings still work.

The worker reinitializes the script for each event. Use `getvar`/`setvar` for
state that must survive invocations; Lua global variables are ephemeral. Avoid
side effects at top level. The script is isolated from the live simulation:
only bounded messages, persistent numeric variables and reputation changes are
returned. A stale result from a replaced world or script is discarded.

This is an intentionally smaller API than the original server's event catalogue.
Arbitrary admin commands, transaction cancellation, player variables, custom OSD,
script timers, cutscenes and the full set of historical events are not yet wired.
