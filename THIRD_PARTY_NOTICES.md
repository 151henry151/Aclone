# Third-party notices

Aclone does not bundle or reuse the original game's client, server, assets,
models, screenshots, audio or interface text. Research screenshots remain under
`sources/` and are excluded from the built game and release archives.

Runtime dependencies retain their original notices in their installed packages:

- Three.js — MIT. Copyright Three.js authors.
- ws — MIT. Copyright its contributors.
- Zod — MIT. Copyright Colin McDonnell and contributors.
- Fengari — MIT. Copyright the Fengari authors; derived from Lua, whose license
  and attribution are included by Fengari.
- Node.js — its distribution license; bundled SQLite is public domain.

Development tools (TypeScript, Vite, tsx, esbuild, Playwright, Prettier and their
transitive dependencies) retain the licenses shipped in their packages. The
lockfile pins the installed dependency graph. Preserve upstream notices when
redistributing dependencies or compiled bundles.

The World Owners' Manual at https://theuniversal.net/ is identified in the
supplied research spec as CC BY-SA 4.0. These guides contain original prose, not
copied manual passages. Research files have not been relicensed as GPL.
