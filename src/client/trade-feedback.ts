// SPDX-License-Identifier: GPL-3.0-or-later
import { money } from '../shared/simulation';
export interface TradeReceipt {
  world: string;
  building: string;
  item: string;
  name: string;
  direction: 'buy' | 'sell';
  quantity: number;
  total: number;
  denariiPerSheckle: number;
}
/** Totals confirmed receipts only. Each visit and consecutive item/direction is separate. */
export class TradeFeedback {
  private key = '';
  private quantity = 0;
  private total = 0;
  summary = '';
  add(receipt: TradeReceipt, visit: number) {
    const key = JSON.stringify([
      visit,
      receipt.world,
      receipt.building,
      receipt.item,
      receipt.direction,
    ]);
    if (key !== this.key) {
      this.key = key;
      this.quantity = this.total = 0;
    }
    this.quantity += receipt.quantity;
    this.total += receipt.total;
    this.summary = `${receipt.direction === 'buy' ? 'Bought' : 'Sold'} ${this.quantity} ${receipt.name} for ${money(this.total, receipt.denariiPerSheckle)} in total.`;
    return this.summary;
  }
  clear() {
    this.key = '';
    this.quantity = this.total = 0;
    this.summary = '';
  }
}
