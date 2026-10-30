# Coastal Belle charter boat

A purpose-built passenger angling boat, separate from the canal carrier and commercial
trawler. Its flared hull and open aft deck suit six people fishing over the rails.
The skipper has an enclosed wheelhouse, varnished wheel and throttle, live compass,
speed/fuel gauges, VHF/chart textures, and warm/red interior lighting. Navigation
lights use powered-vessel sectors, not restricted trawling signals. Deck lamps,
fenders, bait sink, cooler, rod racks and roof liferaft provide recognisable detail
without increasing world lighting per passenger.

The design is inspired by Cape May day trips: [Miss Chris Fishing](https://capemayfisherman.com/)
and [Tara Anne trips](https://www.taraannesportfishing.com/trips). Navigation sectors
follow the [US Coast Guard navigation rules](https://navcen.uscg.gov/navigation-rules-amalgamated).
Game prices, seats and durations are balancing choices, not real-world operating claims.

## Taking a trip

Buy and board at a boatyard, or board an owned boat at a fishing pier. The captain
opens Inventory → Boating and offers a named player waiting on shore a total fare
and 15–180 real-minute duration, including travel. Each player explicitly accepts.
There are six passenger places, shared with any unpaid rescue passengers.

Bring Fishing tackle, food, water and inventory space. Food consumption follows the
world's ordinary inventory/shelter rules; charter tickets do not include communal
provisions. Passengers cast their own rods when stopped and retain their own fish.
Moving the boat cancels outstanding lines. Ordinary coastal/deep-water catch rules,
bite windows, fishing-mode settings and carrying limits apply. H scenery view keeps
the compact Reel/Stop control. The captain can fish too while stopped.

W/S sets a persistent throttle through forward, idle and slow reverse; A/D steers;
B idles. Lights opens cabin/deck/searchlight switches. The skipper must actually
bring everyone back to a dock. Passengers cannot teleport ashore. At the agreed
end time, both parties receive a notice; a passenger can also request return.
There is no automatic overtime charge.

## Fair payment and recovery

The fare is deducted on acceptance into saved escrow, not paid straight to the
captain. Time begins outside the dock area and stops on first return to a stopped
dock. Returning early pays the captain the elapsed fraction of the promised
trip; the unused fraction is refunded. Waiting at the departure dock earns nothing.
The captain can finish the trip for everyone or passengers can settle individually
with Step ashore. Cancelling, or returning to a different dock, refunds the full fare.
Replaying an acceptance or settlement cannot create another charge or refund.

A passenger death refunds that passenger's booking; captain death refunds all.
The world's existing death rules still govern boats and inventories, and existing
lifeboat/rescue mechanics handle survivors. Disconnecting preserves a booking;
it does not teleport passengers ashore or stop the world clock and survival needs.
A captain should not promise a trip they cannot complete.

## Balance assumptions

- Purchase: 120s versus 60s for the canal boat and 300s for the trawler.
- Cruise limit: 8 m/s (about 18 mph), with no boost. Tank: 192 units; captain cargo: 600 weight.
- At the public boatyard's 45d per 8-unit Fuel quote, filling an empty tank costs
  10.8s. Full cruise consumes 86.4 units/hour before maintenance effects; a full
  tank permits roughly 2h 13m of continuous cruising. Stopped angling does not burn
  cruising fuel. Pricing and fuel/item yields may differ in edited worlds.
- The suggested invitation is 75d per guest for a one-hour trip. Six guests pay
  4.5s gross. Thirty minutes cruising consumes about 2.43s of fuel at that quote,
  leaving about 2.07s before maintenance, provisions and the boat purchase.
  Two guests would not cover that fuel bill. This is a player-funded service,
  not guaranteed passive income.
- Deep-water rod catches use existing probabilities and values. A good catch can
  repay a passenger's fare; travel, missed bites, local buyers and chance matter.
  Charter passengers receive no catch multiplier or trawling privileges.

Slot 31 appends to the catalogue without changing saved vehicle IDs. The usual
world vehicle tuning, fishing rules, licences and boat-loss/recovery settings apply.
Escrow and individual tickets survive database saves. The detailed vehicle editor
remains separate future work.
