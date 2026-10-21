# Materials, businesses and lodging

Defaults below are original Aclone tuning; live recipes, taxes and quotes override them. JSON money is integer hundredths of a denarius; UI amounts are denarii.

## Gather, deliver, produce

Use Resources/M for locations and reserves, then the nearby HUD Gather button within 10m. Logs need a chainsaw, stone a pickaxe, and gravel or topsoil a shovel.
Workshop tools stay a furniture input and do not unlock gathering. A basic load is three units after 20 seconds.
Foresters (wood) and excavators (minerals/soil) gather six in 12 seconds. The matching implement is reusable. Capacity is checked at start/completion; free cargo space to finish a blocked reserved load.

Each woodland ground holds 18 logs and regrows three per 30 real minutes. Each
mineral/soil ground holds 30 and replenishes three per ten minutes. The village
has six grounds of each kind; large maps add countryside patches on a 400 m
lattice (timber in woodland, stone above 16 m, gravel and topsoil lower down),
each with the same capacity and regrowth. Reserves are shared, saved and recover offline. Buildings
within 12m obstruct extraction. Woodland clearings, chipped outcrops, gravel hollows and soil banks mark sites; scenic trees are not individually destructible.

Sell through Main to a buyer with a posted price, capital and space. Owners must use **Stockroom**
to move goods without a sale. Use **Building Admin** to invest cash, collect
profit, set wages and set buy/sell prices. Neighbours who do not own the building
can still put cash into its till. That stake pays for goods and wages while the
owner is away. You collect a return only after the business earns, never more than
8% above what you put in — a modest working-capital note, not a private-equity
windfall — and never so much that the till cannot cover its
operating reserve. You cannot take the stake back. The owner cannot withdraw cash that would invade the unpaid claim
(the stake plus its 8% return). Demolishing the shop refunds unpaid principal
to the investors first. Sales and restocking are not automatic.

### Pausing trade

In **Building Admin → Set trading prices**, choose the good and direction, then
set **Trading status** to **Not trading this item**. Save to remove that offer;
the previous price remains available when resuming. Buying prices must be at
least 1d. A paused offer rejects deliveries rather than accepting free goods.
Existing zero-price buying offers become paused on upgrade; positive buying
prices below 1d become 1d. Stock, cash and past trades are unchanged.
Shop buttons quote the displayed unit price: if it changes before the server
receives the trade, the transaction is rejected and the shop refreshes for review.

## Default trade prices

`data/buildings.json` contains live default bids and asks. Item catalogue prices
are book values; use a shop's posted quotes to plan a trade.

Automatic producers cover their recipe inputs, the **full ideal crew's gross
wages**, and Puddlewick's default 7% combined sales tax, with at least 25% above
cost in retail receipts. Wage tax comes out of gross wages. Additional workers,
repairs, travel, unsold stock and custom settings can still erase profit.
Farms price crops against seed, harvest wages, irrigation and fertilizer at a
conservative half yield; seasonal failure remains a risk.

Local input bids normally exceed supplier asks by at least 12%. Harbour and
spaceport bids favour finished products; intermediate inputs earn more at local
processors. Imports cost more than local supply. Retailers cover their purchase
bids and sales tax. Hay barns buy seasonal hay from farms and sell to livestock
businesses whose bids also leave a delivery margin.

The waterworks pays **74d for fuel** and sells water at **13.25d**. A full batch
uses one fuel and two 22d wages; twelve water return 147.87d after default tax,
leaving 29.87d before other costs. Hauliers can initially import fuel from the
spaceport for 57.75d; a local refinery sells it for 38.50d. Prices alone do not
move cargo, hire staff or create stock.

**Upgrade:** the crew-price rebalance resets default-type bids, asks and wages
once on **all existing Puddlewick economy buildings, including human and NPC
owned property**, as authorized for the economy repair. Custom templates and
other worlds are excluded. The government necessities shop receives premium
quotes. Ownership, stock, cash and construction progress are preserved. Later
owner edits survive reloads; new worlds start with the new prices.

## Public work and exports

