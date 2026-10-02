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

## Default trade prices (0.16.0)

The reference price in `data/items.json` is a producer's wholesale asking price.
Local processors pay **112%** of that reference for their inputs: buying wheat at
5d from a farm and delivering it to a default mill paying 5.60d leaves the haulier
0.60d per unit before travel costs. The mill sells flour at 22.50d; a default bakery
pays 25.20d. These quotes leave a reason to connect local businesses.

Each factory recipe is priced to cover its posted ingredient bids, **one active
worker's gross wage**, and the default **7% sales tax** (5% world + 2% parish).
At the normal batch size, net output sales retain at least 25% above those costs.
For example, a mill pays 28d for five wheat plus 22d in wages; three flour sold at
22.50d return about 62.78d after tax, leaving about 12.78d for its investment.
Wage tax is withheld from the worker's gross wage, not charged again to the employer.
Multiple employees all receive wages without increasing batch output, so excessive
staffing can still lose money. Repairs, travel, food, shortages, custom taxes and
owner-edited quotes also affect actual profit; the default balance is not a guarantee.

Harbour stores pays **90%** of reference for recipe ingredients and **103%** for
finished goods; the spaceport pays **85%** and **101%** respectively. They sell at
**155%** and **165%**. Raw materials and intermediate goods therefore earn more
when delivered to local consumers. Finished bread can still be bought at the bakery
for 48d and exported at the harbour for 49.44d, but a pub pays 53.76d. Buying imports
at one outlet and immediately exporting them through the other loses money.

Pubs, B&Bs, hotels and garages have restocking bids for their relevant goods.
They normally buy at 112% and sell at **135%** of producer reference, covering sales
tax and a retail margin while undercutting imported finished goods. Garages stock
fuel and tools when supplied; hospitality outlets buy food and drinks. Newly added
listings start with whatever stock is actually present, including zero.

**Water supply (0.16.0):** shoreline waterworks sell water at 5d. Processors
and lodging businesses buy at 5.60d; lodging resells at 6.75d. Harbour water remains
7.75d, an emergency import rather than a profitable source for local resale.
A staffed batch costs 22.40d of fuel plus 22d wages; twelve water return 55.80d
after default sales tax, leaving 11.40d. No waterworks is spawned automatically;
until someone builds and supplies one, players can still import water. Logs,
gravel and topsoil can be gathered and sold directly to their local consumers. All six farm crops
have default sell listings; seed costs, seasonal yield, irrigation and harvest wages
remain ordinary farm expenses. Prices do not spawn goods, move cargo automatically,
or replenish a business's capital. Employees/owners and hauliers must supply demand.

On the first load of an older world, pricing revision 2 replaces buy/sell lists on
unowned and treasury-run public buildings. **Every player-owned business is skipped,
including NPC-owned businesses and owner-edited or unchanged prices.** Stock, money,
wages, employment and ownership are retained. The saved revision prevents repeated
repricing after future edits. An owned business with incompatible old bids may still
need its owner to adjust them; changing reference prices does not rewrite its quotes.

The 0.16.0 waterworks upgrade adds pricing revision 3. It replaces only old
default water bids of 8.68d and lodging asks of 10.47d on unowned/public buildings;
other custom quotes and every human/NPC-owned business remain untouched. Worlds
older than revision 2 receive the full current defaults in one migration.

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

- **Shoreline waterworks / pump operator:** 1 fuel → 12 water. Build on dry ground
  directly beside water; a dry intake or flooded foundation stops production.
  Water supplies households, lodging, irrigation, kitchens, tea and concrete.
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
the imported-fertilizer fallback costs the default Harbour compost price (currently 39.53d), so buying locally produced compost at 25.50d is cheaper. Fertilize once per crop
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
