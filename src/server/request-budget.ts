// SPDX-License-Identifier: GPL-3.0-or-later
/** Actions have their own allowance. A burst of delayed steering/ACK packets must
 * not spend the purchase/chat budget or produce an error response per packet. */
export class ActionBudget {
  private tokens = 20;
  private at = Date.now();
  allow(now: number) {
    this.tokens = Math.min(20, this.tokens + Math.max(0, now - this.at) / 100);
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}