A 15-second Odd Jobs shift normally pays **1d**. Residents below 50d combined cash
and bank savings can receive a larger relief payment once per 30 real minutes.
Relief covers a premium bread-and-water purchase at default prices (currently
150d); the quoted amount is fixed when the task starts. The cooldown survives
reconnection and death. Public labour is a safety net rather than an unlimited
45d-per-shift career.

Every 30 real minutes, Puddlewick's treasury-run Harbour and spaceport sell surplus
cargo to off-world customers. Each departure clears at most 40 units per item,
leaving 8 on the shelf, or a population-based reserve of 12–100 bread, water and
fuel. Only actual cargo earns proceeds. External settlement uses a capped
catalogue bid plus 10%, below import retail prices; editing a port bid cannot
inflate that payment. The ledger records `export shipment` income and quantities.
This explicitly funded export outlet replenishes working capital and frees
storage for local suppliers. It has finite throughput and does not guarantee
demand for every private business. Private ports, custom worlds and the emergency
necessities shop are excluded. Departure cursors persist; downtime catches up
at most 48 departures against stock actually present.

Bank deposits/withdrawals and owner capital transfers accept up to **100,000d**
per action, subject to real balances and protected outside claims. The separate
10,000-item goods limit is a quantity bound, not a 100d purchase cap. Cargo space,
stock and available cash still govern trading.

Owners cannot buy from or sell to their own property, hire themselves, refresh
their own work shifts or start workplace tasks there. Use Stockroom for goods and
Building Admin for funding and withdrawals. Buying your current workplace ends
your employment there; other employees keep their jobs. Owners can still tend
and harvest their own farm plots, but receive no harvest wage.

Production requires input goods, output space and funded wages. Qualified active
employees count toward each building's **ideal crew**. Most workshops, mills,
bakeries and pumps need two; heavy industry needs three; small livestock barns,
composters, tea houses and roasteries need one. The panel shows **active / ideal**,
not just hired employees. In worlds requiring active shifts, expired shifts do not count.

For an ideal crew of two: one worker gives 50%, two 100%, three 67%, four 50%.
The formula is active ÷ ideal below the ideal, and ideal ÷ active above it.
Efficiency controls batch speed, not ingredient quantities or the posted wage.
Partial batches carry forward across checks and saves; wages are paid only when
a whole supplied batch completes. A lone miller therefore normally completes one
batch in two checks. More staff means more wages per completed batch: the fastest
crew is not necessarily the most profitable. Review payroll against sales before hiring. Seasonal farm plots and manual tasks
retain their separate production rules.

With no active crew, private businesses use the world's unattended rate. Public
businesses retain government operation when unattended. Where owner operation is
enabled, a qualified operating owner counts as one unpaid worker toward the ideal.
World creators can set 1–16 ideal employees on custom building templates.
**Puddlewick employment persists**, including offline: no shift renewal is needed. Qualified owners also operate their factories as unpaid workers. These are world settings; a one-time starter-parish update enables them on existing Puddlewick saves without changing property, prices, stock or money. Later creator changes are preserved. Farm wages still require hands-on harvests.

In worlds with active work enabled, **Work two cycles** starts a window lasting two production intervals (usually
20 real minutes). Checks run on fixed world-time boundaries, so the first can be
soon after clicking. The HUD and building panel show the remaining time and checks;
renewal becomes available during the final interval. Early renewal resets the
window from now rather than stacking shifts. Expiration is shown until you renew.

You can drive away or log off during a shift: eligibility depends on the deadline,
not your location or connection. Wages require a successful production batch with
inputs, output space and funded payroll. An eligible check can fail without pay;
the timer does not pause in worlds using shifts. Farms instead pay on funded manual harvest completion.
Worlds with active work disabled need no renewals. Odd Jobs Office labour is a
separate timed task that locks movement. Learn the corresponding profession at school.

Puddlewick's **Government necessities** shop keeps a reserved shelf of bread,
drinking water and fuel and also sells those goods on demand at premium prices
if the shelf is empty. Fuel is posted above every other typical sell quote so
the shop is a last resort, not a cheap pump. The shop belongs to the reserved
public parish (world id `puddlewick`, economy template), including when a
player holds world-owner rights. Purchases pay for the imports; nothing is
free. Local producers are normally cheaper. The harbour keeps finite stock once
the dedicated shop is present.

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

