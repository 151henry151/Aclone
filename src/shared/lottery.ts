// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from './types.ts';
import { log } from './simulation.ts';
import { say } from './messages.ts';
export const LOTTERY_YEAR = 600 * 365;
export interface Lottery {
  pot: number;
  price: number;
  drawAt: number;
  round: number;
  tickets: Record<string, number>;
  history: { round: number; time: number; winner?: string; amount: number; tickets: number }[];
}
function state(w: World): Lottery {
  return (w.lottery ??= {
    pot: 0,
    price: w.settings.lotteryTicketPrice,
    drawAt: (Math.floor(w.time / LOTTERY_YEAR) + 1) * LOTTERY_YEAR,
    round: 1,
    tickets: {},
    history: [],
  });
}
export function tickLottery(
  w: World,
  random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
) {
  if (!w.lottery && !w.settings.lotteryEnabled) return;
  const l = state(w);
  if (w.time < l.drawAt) return;
  const entries = Object.entries(l.tickets).filter(([id]) => w.players[id]),
    total = entries.reduce((n, [, q]) => n + q, 0);
  let winner: string | undefined;
  if (total) {
    let roll = Math.floor(random() * total);
    for (const [id, count] of entries) {
      roll -= count;
      if (roll < 0) {
        winner = id;
        break;
      }
    }
  }
  const amount = winner ? l.pot : 0;
  if (winner) {
    w.players[winner].cash += amount;
    log(w, 'transfer', amount, 'lottery', winner, 'Annual lottery prize');
    l.pot = 0;
    say(
      w,
      'Lottery',
      `${w.players[winner].name} won ${(amount / 100).toFixed(2)}d in round ${l.round}.`,
    );
  } else
    say(
      w,
      'Lottery',
      `Round ${l.round}: no tickets; the ${(l.pot / 100).toFixed(2)}d jackpot carries forward.`,
    );
  l.history.push({ round: l.round, time: l.drawAt, winner, amount, tickets: total });
  l.history = l.history.slice(-12);
  l.tickets = {};
  l.round++;
  l.price = w.settings.lotteryTicketPrice;
  l.drawAt += (Math.floor((w.time - l.drawAt) / LOTTERY_YEAR) + 1) * LOTTERY_YEAR;
}
export function lotteryAction(w: World, p: Player, a: Action) {
  if (!w.settings.lotteryEnabled) throw Error('This world has no lottery');
  const operation = String(a.operation);
  if (!['tickets', 'fund'].includes(operation)) throw Error('Choose tickets or fund jackpot');
  const amount = Number(a.amount);
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > (operation === 'tickets' ? 100 : 100000000)
  )
    throw Error('Invalid lottery amount');
  tickLottery(w);
  const l = state(w),
    count = Object.values(l.tickets).reduce((sum, n) => sum + n, 0),
    cost = operation === 'tickets' ? amount * l.price : amount;
  if (operation === 'tickets' && ((l.tickets[p.id] ?? 0) + amount > 100 || count + amount > 10000))
    throw Error('Maximum 100 tickets per player and 10,000 per draw');
  if (p.cash < cost) throw Error('Not enough cash');
  if (l.pot + cost > 10000000000) throw Error('Jackpot limit reached');
  p.cash -= cost;
  l.pot += cost;
  if (operation === 'tickets') l.tickets[p.id] = (l.tickets[p.id] ?? 0) + amount;
  log(
    w,
    'transfer',
    cost,
    p.id,
    'lottery',
    operation === 'tickets' ? 'Lottery tickets' : 'Lottery jackpot contribution',
  );
  return operation === 'tickets' ? 'Tickets entered.' : 'Jackpot contribution received.';
}
