# Materials, businesses and lodging

All quantities below are the default data pack. A world owner can change the
production speed and recipes. Prices are integer hundredths of a denarius in
JSON; the interface displays denarii. These are Aclone balance choices, not
claims about undocumented historical game mechanics.

## Gather, deliver, produce

Open **Resources** in the top bar to see distances, map coordinates and reserves.
Drive within 10m of a marked ground. Logs, stone and gravel need one carried tool;
topsoil can be gathered by hand. A basic load is three units after 20 seconds.
Learn **forester** for timber or **excavator** for minerals/soil to gather six in
12 seconds. Tools are reusable for gathering. Cargo capacity is checked before
starting and again at completion. If you fill your cargo during a shift, free
space to let the reserved load finish; it is not silently discarded.

Each woodland ground holds 18 logs and regrows three per 30 real minutes. Each
mineral/soil ground holds 30 and replenishes three per ten minutes. There are six
grounds of each kind. Reserves are shared, saved and recover offline. Buildings
within 12m obstruct extraction. Survey posts, log stacks and mineral/earth mounds
mark the locations; scenic trees are not individually destructible.

Sell cargo to a business through its Main trading tab. It must offer a buy price,
have working capital and stockroom space. Owners must use **Stockroom**
to move goods without a sale. Use **Building Admin** to invest cash, collect
profit, set wages and set buy/sell prices. There are no automatic sales or unlimited
new-item stocks in public markets.

Default selling prices outside Harbour stores use each item's reference price.
Harbour stores buys at 103% of that price and sells at 112% (rounded to the nearest
hundredth of a denarius). For example, buy bread for 48d at a bakery and sell it
at the harbour for 49.44d: 1.44d gross profit per loaf. Fuel, travel time, available
stock, cargo capacity and the harbour's working capital still matter. Buying from
and selling back to the harbour loses money. Player-set prices can remove or
increase this margin; check the displayed quotes before making a delivery.

Owners cannot buy from or sell to their own property, hire themselves, refresh
their own work shifts or start workplace tasks there. Use Stockroom for goods and
Building Admin for funding and withdrawals. Buying your current workplace ends
your employment there; other employees keep their jobs. Owners can still tend
and harvest their own farm plots, but receive no harvest wage.

Production requires input goods, output space and funded wages. Qualified active
employees give full efficiency; unattended businesses run at the world's reduced
rate. **Work two cycles** covers two of that business's cycles. Actual payments
happen only on successful production. Learn the corresponding profession at school.

## Connected industries

- **Sawmill / lumberjack:** 2 logs → 4 timber. Timber builds structures and feeds
  tool and furniture workshops. The existing tool workshop uses steel and timber.
- **Stonemason / mason:** 3 stone → 2 blocks, used for foundations and larger buildings.
- **Composting yard / horticulturist:** 4 topsoil + 2 potatoes → 3 compost.
  One compost replaces purchased fertilizer or helps restore depleted farm soil.
- **Brick kiln / ceramicist:** 5 topsoil + 1 fuel → 4 fired bricks. Bricks construct
  kitchens, roasteries, wineries, workshops and B&Bs.
- **Concrete works / mason:** 4 gravel + 2 stone + 2 water → 4 concrete. Concrete
  supports hotels, kitchens and roasteries; gravel also drains farm plots.
- **Furniture workshop / carpenter:** 5 timber + 1 tool → 3 furniture in 15 minutes.
  A B&B needs 3 furniture; a hotel needs 8. Unlike gathering, this process consumes
  the tool, so the steel/tool industry supplies the workshop continuously.
- **Winery / vintner:** 5 grapes + 1 timber → 3 wine in 20 minutes. Timber represents
  barrels; wine supplies hospitality or player drink stores.
- **Village kitchen / cook:** 4 potatoes + 1 flour + 1 water → 4 hearty meals. Flour
  comes from the wheat mill. Meals restore 24,000 hunger each before repeat-food effects.
- **Tea blending house / tea blender:** 4 tea + 1 water → 3 packed tea.
- **Coffee roastery / roaster:** 4 coffee + 1 fuel → 3 roasted coffee in 15 minutes.
  Packed tea and roasted coffee restore 24,000 and 28,000 thirst respectively.
- **Brewery / brewer:** the existing hops → beer chain remains available.

Unless stated otherwise these cycles take ten real minutes at default speed.
New businesses start empty. Stock and fund them; they do not create free finished
products at construction. Advanced businesses require the world's existing tier
progression. Several different professions and businesses encourage trade between
players rather than one character learning everything.

## Crops and soil

Wheat is frost tolerant and supplies flour/bread. Potatoes mature fastest, but
waterlogging makes gravel drainage worthwhile; they supply meals and compost.
Hops need moisture and supply beer. Grapes take eight hours, dislike frost and wet
soil, and supply wine. Tea needs moisture but tolerates cold better than coffee;
both have distinct processing buildings. Coffee takes ten hours and is the most
frost-sensitive crop. See [the farming guide](PLAYING.md#farming) for planting windows.

After a plot's first harvest, install permanent drainage using **6 gravel**.
Drainage removes its waterlogging penalty and survives future harvests. **6 topsoil + 1 compost** restores an empty plot, clearing its previous crop-family penalty
for the next planting. **1 compost** fertilizes a growing plot; if you carry none,
the 10d purchased-fertilizer fallback remains available. Fertilize once per crop
for the existing 33% yield bonus. These choices consume real goods; improvements
cannot be repeatedly applied to gain free items or stack bonuses.

## Running a guesthouse

Build a **Bed & breakfast** (3 rooms, timber siding) or **Country hotel** (8 rooms,
three-storey masonry) from Build. Supply the listed construction materials,
including furniture. The owner learns **innkeeper**, sets a price per real hour
in Main, then opens bookings. Closing stops new bookings; existing paid guests
keep their rooms. Income enters the building's working capital for withdrawal.

Guests prepay 1–24 real hours. Each pilot occupies one room; simultaneous requests
cannot overbook it. Enter through **Enter your room**. A room has its own pantry:
store carried food/drink here, up to 100 per item. Only that guest can see and
withdraw its contents. Hosts can separately stock and price meals/drinks for sale
through normal trading, creating demand for kitchens, tea houses and roasteries.

Inside, hunger/thirst rise 20% more slowly. Provisions are consumed as needed,
including offline. Hunger, thirst and starvation damage continue offline; empty stores can lead to death. Offline ageing still pauses.
A saved resident keeps the chimney active. Window lights follow a household's
varied evening bedtime, independently of whether the guest is connected.

Expiry or early checkout puts the character outside and stops pantry consumption.
Early checkout has no refund; there is no automatic renewal or recurring charge.
Leftover supplies remain collectible at that building without another booking.
Room reservations and provisions survive restarts and property sales. A lodging
building containing paid stays or guest supplies cannot be demolished. Its condition
cannot fall below 1%, protecting those supplies; the owner should still repair it.
Hotels use the same exterior shelter model as homes; there is no interior submap.
