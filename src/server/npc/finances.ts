// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { cashFlow, recentOperatingCash } from '../../shared/reports.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
import { businessEconomics } from '../../shared/business-economics.ts';
import { money } from '../../shared/simulation.ts';
import { inputStockTarget, retainedCapital } from './business-policy.ts';
import type { ResidentState } from './memory.ts';

export const financeRules = `Use finances as the authoritative money explanation. Till cash (labelled investment in the UI) is spendable money, NOT the value of stock, property, or lifetime deposits. Inventory value is separate and cannot pay wages until sold. Lifetime operating cash flow includes past material purchases; a negative total does not prove today's production loses money or that the till is empty. Recent cash flow is not accrual profit either: selling previously bought stock can inflate it. Estimated margins assume outputs sell and inputs can be replaced at quoted prices; missing observations are unknown, not zero. Money fields named denarii or ending Denarii are already d; never divide them again. Display strings use this world's currency conversion. A supplier's SELL is your purchase cost; your BUY is what a haulier receives. Haulier margin = your buy price minus supplier sell price, before fuel/time. Bidding 1d BELOW the supplier's selling price loses the haulier 1d; it does not reward transport. Paused purchases may be intentional overstock control; explain the live stock/target and prioritise selling output rather than promising to buy more. Safe owner surplus is not profit, but can finance other opportunities while keeping payroll, input reserves and investor claims.`;

/** Caller supplies perceivedWorld: own accounts are live; competitors are only observed quotes. */
export function financialBriefing(w: World, p: Player, state: ResidentState) {
  const amount = (value: number) => ({
    denarii: value / 100,
    display: money(value, w.settings.exchangeRate),
  });
  return {
    currency: { internalUnitsPerDenarius: 100, denariiPerShekel: w.settings.exchangeRate },
    personal: { cash: amount(p.cash), savings: amount(p.bank) },
    businesses: w.buildings
      .filter((b) => b.owner === p.id && !b.government)
      .map((b) => {
        const reserve = retainedCapital(w, b),
          claims = remainingClaim(b);
        const safe = b.construction
          ? 0
          : Math.max(0, Math.min(ownerWithdrawable(w, b), b.investment - claims - reserve));
        const recent = recentOperatingCash(w, b);
        const economics = businessEconomics(w, b);
        const inputs = (b.production ?? recipes[b.recipe ?? ''])?.inputs ?? {};
        const purchasing = [
          ...new Set([
            ...Object.keys(inputs),
            ...Object.keys(b.buy),
            ...Object.keys(b.pausedPrices?.buy ?? {}),
          ]),
        ].map((item) => {
          const target = inputStockTarget(b, item);
          const bid = b.buy[item];
          const remembered =
            state.pausedInputBids?.world === w.id && state.pausedInputBids.deaths === p.deaths
              ? state.pausedInputBids.bids[`${b.id}:${item}`]
              : undefined;
          const supplier = w.buildings
            .filter(
              (s) =>
                s.id !== b.id &&
                s.owner !== p.id &&
                !s.construction &&
                s.sell[item] !== undefined &&
                s.stock[item] > 0,
            )
            .sort((a, c) => a.sell[item] - c.sell[item])[0];
          return {
            item,
            held: b.stock[item] ?? 0,
            target: target ?? null,
            acceptingDeliveries: bid !== undefined,
            buyPriceDenarii: bid === undefined ? null : bid / 100,
            savedBuyPriceDenarii: (remembered || b.pausedPrices?.buy?.[item] || 0) / 100,
            policy:
              state.pausedInputBids?.world === w.id &&
              state.pausedInputBids.deaths === p.deaths &&
              state.pausedInputBids.manual?.[`${b.id}:${item}`]
                ? 'Explicitly paused by agreement; automatic replenishment will not reopen this bid.'
                : target === undefined
                  ? 'No automatic recipe-buffer target.'
                  : (b.stock[item] ?? 0) >= target
                    ? 'Enough input or finished output for the six-batch buffer; pause purchasing and find output buyers.'
                    : 'Below target; a paused bid can reopen below half target if replacement production is viable.',
            observedSupplier: supplier
              ? {
                  building: supplier.id,
                  name: supplier.name,
                  sellPriceDenarii: supplier.sell[item] / 100,
                  haulierMarginDenarii:
                    bid === undefined ? null : (bid - supplier.sell[item]) / 100,
                  basis:
                    'Last observed stocked seller, not a guaranteed current quote. Recheck before trading.',
                }
              : null,
          };
        });
        const observedCosts = economics?.inputCosts.map((i) => {
          const supplier = purchasing.find((q) => q.item === i.item)?.observedSupplier;
          return {
            item: i.item,
            quantity: i.quantity,
            price: supplier ? supplier.sellPriceDenarii * 100 : null,
          };
        });
        const observedMargin =
          economics && observedCosts?.every((i) => i.price !== null)
            ? (economics.revenue -
                economics.current.payroll -
                observedCosts.reduce((n, i) => n + i.quantity * i.price!, 0)) /
              100
            : null;
        return {
          building: b.id,
          name: b.name,
          tillCash: amount(b.investment),
          investorClaims: amount(claims),
          operatingReserve: amount(reserve),
          safelyWithdrawable: amount(safe),
          stockCatalogueValueDenarii:
            Object.entries(b.stock).reduce(
              (n, [id, q]) => n + q * (worldItems(w)[id]?.price ?? 0),
              0,
            ) / 100,
          lifetimeOperatingCashFlowDenarii: b.accounts ? cashFlow(b.accounts) / 100 : null,
          accountsSince: b.accounts?.since ?? null,
          recentOperatingCashFlow: recent
            ? {
                from: recent.from,
                until: recent.until,
                observedHours: recent.observedSeconds / 3600,
                netDenarii: recent.amount / 100,
              }
            : null,
          estimatedBatch: economics
            ? {
                paidWorkers: economics.current.paidWorkers,
                ownerWorksUnpaid: economics.current.ownerOperating,
                payrollDenarii: economics.current.payroll / 100,
                marginAtOwnBidsOrFallbackDenarii: economics.current.margin / 100,
                marginBuyingAtObservedSuppliersDenarii: observedMargin,
                basis: economics.basis,
              }
            : null,
          purchasing,
        };
      }),
  };
}
