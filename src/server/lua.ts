// SPDX-License-Identifier: GPL-3.0-or-later
import { createRequire } from 'node:module';
import type { World } from '../shared/types.ts';
import { say } from '../shared/messages.ts';
const require = createRequire(import.meta.url);
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');
// No filesystem, module loader, OS, dynamic compilation, JS bridge, or debug library.
// Instruction and heap-growth limits apply to both loading and every event invocation.
export class WorldScript {
  private L: any;
  private handlers = new Map<string, number[]>();
  private count = 0;
  private world: World;
  constructor(world: World, source: string) {
    this.world = world;
    if (source.length > 16384) throw Error('Script exceeds 16 KiB');
    this.L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.L);
    const L = this.L;
    for (const name of [
      'io',
      'os',
      'package',
      'debug',
      'require',
      'dofile',
      'loadfile',
      'load',
      'collectgarbage',
      'string',
      'coroutine',
    ]) {
      lua.lua_pushnil(L);
      lua.lua_setglobal(L, to_luastring(name));
    }
    this.fn('on', (L: any) => {
      const event = this.string(L, 1);
      if (!/^[A-Za-z]{1,40}$/.test(event) || !lua.lua_isfunction(L, 2))
        return lauxlib.luaL_error(L, to_luastring('on expects an event name and function'));
      lua.lua_pushvalue(L, 2);
      const ref = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
      const list = this.handlers.get(event) ?? [];
      if (list.length >= 16) return lauxlib.luaL_error(L, to_luastring('Too many handlers'));
      list.push(ref);
      this.handlers.set(event, list);
      return 0;
    });
    this.fn('announce', (L: any) => {
      say(this.world, 'World script', this.string(L, 1).slice(0, 300));
      return 0;
    });
    this.fn('getvar', (L: any) => {
      lua.lua_pushnumber(L, this.world.scriptVariables[this.string(L, 1)] ?? 0);
      return 1;
    });
    this.fn('setvar', (L: any) => {
      const key = this.string(L, 1).slice(0, 40),
        v = lua.lua_tonumber(L, 2);
      if (
        !Number.isFinite(v) ||
        (Object.keys(this.world.scriptVariables).length >= 64 &&
          !(key in this.world.scriptVariables))
      )
        return lauxlib.luaL_error(L, to_luastring('Variable limit'));
      this.world.scriptVariables[key] = v;
      return 0;
    });
    this.fn('kudos', (L: any) => {
      const p = this.world.players[this.string(L, 1)],
        n = lua.lua_tonumber(L, 2);
      if (p && Number.isSafeInteger(n) && Math.abs(n) <= 100) p.kudos = Math.max(0, p.kudos + n);
      return 0;
    });
    this.budget();
    const status = lauxlib.luaL_loadstring(L, to_luastring(source));
    if (status !== lua.LUA_OK) throw Error(this.error());
    if (lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK) throw Error(this.error());
  }
  private fn(name: string, fn: (L: any) => number) {
    lua.lua_pushcfunction(this.L, fn);
    lua.lua_setglobal(this.L, to_luastring(name));
  }
  private string(L: any, i: number) {
    return to_jsstring(lauxlib.luaL_checkstring(L, i));
  }
  private error() {
    const message = to_jsstring(lua.lua_tostring(this.L, -1));
    lua.lua_pop(this.L, 1);
    return message;
  }
  private budget() {
    this.count = 0;
    lua.lua_sethook(
      this.L,
      (L: any) => {
        if (++this.count > 100)
          return lauxlib.luaL_error(L, to_luastring('Script instruction budget exceeded'));
      },
      lua.LUA_MASKCOUNT,
      1000,
    );
  }
  emit(event: string, data: Record<string, string | number> = {}) {
    for (const ref of this.handlers.get(event) ?? []) {
      this.budget();
      const L = this.L;
      lua.lua_rawgeti(L, lua.LUA_REGISTRYINDEX, ref);
      lua.lua_newtable(L);
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number') lua.lua_pushnumber(L, value);
        else lua.lua_pushstring(L, to_luastring(value));
        lua.lua_setfield(L, -2, to_luastring(key));
      }
      if (lua.lua_pcall(L, 1, 0, 0) !== lua.LUA_OK) throw Error(this.error());
    }
  }
  close() {
    lua.lua_close(this.L);
  }
}
