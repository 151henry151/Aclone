# Tractor fleet

Available from **0.88.0**. The six designs are alternative tools, not an
upgrade ladder. Models share the game's simple geometry and baked surface-detail
approach. Their body proportions, cabins, wheelbases, tyre sizes and equipment are
different; paint remains a separate personal choice.

## Choosing a machine

- **Puddle tractor — starter, no purchase cost.** Rounded red bonnet, cream cab,
  large rear wheels. 150 cargo weight, 13 m/s road limit, 64 fuel units,
  0.009 fuel units/second at cruise. The most economical engine and a useful
  general-purpose load; ordinary lights and traction.
- **Orchard Wren — 360d.** Low teal bonnet, open seat and protective roll bar.
  95 cargo, 12 m/s, 40-unit tank, 0.010 fuel/second. Best steering and
  acceleration, narrowest collision footprint; small loads and frequent refuelling.
- **Swift Kestrel — 780d.** Long blue nose, amber trim and swept windscreen.
  110 cargo, 18 m/s, 48-unit tank, 0.019 fuel/second. Fastest road tractor;
  loses its advantage on bad ground and has limited room for bulk freight.
- **Barley Dray — 960d.** Oxblood forward cab and timber-sided load platform.
  280 cargo, 9 m/s, 80-unit tank, 0.023 fuel/second. Highest bulk capacity;
  slow acceleration, wide turning circle and the highest fuel consumption.
- **Fenlander — 1,100d.** Angular green cab, protected nose and four equal-size
  wide tyres. 180 cargo, 11.5 m/s, 72-unit tank, 0.020 fuel/second. Recovers
  38% of the speed/grip penalty on difficult surfaces. It still slows in deep
  snow; it does not gain extra speed on dry roads. Relatively slow and thirsty.
- **Lamplighter — 880d.** Gold-and-ivory forward cab, equipment deck and roof
  work lamps. 135 cargo, 12.5 m/s, 104-unit tank, 0.016 fuel/second.
  Strongest headlights (160% of the classic's output, 150m cutoff versus 110m)
  and largest tank. Moderate payload and speed; tank size is not fuel efficiency.

Prices are in denarii; the world converts those to its own sheckle display.
Road limits are for a healthy vehicle on dry level roads, without boost. Boost
raises the limit by 70% and increases fuel consumption. Hills, weather and wear
continue to matter. Cargo capacity is the maximum weight of carried inventory,
not an additional personal stockroom. Armour and passenger capacity are identical.
A larger machine needs more clearance around buildings and scenery.

## Garage and ownership

The garage offers a rotating orthographic preview at one common scale and a
specification comparison. Select an owned tractor to repaint it: each machine saves
its own finish, and the preview displays that finish. Painting a parked tractor does
not switch your active vehicle. Repainting costs the usual 25d per machine; trim,
tyres, glass and timber retain their original materials. Existing owned machines
keep their previous shared colour, while new purchases start in factory colours.
Other owned motor vehicles can be repainted individually while selected at the garage. New tractor purchases start with **empty tanks**;
buy and carry Fuel before setting out. Each Fuel adds up to 8 tank units, limited
by that model's capacity. Refuelling another player obeys the same limit.

Buying a tractor charges once. Ownership, each machine's fuel and maintenance
condition survive reloads and new lives under the existing fleet rules. Fuel is
parked when changing machines; it is never duplicated or thrown away when choosing
a smaller tank. Old saves' formerly shared fuel is adopted once when switching
between legacy vehicles. Walking and robocrow scouting preserve the parked tank.

Return to tractor recalls the last selected owned tractor. A garage is required
for a new purchase; owned tractors can be recalled outside without another fee.
Unload before moving to a machine with a smaller cargo limit. Tractors remain
licence-exempt, like the starter tractor. Competitive minigames keep their existing
standard tractor; the player's specialist and its fuel remain available afterwards.
Checkpoint courses still require the standard tractor for comparable records.

## Cockpit view

First-person cameras sit at the driver's eye position, slightly looking down so the
instruments and the road remain visible. Drag to look around the cab. Steering
wheels lean forwards, with simple spokes, hubs and support columns. Dashboard
faces, gauges, fasteners, pedal pads, door handles and lining are drawn into small
shared textures rather than separate detail meshes. The instrument faces and their
painted housings have gently rounded upper corners.

The speedometer shows actual speed in mph (including reverse speed); the fuel gauge
uses that machine's tank capacity. The condition gauge and odometer use its saved
maintenance record. Engine and light indicators reflect their current states;
turning on the lights illuminates the instrument face. Only the visible local
cockpit updates its texture, at most four times per second, and unchanged readings
skip uploads. Other vehicles share static instrument textures. The new interiors
add fewer than 400 triangles per model, including the corrected steering assembly
and rounded dashboard housings.

## Design and balance checks

The catalogue has six tractors, including the reworked starter. New machines use
slots 24–28: slots 0–23, including all sixteen creator slots, retain their identities.
World creators can tune and reskin the appended slots using the existing editor.

No tractor is equal or better than another on every measured capability, even
ignoring price: speed, acceleration, steering, cargo, tank capacity, distance per
fuel unit, surface-penalty recovery, headlight output and reach. This is a useful
regression guard, not a claim that every player's preferences will be identical.

Practical niches are deliberate: the Dray wins on bulk capacity, the Kestrel on
small road deliveries, the Wren on tight manoeuvres, the Fenlander on poor ground,
the Lamplighter on night visibility, and the classic on fuel economy. Test actual
trips rather than treating the largest fuel tank as the longest range or the
highest top speed as the best haulage vehicle.

Automated checks cover paid purchase/recall, fuel conservation and caps, save/load,
cargo rejection without financial side effects, legacy NPC recovery, real movement
on dry and snowy terrain, minigame tank preservation, and each wheelbase's contact
with slopes. Browser checks exercise garage selection, previews, purchase and
walking/tractor recall on desktop and phone. Front and rear contact sheets use the
actual game models, not concept art.

Run `npx tsx scripts/tractor-preview.ts` to render the model inspection images into
`output/tractors/`. Run the game tests with `npm test`, and the garage browser checks
with `npm run test:e2e -- tests/browser/tractor-shop.spec.ts`.
