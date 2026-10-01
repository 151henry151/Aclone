# Living in the parish

## Time and weather

At default speed a game day takes **10 real minutes**. There are 365 days in a year
(60 hours 50 minutes), starting on the first day of spring in a new world. Spring,
summer and autumn each last about 15 hours 20 minutes; winter lasts 15 hours.
The date and the default visual clock cross midnight together. World owners can
change or freeze the **visual** day length without speeding up crops or ageing.

Sunrise comes earlier in summer and later in winter. Sunlight moves east to west;
Overcast, moonless nights are very dark. On clear moonless nights, faint starlight lets you make out nearby ground and silhouettes. A bright full-moon night reveals the grass and terrain, with dimmer detail still visible in the shadows. Turn on headlights with **L** for a wide, long-range beam. Street lamps stay on all night, with a bright centre and broad, overlapping dim light across the gaps between lamps and beyond the roadside; occupied houses cast light from their windows until a varied evening bedtime. Weather fronts last three game days
(about half an hour): rain, snow or clear skies, with seasonal temperatures.
Some wet fronts become thunderstorms with lightning or windy snowstorms. Snow accumulates on the ground, rooftops and foliage and stays until positive temperatures gradually melt it. Wet roads dry over several game days. Rain and snow reduce ground-vehicle speed and steering grip; the clock reports road conditions. Autumn changes deciduous leaf colour; evergreen groves stay green.
Weather is deterministic for each world's date, including after a server restart.

The fictional stars move across the sky overnight and shift with the season.
Two nearby moons, one about half the apparent size of the other, wax and wane
over **28 game days** (4 hours 40 minutes at default speed). They orbit as a close
pair, so their phases are similar; their separation shifts over five game days.
Phases continue across seasons and years instead of resetting. A moon below the
horizon provides no light, and clouds passing over a moon also dim its light on
the ground. Starlight is weaker under cloudy skies. To watch the sky, switch to
walking, press **C** for first-person view, and drag upward to look up.

The ten-minute day and 365-day year follow the supplied historical information.
The seasonal climate, crop durations and economic balance below are original
Aclone choices, not recovered historical constants. They give a crop several
hours to mature while letting a player see multiple seasons during a few sessions.

## Farming

Learn **farmer** at the school, then buy a farm or take a job at one. Farms have
four independent plots. Visit the farm and open its Main tab to plant, irrigate,
fertilize or harvest. Its Building Admin tab funds the investment account; the
Stockroom tab moves your produce into your tractor for delivery to other shops.

- Wheat: spring/autumn sowing, 18 days (3 hours), grain family.
- Potatoes: spring/summer, 12 days (2 hours), root family.
- Hops: spring/summer, 30 days (5 hours), vine family.
- Grapes: spring, 48 days (8 hours), vine family.
- Tea: spring/summer, 36 days (6 hours), leaf family.
- Coffee: spring, 60 days (10 hours), bean family.

Seeds use farm investment. Irrigation uses three carried water per treatment,
up to three treatments per plot. Rain contributes moisture; thirstier crops need
more care. One fertilizer treatment uses a carried compost, or costs 10d if you have none, and adds 33% to yield. Repeating a
crop family in the same plot reduces yield by 20%; rotate families between harvests.
Frost during growth lowers yield, so planting warm crops late in their window
has a consequence. Growth itself continues in cold weather; this is not a dormant
perennial or livestock simulation.

The displayed yield is an estimate using that world's weather calendar. Crops
retain full quality for **six real hours after ripening**. Later crops gradually
lose up to 35% of their quality-adjusted yield, then remain harvestable indefinitely.
Nothing auto-replants or silently throws away an overdue harvest.

Harvesting takes a 15-second shift and locks movement, like other work tasks.
One worker reserves a plot at a time. Finished crops go into the farm's stockroom;
an employed harvester receives its posted wage, funded by investment and subject
to wage tax. Owners working their own plots take produce rather than a wage unless
also employed. If the stockroom fills or wages become unfunded during the shift,
the plot remains intact and can be tried again. Disconnecting does not cancel an
accepted harvest shift or pay it twice.

Wheat supplies mills, hops supply breweries, potatoes supply kitchens/compost, grapes supply wineries, tea supplies blending houses and coffee supplies roasteries. These goods can also be sold through shops or your farm's configured prices. See [resources, crop care and industry](ECONOMY.md) for drainage, soil improvements and processing recipes. New coffee and
potato market listings begin empty: farmers must supply them. Existing farm stock
is retained on upgrade, but automatic wheat production is replaced by these plots.

## Competitive play

A world owner must enable **fighting**. In Activities, join **Team deathmatch**,
**Capture point**, or **Capture the flag**. Teams auto-balance when joining.
Rust and Moss bases are west and east of the northern arena. The capture point
is at its centre. You keep your property and qualifications during arena deaths.

