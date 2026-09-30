# Aclone

**A small, persistent universe with an unreasonable number of tractors.**

**Play the alpha:** [hromp.com/aclone](https://hromp.com/aclone)

Aclone is an independent, open-source browser game inspired by the economy and vehicle playgrounds of _A tractor / The Universal_. Run a business, drive a tractor, employ your neighbours, play Hornball, or make a world with your own rules. The code, models, material textures and synthesized sounds are original. Texture provenance and generation prompts are documented in [the art guide](docs/ART.md).

**Version 0.4.0 · development alpha · GPL-3.0-or-later · Node.js 24.14+**

**New in 0.4.0:** seasonal farming and weather, team combat modes, an expanded galaxy with saved journeys and contracts, cottage styles, tractor paint and conditional chimney smoke. See the [player guide](docs/PLAYING.md) for timing, controls and balance decisions.

**Updated in 0.3.4:** compact tractor proportions and a varied village of cottages, shops, civic buildings and industrial sheds, with consistent human-scale doors, windows and street furniture. New buildings retain existing identities, ownership and inventories.

**Fixed in 0.3.3:** smoothly shaded walking characters and cab drivers with natural proportions, facial and clothing detail, animated limbs, and a closer walking camera. Use **Inventory → Switch to walking** or **Return to tractor**.

**Fixed in 0.3.2:** smoother tractor movement and camera tracking between network updates, with software/performance rendering targeting up to 30 FPS. A short 300 ms visual buffer absorbs modest packet jitter; physics and saved positions remain server-owned.

**Fixed in 0.3.1:** fewer false Lua timeouts during worker startup, automatic backoff for failing scripts, and distinct pilot nameplates. Other tractors with a PILOT tag are connected players; they disappear on disconnect while keeping their saved progress.

**New in 0.3.0:** detailed tractors, limestone cottages, slate roofs, textured meadows and gravel lanes, layered clouds and leafy village scenery, protected offline progress, optional password accounts and email recovery, and a repeatable 100-client load probe. See [CHANGELOG.md](CHANGELOG.md).

This is a playable first implementation, not a claim of complete historical feature parity. Read [implementation status](docs/STATUS.md) for the supported mechanics and remaining specification gaps. The game has no dependency on the original servers, accounts, binaries or assets.

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

Open **Pilot key & options → Graphics** to cycle through **adaptive** (the default, with automatic fallback), **detailed** (keeps dynamic shadows), and **performance** (lower resolution, fewer plants, contact shading). Detailed mode benefits from a hardware GPU. Detected software renderers use a smaller framebuffer and a capped render rate to leave time for controls. Every mode uses the same original material textures and detailed tractor model. Drag the view and scroll to inspect the scene; **C** cycles cameras. Press **H** for an unobstructed scenery view; **H** or **Escape** restores the HUD. The four textures add about 2.7 MiB to the first village visit and work under URL prefixes such as `/aclone/`.

## Your first day

1. Drive with **arrows** or **WASD**. **Shift** boosts; it also uses more fuel. Drag the view, use the mouse wheel to zoom, or press **C** to change camera.
2. Drive near the **Odd Jobs Office**, north of the village green. **E / Ctrl** opens a nearby building. A 15-second shift pays 45d.
3. Buy bread and water from **Harbour stores**. Use them from your inventory. Bread reduces hunger; water reduces thirst. Eating the same thing repeatedly reduces its benefit.
4. Learn a profession at the **school**. The first qualification costs 80d and takes a real minute. Later qualifications take forty minutes and cost 160d. These onboarding values are original tuning, not a historical claim.
5. Take a job, then choose **Work two cycles**. Wages are paid only on successful, funded production cycles. In the unreleased farming system, farm staff instead earn wages by completing harvest shifts. Buy an unclaimed business, supply its inputs and fund its investment account. Set your own trading prices.
6. Buy a house and put food and drink in its Stockroom. **Go home** to use its supplies while playing. While disconnected, hunger, ageing and property decay pause; your business and training continue.
7. Choose **Activities** for Hornball, the circuit, fishing, or two-player Ultrakricket. Hornball uses your horn, not a gun.
8. Drive to the **spaceport** to exchange local cash for galactic credits or take off. Create a world from the galaxy directory; **F10** opens its owner editor.

The menu has a directory showing distances to every building. Transactions require proximity; opening a distant building only inspects it. On touch screens there are driving buttons. Desktop keyboard and mouse remain the primary interface.

## Controls

- Arrows / WASD: throttle and steering. Shift: boost.
- E / Ctrl: interact. Enter / F2: chat. `*help`: supported commands.
- Space: horn. Tab: primary weapon in a fighting world, otherwise horn. Number keys 1–6 select a weapon.
- F4: engine. L: headlights. C: chase / first-person / overhead camera. Wheel: zoom.
- Insert / Delete: climb / descend in a biplane or robocrow. Carry a jetpack to lift a ground vehicle.
- R / F5: deploy a disposable robocrow or return to your body.
- F3: reel when the fishing bite prompt appears.
- I: inventory. M: directory. F7: guide. F9: menu. F10: world editor. Esc: close a window.

All important F-key actions have on-screen alternatives because browsers reserve some keys. Options include synthesized sound (off initially) and a performance graphics mode for integrated GPUs or software rendering.

## Keep your pilot

Start with a pilot name, then open **Pilot & preferences** to set a password of at least 12 characters. Returning players can sign in by pilot name and password. You keep the same inventory, properties, skills and credits when adding a password to an existing pilot.

If the operator enables SMTP, add an email address and follow its verification link. **Forgot your password?** emails a single-use reset link valid for 30 minutes. Password resets and signing out invalidate old pilot keys and active connections. Email delivery needs operator configuration; it is not available automatically on a fresh local install. See [account and email setup](docs/HOSTING.md#accounts-and-recovery-email).

The browser still stores a private **pilot key** for automatic reconnection. Export a fresh key after password sign-in and keep it private; sign-in rotates it. Key-only pilots remain supported. Losing both a key and password access without a verified recovery address still loses access to that identity.

World state, accounts and a money ledger are stored under `var/aclone.sqlite` by default. Acknowledged world actions save immediately; movement and ongoing simulation save every five seconds. Graceful shutdown saves all worlds. The server makes hourly SQLite backups and retains the most recent 24. Personal survival and owned-building decay pause when disconnected. Production and pending rewards continue. Offline restart catch-up is bounded to 30 real days; see hosting documentation for recovery details.

## What is included

- A Three.js client with original low-poly scenery, a 128 × 128 terrain mesh, day/night lighting, chase cameras, tractor smoke, map, chat, inventory and building windows.
- Authoritative multiplayer simulation: clients request actions and send bounded control inputs; the server owns position, money, stock, damage and timers.
- Integer currency with sheckle/denarius formatting, taxes, investment, wages, 14 supply-chain recipes, tasks, skills, construction, banks, home stores and survival.
- 24 data-defined vehicle slots; tractor, car, biplane, boat, hovercraft, walking, ostrich and robocrow modes. Six data-defined weapons and safe zones.
- Hornball, checkpoint racing, fishing and a simple original Ultrakricket ruleset.
- Persistent pilot identities, three star systems, planet travel, credit conversion, three ships and station cargo trading.
- World creation from economy/combat/playground templates, live owner settings, terrain brushes, placement, zones, prices, wages, asset uploads and isolated Lua event handlers.
- GPL licensing, unit and real WebSocket integration tests, browser tests, CI, Docker packaging, developer and operator documentation.

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
```

The browser suite creates disposable pilots and worlds: point it at a test instance, not your production parish. `TEST_URL` changes its target and `CHROMIUM_PATH` optionally selects a local Chromium executable. Unit and network tests use temporary databases and random ports.

Tuning is in `data/*.json`. New behaviours need tests before or alongside implementation. Update `CHANGELOG.md`, review this README and affected guides, and keep the code formatted. No generated client build, saved accounts, reference screenshots or source-research exports belong in a release archive.

## Licensing and acknowledgements

Aclone code, configuration, documentation and original generated art/audio are **GPL-3.0-or-later**, unless a file explicitly states otherwise. See [LICENSE](LICENSE), [COPYRIGHT](COPYRIGHT) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Contributions use the same license.

_A tractor / The Universal_ belongs to its respective creators. Aclone is independent and is not endorsed by them. Research material under `sources/` and the supplied design spec are reference material, **not relicensed by Aclone** and not included in the client or release archive. The World Owners' Manual is attributed in the research spec; Aclone's guides use original wording.
