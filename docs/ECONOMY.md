# Materials, businesses and lodging

Defaults below are original Aclone tuning; live recipes, taxes and quotes override them. JSON money is integer hundredths of a denarius; UI amounts are denarii.

## Gather, deliver, produce

Use Resources/M for locations and reserves, then the nearby HUD Gather button within 10m. Logs, stone and gravel need one carried tool;
topsoil can be gathered by hand. A basic load is three units after 20 seconds.
Foresters (wood) and excavators (minerals/soil) gather six in 12 seconds. Tools are reusable for gathering. Capacity is checked at start/completion; free cargo space to finish a blocked reserved load.

Each woodland ground holds 18 logs and regrows three per 30 real minutes. Each
mineral/soil ground holds 30 and replenishes three per ten minutes. There are six
grounds of each kind. Reserves are shared, saved and recover offline. Buildings
within 12m obstruct extraction. Woodland clearings, chipped outcrops, gravel hollows and soil banks mark sites; scenic trees are not individually destructible.

Sell through Main to a buyer with a posted price, capital and space. Owners must use **Stockroom**
to move goods without a sale. Use **Building Admin** to invest cash, collect
profit, set wages and set buy/sell prices. Sales and restocking are not automatic.

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
after default sales tax, leaving 11.40d. Puddlewick includes a seeded waterworks; other worlds may need one built. Harbour imports remain available. Logs,
gravel and topsoil can be gathered and sold directly to their local consumers. All six farm crops
have default sell listings; seed costs, seasonal yield, irrigation and harvest wages
remain ordinary farm expenses. Prices do not spawn goods, move cargo automatically,
or replenish a business's capital. Employees/owners and hauliers must supply demand.

Older public-price migrations preserve every human/NPC-owned business; see [upgrade notes](RELEASE_NOTES.md#deploying-0153). Owners may need to adjust incompatible old quotes themselves.

Owners cannot buy from or sell to their own property, hire themselves, refresh
their own work shifts or start workplace tasks there. Use Stockroom for goods and
Building Admin for funding and withdrawals. Buying your current workplace ends
your employment there; other employees keep their jobs. Owners can still tend
and harvest their own farm plots, but receive no harvest wage.

Production requires input goods, output space and funded wages. Qualified active
employees give full efficiency; unattended businesses run at the world's reduced
rate. **Work two cycles** starts a window lasting two production intervals (usually
20 real minutes). Checks run on fixed world-time boundaries, so the first can be
soon after clicking. The HUD and building panel show the remaining time and checks;
renewal becomes available during the final interval. Early renewal resets the
window from now rather than stacking shifts. Expiration is shown until you renew.

You can drive away or log off during a shift: eligibility depends on the deadline,
not your location or connection. Wages require a successful production batch with
inputs, output space and funded payroll. An eligible check can fail without pay;
the timer does not pause. Farms instead pay on funded manual harvest completion.
Worlds with active work disabled need no renewals. Odd Jobs Office labour is a
separate timed task that locks movement. Learn the corresponding profession at school.

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

## Unclaimed estates

Puddlewick keeps a deceased owner's ordinary buildings' stock and working capital. Ownership is released; skills and carried goods still reset. Hotels/B&Bs retain their existing protected-guest rules. Other worlds choose `retainEstateContents`, `estateEquityShare` and `estateAnnualDiscount` in Rules.

An unclaimed estate costs `(base building price + equity share × current equity) × (1 − annual discount)^whole years`, rounded to an internal money unit, minimum one. Puddlewick uses 90% and 5%. Equity is investment plus stock valued at item catalogue prices, not editable shop quotes. Cheap sales reduce goods value while adding only actual receipts, so the asking price drops accordingly. A game year is 365 ten-minute days (~60.83 real hours), independent of the decorative clock. Player-listed asking prices are not discounted.

Existing unclaimed properties start their clock at upgrade; ownership, stock and shop quotes are preserved. Previously erased estates cannot be reconstructed by this migration.

## Public shortage supplies

Puddlewick's public Harbour imports small paid shipments of scarce bread, water and fuel every 30 real minutes, counting local stocks first. Bread/water can also be imported on demand at the posted, expensive Harbour retail price, even with empty shelves or no treasury working capital: the buyer's payment funds that delivery. There are no free player supplies. This fallback only applies to the server-owned public parish and government Harbour, and refuses quotes that undercut catalogue prices or enable guaranteed re-export to a public buyer. Private shops and prices are untouched.

This safety net buys time for waterworks, farms and processors to operate. It does not guarantee every commodity is always stocked or every NPC business succeeds. Local suppliers still offer better terms; production needs skills, active labour, inputs, wages and customers.

## Loans and credit

Banks offer fixed-rate, amortizing personal loans and property-backed loans. Quotes show principal, annual rate, equal instalment, scheduled total and collateral before acceptance. Terms are 6/12/24/36/60 bank months; a month is 1/12 of the fixed game year (~5.07 real hours). Rates are fictional game tuning: eligible personal borrowers pay roughly 10–26% APR; mortgages roughly 6–14%. There are no arrangement or early-payment fees.

The 300–850 game score weighs recorded employment, buildings owned, debt burden and repayment history. Only verified wages/labour earnings count as income; gifts and borrowed cash do not. Affordability also considers liquid reserves after existing debt and a living allowance. Histories start at upgrade; past employment is not invented. Banks lend from actual investment, with at most three active loans per borrower and 75% structural loan-to-value for collateral. Stock/capital inside a building cannot inflate its collateral valuation.

Interest accrues on outstanding principal. Payments settle interest first, then principal. Automatic payments draw **bank savings**, including offline; manual repayments use carried cash. A half-month grace period precedes a late mark. After three bank months in arrears the loan defaults; pledged property becomes an unclaimed estate. Sale receipts repay the lender, surplus returns to the former owner, and any shortfall remains debt. Repaying early releases the lien; listed/mortgaged properties cannot be pledged twice or sold/demolished to evade it. Death does not erase debt.

The design uses ordinary amortization and ability-to-repay concepts ([CFPB explanation](https://www.consumerfinance.gov/rules-policy/regulations/1026/interp-43/)), with accelerated game time and original thresholds; it is not a real credit-reporting system. Loans do not yet support refinancing, bankruptcy or executable chat agreements.

## Business statements

**Statement** separates sales receipts (net of buyer-paid sales tax), materials, net wages, payroll tax, imports, other flows and owner capital. Operating cash flow excludes deposits/withdrawals; it is not accrual profit because unsold stock has not been valued as income. Counters survive restart and ownership transfer with the business. Automatic recipe batches track input/output quantities; seasonal harvests are separate, with their payments included in cash flow. Current blockers are diagnosed server-side, including input shortages, output capacity, wages, staffing and shoreline access.

## Parish maintenance orders

Public Harbour stores and **World / F9 → Parish supply orders** show three rotating maintenance projects. Deliver carried materials at the Harbour for the displayed bid (110% of catalogue value); delivered goods are consumed by the project. Early in each hour, each supplier can fill at most half an order; the remaining demand opens to everyone in the second half-hour. Orders share a fixed hourly budget (up to 1,200d in Puddlewick). Explicit treasury grants fund escrow; unused funds expire. Downtime creates only the current round, never a backlog of grants. NPCs can deliver carried goods, withdraw their own output, or buy profitable local supplies.
