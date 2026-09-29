# Aclone

**A small, persistent universe with an unreasonable number of tractors.**

**Play the alpha:** [hromp.com/aclone](https://hromp.com/aclone)

Aclone is an independent, open-source browser game inspired by the economy and vehicle playgrounds of _A tractor / The Universal_. Run a business, drive a tractor, employ your neighbours, play Hornball, or make a world with your own rules. The code, procedural art and synthesized sounds are original.

**Version 0.2.1 · development alpha · GPL-3.0-or-later · Node.js 24.14+**

This is a playable first implementation, not a claim of complete historical feature parity. Read [implementation status](docs/STATUS.md) for the supported mechanics and remaining specification gaps. The game has no dependency on the original servers, accounts, binaries or assets.

## Screenshots

Actual gameplay with Aclone's original procedural models and interface:

![A tractor in Little Puddlewick, with the parish map, player status and inventory](docs/screenshots/parish.png)

![A working flour mill showing stock, prices, investment and property purchase](docs/screenshots/trading.png)

<details>
<summary>Galaxy directory and live world editor</summary>

![Galaxy directory with persistent worlds and world creation](docs/screenshots/galaxy.png)

![Owner editor for world rules](docs/screenshots/editor.png)

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

## Your first day

1. Drive with **arrows** or **WASD**. **Shift** boosts; it also uses more fuel. Drag the view, use the mouse wheel to zoom, or press **C** to change camera.
2. Drive near the **Odd Jobs Office**, north of the village green. **E / Ctrl** opens a nearby building. A 15-second shift pays 45d.
3. Buy bread and water from **Harbour stores**. Use them from your inventory. Bread reduces hunger; water reduces thirst. Eating the same thing repeatedly reduces its benefit.
4. Learn a profession at the **school**. The first qualification costs 80d and takes a real minute. Later qualifications take forty minutes and cost 160d. These onboarding values are original tuning, not a historical claim.
5. Take a job, then choose **Work two cycles**. Wages are paid only on successful, funded production cycles. Buy an unclaimed business, supply its inputs and fund its investment account. Set your own trading prices.
6. Buy a house and put food and drink in its Stockroom. **Go home** before leaving; it automatically feeds you while you are away.
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

Your browser stores a random **pilot key**, not a password. Export it from **World → Options & pilot key**, keep it private, and use **Restore pilot** in another browser. Losing both the browser storage and exported key loses access to that identity. Names are reserved case-insensitively. Anyone with the key can act as that pilot; never publish it in a bug report.

World state, accounts and a money ledger are stored under `var/aclone.sqlite` by default. World mutations save immediately; movement and ongoing simulation save every five seconds. Graceful shutdown saves all worlds. The server makes hourly SQLite backups and retains the most recent 24. Offline restart catch-up is bounded to 30 real days; see hosting documentation for recovery details.

## What is here

- A Three.js client with original low-poly scenery, a 128 × 128 terrain mesh, day/night lighting, chase cameras, tractor smoke, map, chat, inventory and building windows.
- Authoritative multiplayer simulation: clients request actions and send bounded control inputs; the server owns position, money, stock, damage and timers.
- Integer currency with sheckle/denarius formatting, taxes, investment, wages, 14 supply-chain recipes, tasks, skills, construction, banks, home stores and survival.
- 24 data-defined vehicle slots; tractor, car, biplane, boat, hovercraft, walking, ostrich and robocrow modes. Six data-defined weapons and safe zones.
- Hornball, checkpoint racing, fishing and a simple original Ultrakricket ruleset.
- Persistent pilot identities, three star systems, planet travel, credit conversion, three ships and station cargo trading.
- World creation from economy/combat/playground templates, live owner settings, terrain brushes, placement, zones, prices, wages, asset uploads and isolated Lua event handlers.
- GPL licensing, unit and real WebSocket integration tests, browser tests, CI, Docker packaging, developer and operator documentation.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/ARCHITECTURE.md), [data tuning](docs/DATA.md), [protocol](docs/PROTOCOL.md) and [Lua scripting](docs/SCRIPTING.md).

```sh
npm run check        # strict TypeScript + unit/integration tests
npm run format:check
npm run build
npx playwright install chromium
# start the game in another terminal, then:
npm run test:e2e
```

The browser suite creates disposable pilots and worlds: point it at a test instance, not your production parish. `TEST_URL` changes its target and `CHROMIUM_PATH` optionally selects a local Chromium executable. Unit and network tests use temporary databases and random ports.

Tuning is in `data/*.json`. New behaviours need tests before or alongside implementation. Update `CHANGELOG.md`, review this README and affected guides, and keep the code formatted. No generated client build, saved accounts, reference screenshots or source-research exports belong in a release archive.

## Licensing and acknowledgements

Aclone code, configuration, documentation and original generated art/audio are **GPL-3.0-or-later**, unless a file explicitly states otherwise. See [LICENSE](LICENSE), [COPYRIGHT](COPYRIGHT) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Contributions use the same license.

_A tractor / The Universal_ belongs to its respective creators. Aclone is independent and is not endorsed by them. Research material under `sources/` and the supplied design spec are reference material, **not relicensed by Aclone** and not included in the client or release archive. The World Owners' Manual is attributed in the research spec; Aclone's guides use original wording.