Wheat is frost tolerant and supplies flour/bread. Potatoes are a quick food crop, but
waterlogging makes gravel drainage worthwhile; they supply meals and compost.
Hops need moisture and supply beer. Grapes take eight hours, dislike frost and wet
soil, and supply wine. Tea needs moisture but tolerates cold better than coffee;
both have distinct processing buildings. Coffee takes ten hours and is the most
frost-sensitive crop. See [the farming guide](PLAYING.md#farming) for planting windows.

Hay is a ten-day grass crop for cattle and sheep. Its default route is **farm sells 5d → hay barn buys 5.60d / sells 7d → dairy or sheepfold buys 7.80d**. Harbour/spaceport export bids are 4.50d and import asks 10d, favouring local trade. Hay replaces manufactured feed one-for-one for cows/sheep, including breeding, but never replaces water; pigs/chickens still need feed. All upkeep is charged once per check and recorded as the actual hay/feed consumed.

A hay barn is a 3,000-bale merchant store, not a factory: no recipe, wages or free restocking. Owners fund bids, buy seasonal surplus and keep winter reserves. Storage has no spoilage. Farm expansion buys four more plots at a time (150d, 250d, 350d), up to sixteen; land cost increases property base value, including a later estate. It grants no stock, seed capital or harvesting labour.

Existing saves add only missing hay quotes on ordinary farms and livestock businesses, and public Harbour/spaceport shops. Existing quotes, balances, stock and custom building templates remain unchanged; the necessities shop keeps its limited catalogue.

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

Puddlewick's public Harbour imports small paid shipments of scarce bread, water and fuel every 30 real minutes, counting local stocks first. Bread/water can also be imported on demand at the posted, expensive Harbour retail price, even with empty shelves or no treasury working capital: the buyer's payment funds that delivery. There are no free player supplies. Where Government necessities exists, on-demand imports move there. This fallback applies to Puddlewick’s economy template and treasury-run outlets regardless of world-owner identity, and refuses quotes that undercut catalogue prices or enable guaranteed re-export to a public buyer. Private shops and prices are untouched.

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

## Business health (0.78.0)

Private statements distinguish operating cash flow from owner capital and bank
lending flows. Input coverage, output room and replacement-batch funding identify
bottlenecks. Cash runway extrapolates the recorded cash-loss rate; sales/hour uses
recorded history. Neither predicts demand. Stored goods use catalogue reference
values, not guaranteed proceeds. NPC owners see the same diagnosis; closed bids
use catalogue estimates rather than pretending free inputs are available.

## Optional property contracts (0.78.0)

Caretakers enable leases and auctions in **World rules**; both default off. They
apply to completed commercial properties without mortgages or outside stakes,
excluding homes, lodging, banks, government property and supply caches.

- **Operating lease:** the owner posts total prepaid rent and a 1–168 hour term.
  The accepting operator pays rent plus a refundable bond equal to the current
  catalogue value of stock and working cash. The landlord keeps title; the
  operator manages prices, goods, employees and the till. At expiry, surrender
  or either participant's death, operation returns to the landlord. Reduced
  starting equity is charged against the bond, capped at the bond; the remainder
  returns to the operator. Rent is non-refundable, and extra capital is not
  guaranteed to be returned. After death, ordinary world estate rules still apply.
- **Auction:** the owner sets a fixed 1–168 hour deadline and minimum. Bidders
  must fund their full bid; outbidding refunds the previous bidder. There is no
  early cancellation. The seller cannot strip stock or capital during the sale,
  although ordinary production/trading continues and equity can change. Closing
  transfers title and escrow once; failed ownership-limit checks refund the bid.
  Seller death cancels/refunds; bidder death refunds their bid.
- **Destruction:** outstanding auction escrow is refunded. Lease bonds settle
  against destroyed assets before the building is removed. This is not insurance
  for the building itself. Contract money cannot be settled twice after restart.

Existing contracts settle even if new contracts are subsequently disabled.
Maintenance freezes their world-time deadlines. Cross-host visits do not transfer
these properties, contracts or sponsor escrow into another host's economy.