Use **1–6** to select machine gun, grenade, plasma, rocket, javelin or mine.
**Tab** fires; **hold and release Tab** to charge a javelin. Grenades bounce before
exploding. Mines arm after 1.5 seconds and expire after 90 seconds. Explosions have
area damage with distance falloff. Armour applies the original damage × 100 / armour
relationship. Safe zones, occupied homes and teammates are protected. Arena shots
cannot harm non-participants or their buildings. Leaving an activity cancels its
in-flight weapons. Outside a match, fighting-enabled worlds allow open combat
and damage to unprotected private buildings.

The default mode consumes regenerating energy out of 65,000. Owners can choose
`weaponMode = ammo` for ammunition per life. Garage refits cost 25d. Arena respawns
restore health and ammunition with three seconds of protection; firing or picking
up a flag removes protection. Switching activity is explicit through Leave activity.

- Deathmatch: first team to 10 kills.
- Capture point: earn seconds while your team alone occupies the 12m circle;
  reach 120 seconds. Contested points do not score.
- Capture the flag: take the enemy flag to your base while your own flag is home;
  first to three captures wins. Touch a dropped friendly flag to return it.
  Dropped flags also return after 30 seconds. Death, leaving and disconnect drop flags.

Rounds last ten real minutes, pause scoring when either team has no online players,
and restart after a 15-second result interval. Winners receive five kudos. Optional
`killReward` is integer hundredths of a denarius paid by the treasury (default zero);
a victim can trigger a cash reward at most once per 30 seconds. These are original
alpha match rules; town wars, turrets and detailed vehicle weapon loadouts remain
separate fidelity work.

## Travelling between stars

Drive to the spaceport and take off. The galaxy map shows seven systems, direct
routes within your jump range, and intermediate stops for more distant destinations.
A jump costs one credit per rounded-up parsec and takes **6 + 2 × fuel-cost seconds**.
Fuel is included in this fee. Arrival is saved and completes after reconnecting;
station trading and landing are unavailable during transit.

The **Shipyard & space trade** panel provides:

- Owned ships: buying a ship adds it to your hangar. Switching back is free, provided
  all your cargo and contract packages fit.
- Drive and hold upgrades: three levels each, adding 2pc or 20 cargo spaces per level.
  These fleet-wide fittings remain installed when switching ships.
- Station trading: three goods with explicit buy/sell quotes and a spread. Stations
  specialize in different goods. Supply is shared between players and replenishes
  20 units per real hour, up to 200; stations buy until their warehouse reaches 400.
- Courier contracts: reserve ten cargo spaces, deliver to a directly reachable
  system and receive the quoted reward. Contracts do not expire offline. Cancellation
  removes the sealed packages without charging a penalty or paying a reward.
- Surveys: survey each system once for 15cr. Lantern, Rime and The Vessel each reveal
  a relic; collecting all three unlocks purchase of the alien ship.
- Rescue: an empty ship with no contract and under 10cr can return to Hearth for free.
  This prevents a penniless pilot becoming permanently stranded.

Space trading and contracts use galactic credits and cargo, separately from your
planetary tractor inventory. Station and account writes are atomic. Local cash
conversion at a spaceport retains the world's daily cap. This release does not add
space dogfighting or unrestricted conversion of owner-created world wealth.

## Making it your own

Choose one of six stone/wood cottage styles in **Build** before selecting Small
cottage. Styles have the same construction cost. Existing cottages get stable,
varied appearances; their owners, stock and locations stay intact. The garage offers
seven tractor paint colours for 25d, saved with your planetary pilot.

A cottage chimney smokes while its owner is inside, including after logout. Booked guests keep B&B/hotel fires active too. Workplace chimneys smoke while an employed player is online, within 18m and on an active shift. Offline residents eat from home or room supplies without offline health loss or ageing. [Running and staying at a guesthouse](ECONOMY.md#running-a-guesthouse) explains booking, food stores and checkout.

## Finding your way around town

The parish covers roughly eight times its original area. Follow the winding lanes
and use the minimap or Directory to locate dispersed shops and workplaces. Street
lights follow the lanes; headlights help between them. The buildings and tractors
retain their original scale. The Hornball pitch, racing checkpoints and gathering
grounds remain at their established locations.

## Driving and running your business

Wheeled vehicles reverse their steering response when rolling backwards, like
a steering wheel on a reversing tractor. This follows actual speed, so it still
applies while braking from reverse into forward. Walking and aircraft controls
are unchanged.

Owners use **Stockroom** to move goods and **Building Admin** for investment and
profit. You cannot buy/sell goods or take paid work at your own property.
Qualified farm owners can still manage and harvest their own plots unpaid.
Buying your workplace ends your job there.

Default building prices allow a 3% gross resale margin at Harbour stores. Check
stock, working capital, distance and customized quotes before loading your cargo.
