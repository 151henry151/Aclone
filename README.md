# Aclone

**A small, persistent universe with an unreasonable number of tractors.**

**Play the alpha:** [hromp.com/aclone](https://hromp.com/aclone)

Aclone is an independent, open-source browser game inspired by the economy and vehicle playgrounds of _A tractor / The Universal_. Run a business, drive a tractor, employ your neighbours, play Hornball, or make a world with your own rules. The code, models, material textures and synthesized sounds are original. Texture provenance and generation prompts are documented in [the art guide](docs/ART.md).

**Version 0.11.2 · development alpha · GPL-3.0-or-later · Node.js 24.14+**

**Fixed in 0.11.2:** building efficiency reflects current staffing immediately, and open building panels show a live production-check countdown and stock quantities. Production still happens on its scheduled cycle. See [mill production guidance](docs/FAQ.md).

**Fixed in 0.11.1:** Mabel gets complete FAQ/economy knowledge, live workplace diagnostics and persistent action feedback. Failed plans back off and duplicate announcements are suppressed. See [AI neighbour guidance and recovery](docs/NPCS.md).

**New in 0.11.0:** smaller network updates, bounded catch-up traffic, lighter rendering and NPC/script processing, and main-chat scrollback. Dynamic shadows default off; models, textures and lighting remain. See [performance and chat](#performance-and-chat-0110).

**New in 0.10.0:** optional AI neighbour **Mabel Reed**, with persistent memory, normal economy gameplay, private chat and help with controls and common questions. Only one resident is configured, with shared spending limits and empty-parish sleep. See [NPC setup and operation](docs/NPCS.md) and [controls/FAQ](docs/FAQ.md).

**New in 0.9.0:** press **M** or click the minimap for an enlarged parish map with building and resource names, live player markers, zoom and panning. Click a building name to inspect it. The Parish Directory remains a separate view. See [map controls](docs/PLAYING.md#finding-your-way).

![Enlarged parish map with named buildings, roads and gathering grounds](docs/screenshots/parish-map.png)

**New in 0.8.0:** synthesized engine idle and revs, nearby players’ motors and horns, and distinct machinery sounds tied to building production. Sound starts after a click or keypress, with a visible mute button and saved volume control. See [sound controls](docs/PLAYING.md#sound) and [release notes](CHANGELOG.md).

**New in 0.7.0:** stronger, wider, longer-range headlights and much broader streetlight pools, with a slower fade that lights the gaps between lamps and the surrounding verges. See [CHANGELOG.md](CHANGELOG.md) for the release notes.

The night sky has moving, seasonal stars and two nearby, phased moons. Starlight gives enough dim illumination to make out nearby ground; bright full moons reveal grass and terrain, including softer light in the shadows. Moving clouds obscure the sky and reduce that illumination. In first-person view, drag upward to look at the sky.

<details>
<summary>Night-sky previews (0.7.0)</summary>

![The nearby moon pair and stars through moving clouds](docs/screenshots/twin-moons.png)
![The same moons in their crescent phase](docs/screenshots/crescent-moons.png)
![Grass visible under a clear full moon, with headlights off](docs/screenshots/moonlit-ground.png)
![The same field under starlight alone](docs/screenshots/starlit-ground.png)

</details>

**Fixed in 0.6.1:** natural reverse steering, no self-employment or self-trading, and a 3% gross delivery margin from default building prices to Harbour stores. Owners use Stockroom and Building Admin; custom prices remain configurable.

**New in 0.6.0:** an approximately eight-times-larger town footprint with winding roads, dispersed businesses, roadside lights and a matching parish map. Existing starter properties retain their owners and contents when relocated; custom lots stay in place.

![Expanded town and winding lanes](docs/screenshots/town-overview.png)

**Fixed in 0.5.1:** reliable Go outside buttons during live updates, plus Space/Enter activation of focused buttons.

**New in 0.5.0:** truly dark nights with working street/window lights, persistent snow and storm traction, varied woodland, finite gathering grounds, eight new processing businesses, richer crops, and player-run hotels/B&Bs with offline room provisions. See the [economy and lodging guide](docs/ECONOMY.md).

**New in 0.4.0:** seasonal farming and weather, team combat modes, an expanded galaxy with saved journeys and contracts, cottage styles, tractor paint and conditional chimney smoke. See the [player guide](docs/PLAYING.md) for timing, controls and balance decisions.

**Updated in 0.3.4:** compact tractor proportions and a varied village of cottages, shops, civic buildings and industrial sheds, with consistent human-scale doors, windows and street furniture. New buildings retain existing identities, ownership and inventories.

**Fixed in 0.3.3:** smoothly shaded walking characters and cab drivers with natural proportions, facial and clothing detail, animated limbs, and a closer walking camera. Use **Inventory → Switch to walking** or **Return to tractor**.

**Fixed in 0.3.2:** smoother tractor movement and camera tracking between network updates, with software/performance rendering targeting up to 30 FPS. A short 300 ms visual buffer absorbs modest packet jitter; physics and saved positions remain server-owned.

**Fixed in 0.3.1:** fewer false Lua timeouts during worker startup, automatic backoff for failing scripts, and distinct pilot nameplates. Other tractors with a PILOT tag are connected players; they disappear on disconnect while keeping their saved progress.

**New in 0.3.0:** detailed tractors, limestone cottages, slate roofs, textured meadows and gravel lanes, layered clouds and leafy village scenery, protected offline progress, optional password accounts and email recovery, and a repeatable 100-client load probe. See [CHANGELOG.md](CHANGELOG.md).

This is a playable first implementation, not a claim of complete historical feature parity. Read [implementation status](docs/STATUS.md) for the supported mechanics and remaining specification gaps. The game has no dependency on the original servers, accounts, binaries or assets.

## Performance and chat (0.11.0)

Version 0.11.0 reduces duplicate world/chat traffic and bounds pending updates per
player. Stable connections retain the usual 5 Hz snapshots; slower connections
catch up with current state, and uneven delivery gets a gradually enlarged motion
buffer. Controls still react on the next 50 ms input poll, with fewer repeated
messages while holding a key or parked. No server setting is needed; older clients
remain supported. See [protocol details](docs/PROTOCOL.md#compact-delivery-protocol-3-0110).

Dynamic shadows now default off; an option enables them outside performance mode.
Models, textures, contact shading, headlights and town lighting are retained.
Static scenery and HUD work is reused, NPC routing checks fewer collision cells,
and Lua events share lightweight runtime workers with isolated per-event state.
Driving bursts no longer consume the separate action allowance.

Scroll the main chat to read up to 100 recent messages. New arrivals keep your
reading position; **jump to latest** returns to live chat.

The driving display now separates **ms ping** from **FPS**. High ping suggests
network/server delay; low FPS points to rendering/device load. Both can happen
together. See [lag troubleshooting](docs/PLAYING.md#when-the-game-feels-laggy) and
[repeatable hosting checks](docs/HOSTING.md#connection-and-multiplayer-checks).

## Screenshots

Actual gameplay, with original models, material textures and interface. The first image uses detailed graphics and the H-key scenery view:

![Detailed-mode countryside, a glazed tractor cab and weathered village materials](docs/screenshots/scenery.png)

![A tractor in Little Puddlewick, with the parish map, player status and inventory](docs/screenshots/parish.png)

![A working flour mill showing stock, prices, investment and property purchase](docs/screenshots/trading.png)

<details>
<summary>Village variety, character detail, galaxy directory and live world editor</summary>

These gameplay captures show the scale and architecture update in 0.3.4.

![Village buildings at distinct heights and footprints](docs/screenshots/village.png)

![Human beside a cottage with a full-height doorway](docs/screenshots/human-scale.png)

![Two-storey pub with a side wing and timber framing](docs/screenshots/pub.png)

![Mill tower and original timber mill wheel](docs/screenshots/mill.png)

![Original walking character with work clothes and articulated limbs](docs/screenshots/character.png)

![Walking pose captured from the live renderer](docs/screenshots/walking.png)

![Seated driver visible through the tractor cab](docs/screenshots/driver.png)

![Galaxy directory with persistent worlds and world creation](docs/screenshots/galaxy.png)

![Owner editor for world rules](docs/screenshots/editor.png)

</details>

<details>
<summary>Gameplay expansion</summary>

Staged gameplay in a disposable local world, using the actual renderer and server:

![Timber cottage and blue tractor](docs/screenshots/wood-cottage.png)
![Winter snow on the village](docs/screenshots/winter.png)
![Sunset lighting](docs/screenshots/sunset.png)
![Growing crops beside a farm](docs/screenshots/farm-plots.png)
![Crop care and harvest controls](docs/screenshots/farming.png)
![Seven-system galaxy and jump routes](docs/screenshots/galaxy-routes.png)

</details>

<details>
<summary>Night lighting, storms, woodland and guesthouses (0.5.0)</summary>

Staged local worlds running the released gameplay code:

![An occupied guesthouse at dusk](docs/screenshots/evening-inn.png)
![Street lights and cottage windows illuminate the village](docs/screenshots/night-town.png)
![Snowstorm with accumulated snow](docs/screenshots/snowstorm.png)
![Player-built timber bed and breakfast](docs/screenshots/guesthouse.png)
![Room booking and a guest's private pantry](docs/screenshots/lodging.png)
![Gathering grounds and their remaining reserves](docs/screenshots/gathering.png)

</details>

## Play locally

Install Node.js 24.14 or newer, then clone and run:

```sh
git clone https://github.com/151henry151/Aclone.git
cd Aclone
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. Create a pilot, land in Puddlewick, and press **F7** or **How things work** for the field guide. No account service, paid service, API key, or separate database installation is required. Node provides SQLite; its experimental-feature notice on Node 24 is expected.

If port 3000 is occupied:

```sh
PORT=3007 npm run dev
```

For a production build:

```sh
npm run build
npm start
```

### Docker deployment

```sh
docker compose up --build -d
docker compose logs -f
```

Compose keeps the SQLite database and uploads in a named volume and binds to
`127.0.0.1:3000`. Put an HTTPS reverse proxy in front for public access. The
[deployment guide](docs/HOSTING.md) covers native services, TLS, environment
variables, backups and restoration. GitHub Pages cannot host the authoritative
Node/WebSocket server.

The server serves the compiled client and WebSocket API together. Development mode serves the client through Vite. The default bind address is loopback. To let other devices on your LAN connect:

```sh
HOST=0.0.0.0 PORT=3000 npm start
```

They open `http://YOUR-LAN-IP:3000`. Use HTTPS through a reverse proxy for an internet-facing instance; see [hosting and backups](docs/HOSTING.md). A running server continues simulating every world even when all players are offline.

### Graphics

Evergreen woodland uses branching spruce/fir silhouettes, fine needle sprays and bark textures generated in the browser. Performance mode keeps the same tree shapes with fewer secondary shoots; detailed mode adds fuller foliage; dynamic shadows are a separate opt-in setting. The [art guide](docs/ART.md#evergreen-woodland) explains the renderer and how to capture inspection views.

<details>
<summary>Evergreen woodland previews (0.8.1)</summary>

![Reworked evergreen branches and varied tree sizes](docs/screenshots/evergreen.png)
![Needle-covered shoots and exposed woody branches up close](docs/screenshots/evergreen-close.png)

</details>

Open **Pilot & preferences → Graphics** to cycle through **adaptive** (the default, with automatic fallback), **detailed** (higher resolution and antialiasing), and **performance** (lower resolution, fewer plants, contact shading). Detailed mode benefits from a hardware GPU. Detected software renderers use a smaller framebuffer and a capped render rate to leave time for controls. Every mode uses the same original material textures and detailed tractor model. Drag the view and scroll to inspect the scene; **C** cycles cameras. Press **H** for an unobstructed scenery view; **H** or **Escape** restores the HUD. The four textures add about 2.7 MiB to the first village visit and work under URL prefixes such as `/aclone/`.

## Your first day

1. Drive with **arrows** or **WASD**. **Shift** boosts; it also uses more fuel. Drag the view, use the mouse wheel to zoom, or press **C** to change camera.
2. Drive near the **Odd Jobs Office**, north of the village green. **E / Ctrl** opens a nearby building. A 15-second shift pays 45d.
3. Buy bread and water from **Harbour stores**. Use them from your inventory. Bread reduces hunger; water reduces thirst. Eating the same thing repeatedly reduces its benefit.
4. Learn a profession at the **school**. The first qualification costs 80d and takes a real minute. Later qualifications take forty minutes and cost 160d. These onboarding values are original tuning, not a historical claim.
5. Take a job, then choose **Work two cycles**. Wages are paid only on successful, funded production cycles. Farm staff instead earn wages by completing harvest shifts. Buy an unclaimed business, supply its inputs and fund its investment account. Set your own trading prices.
6. Buy a house and put food and drink in its Stockroom. **Go home** to use its supplies, including while offline. You can also book a room at a player-run B&B or hotel and store your own provisions. Click **At home · Go outside** above the chat to leave your house or rented room and resume driving or walking. Offline health loss, ageing and property decay pause; business and training continue.
7. Open **Resources** to find wood, stone, gravel and topsoil. Carry tools for timber/minerals. Deliver to businesses or build your own processing chain. Turn on **headlights (L)** outside town at night; wet or snowy roads slow you down.
8. Choose **Activities** for Hornball, the circuit, fishing, or two-player Ultrakricket. Hornball uses your horn, not a gun.
9. Drive to the **spaceport** to exchange local cash for galactic credits or take off. Create a world from the galaxy directory; **F10** opens its owner editor.

The menu has a directory showing distances to every building. Transactions require proximity; opening a distant building only inspects it. On touch screens there are driving buttons. Desktop keyboard and mouse remain the primary interface.

## Controls

- Arrows / WASD: throttle and steering. Shift: boost.
- E / Ctrl: interact. Enter / F2: chat. `*help`: supported commands.
- Space: horn. Tab: primary weapon in a fighting world, otherwise horn. Number keys 1–6 select a weapon.
- F4: engine. L: headlights. C: chase / first-person / overhead camera. Wheel: zoom. Drag: orbit; in first-person view, look around and up/down.
- Insert / Delete: climb / descend in a biplane or robocrow. Carry a jetpack to lift a ground vehicle.
- R / F5: deploy a disposable robocrow or return to your body.
- F3: reel when the fishing bite prompt appears.
- I: inventory. M / click minimap: parish map. F7: guide. F9: menu. F10: world editor. Esc: close a window.

All important F-key actions have on-screen alternatives because browsers reserve some keys. Options include a performance graphics mode for integrated GPUs or software rendering. Sound starts after your first click or keypress, unless you previously muted it. Use the visible **Sound** button to mute/unmute; **Pilot & preferences** also has a saved volume slider. Engines idle and rev while driving, nearby players’ engines and horns have distance and stereo positioning, and supplied processing buildings make machinery sounds. Hidden tabs and disconnected sessions are silent. See [sound controls](docs/PLAYING.md#sound) for details.

## Keep your pilot

Start with a pilot name, then open **Pilot & preferences** to set a password of at least 12 characters. Returning players can sign in by pilot name and password. You keep the same inventory, properties, skills and credits when adding a password to an existing pilot.

If the operator enables SMTP, add an email address and follow its verification link. **Forgot your password?** emails a single-use reset link valid for 30 minutes. Password resets and signing out invalidate old pilot keys and active connections. Email delivery needs operator configuration; it is not available automatically on a fresh local install. See [account and email setup](docs/HOSTING.md#accounts-and-recovery-email).

The browser still stores a private **pilot key** for automatic reconnection. Export a fresh key after password sign-in and keep it private; sign-in rotates it. Key-only pilots remain supported. Losing both a key and password access without a verified recovery address still loses access to that identity.

World state, accounts and a money ledger are stored under `var/aclone.sqlite` by default. Acknowledged world actions save immediately; movement and ongoing simulation save every five seconds. Graceful shutdown saves all worlds. The server makes hourly SQLite backups and retains the most recent 24. Personal health loss, ageing and owned-building decay pause when disconnected. Residents at home or in paid rooms still use stored provisions; running out cannot kill an offline pilot. Production and pending rewards continue. Offline restart catch-up is bounded to 30 real days; see hosting documentation for recovery details.

## What is included

- A Three.js client with original low-poly scenery, a 128 × 128 terrain mesh, day/night lighting, chase cameras, tractor smoke, map, chat, inventory and building windows.
- Authoritative multiplayer simulation: clients request actions and send bounded control inputs; the server owns position, money, stock, damage and timers.
- Integer currency with sheckle/denarius formatting, taxes, investment, wages, 22 production recipes (farms use seasonal plots), tasks, skills, construction, banks, home stores and survival.
- 24 data-defined vehicle slots; tractor, car, biplane, boat, hovercraft, walking, ostrich and robocrow modes. Six data-defined weapons and safe zones.
- Hornball, checkpoint racing, fishing and a simple original Ultrakricket ruleset.
- Persistent pilot identities, three star systems, planet travel, credit conversion, three ships and station cargo trading.
- World creation from economy/combat/playground templates, live owner settings, terrain brushes, placement, zones, prices, wages, asset uploads and isolated Lua event handlers.
- GPL licensing, unit and real WebSocket integration tests, browser tests, CI, Docker packaging, developer and operator documentation.

## Optional AI resident

An opt-in OpenAI-powered resident, **Mabel Reed**, can drive, work, trade and chat using ordinary player rules. She keeps a persistent journal and a small working notebook, and can look up controls, FAQs, gameplay guides and current catalog defaults to help neighbours. Only one resident is configured; multi-step plans, sleeping in an empty parish and shared daily/monthly cost caps limit API use. API-key billing is separate from a ChatGPT subscription. See [setup, chat, budget and operator controls](docs/NPCS.md). Disabled by default; requires a server API key. A live OpenAI smoke test has verified chat, driving to work, three paid labour shifts from one plan, and memory persistence across a restart.

Version 0.11.1 expands Mabel's always-present knowledge to the full
FAQ and economy guide, with live production/employment diagnostics and clearer
success/failure feedback. Repeated failures now back off, recently failed steps
are temporarily blocked, and duplicate autonomous announcements are suppressed. See [the NPC guide](docs/NPCS.md#helping-other-players)
and [mill troubleshooting](docs/FAQ.md#why-is-my-flour-mill-not-making-flour).

![Mabel identified as AI, with private help chat in a disposable local browser test](docs/screenshots/npc-chat.png)

The screenshot uses a scripted test reply to verify the interface. Separate live OpenAI tests verify gameplay and answers about controls, recovery, ownership and crops.

## Contribute

The gameplay expansion is described in [the player guide](docs/PLAYING.md) and [the changelog](CHANGELOG.md).

See [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/ARCHITECTURE.md), [data tuning](docs/DATA.md), [protocol](docs/PROTOCOL.md) and [Lua scripting](docs/SCRIPTING.md).

```sh
npm run check        # strict TypeScript + unit/integration tests
npm run format:check
npm run build
npx playwright install chromium
# start the game in another terminal, then:
npm run test:e2e
npm run test:load    # isolated 100-client, 10-second local load probe
npm run test:network # compressed TCP test: limited bandwidth, delay, jitter and a fast peer
```

The browser suite creates disposable pilots and worlds: point it at a test instance, not your production parish. `TEST_URL` changes its target and `CHROMIUM_PATH` optionally selects a local Chromium executable. The home-exit regression starts its own temporary server and checks mouse and keyboard activation during live updates, reconnection and resumed movement. Run it independently with `npm run test:e2e -- tests/browser/home.spec.ts`. The map regression (`npm run test:e2e -- tests/browser/map.spec.ts`) also starts an isolated server and checks keyboard/click opening, live markers, custom building names, stable zoom/focus and mobile panning; it writes desktop and mobile captures to `test-results/`. The browser runner uses `tsx` for TypeScript server fixtures and runs one browser at a time to avoid competing software WebGL renderers. `SCREENSHOT_OUTPUT_DIR=/tmp/aclone-seasons npm run screenshots:seasons` validates farm harvesting and space travel while saving captures outside the documentation. `npm run screenshots:town` captures the expanded town and checks access to its public services using an isolated server. Unit and network tests use temporary databases and random ports.

After `npm run build`, run `npx tsx scripts/night-lighting.ts` to capture repeatable midnight headlight and streetlight views plus a daytime comparison in `test-results/night-lighting`. It uses a disposable world, checks the real **L** toggle, and reports browser errors. `SCREENSHOT_OUTPUT_DIR` changes the destination, `SCREENSHOT_GPU=1` enables hardware rendering, and `SCREENSHOT_QUALITY=low` exercises the reduced light budget.

`npx tsx scripts/night-sky.ts` captures natural near-full, half and crescent phases, an overcast sky, two hours of sky movement and daylight. It also compares the same ground view under full moons, starlight alone and overcast skies, with headlights off. It uses the same screenshot options and an isolated world, saving to `test-results/night-sky` by default.

Tuning is in `data/*.json`. New behaviours need tests before or alongside implementation. Update `CHANGELOG.md`, review this README and affected guides, and keep the code formatted. No generated client build, saved accounts, reference screenshots or source-research exports belong in a release archive.

## Licensing and acknowledgements

Aclone code, configuration, documentation and original generated art/audio are **GPL-3.0-or-later**, unless a file explicitly states otherwise. See [LICENSE](LICENSE), [COPYRIGHT](COPYRIGHT) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Contributions use the same license.

_A tractor / The Universal_ belongs to its respective creators. Aclone is independent and is not endorsed by them. Research material under `sources/` and the supplied design spec are reference material, **not relicensed by Aclone** and not included in the client or release archive. The World Owners' Manual is attributed in the research spec; Aclone's guides use original wording.
