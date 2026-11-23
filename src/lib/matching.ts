import type { Invoice } from '../types';

const GENERIC = new Set(['stores', 'store', 'traders', 'trader', 'trdrs', 'agencies', 'agency', 'provisions', 'mart', 'sri', 'shri', 'the', 'ms', 'and', 'enterprises', 'kirana', 'general', 'supermarket', 'co', 'company']);

export const balance = (i: Invoice) => i.amount - i.paid;

export function tokens(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !GENERIC.has(t));
}

/** True when the payer name and the shop name share a meaningful word. */
export function nameMatches(payer: string, shop: string): boolean {
  const a = tokens(payer), b = tokens(shop);
  return a.some((x) => b.some((y) => x === y || (x.length >= 4 && y.length >= 4 && x.slice(0, 4) === y.slice(0, 4))));
}

export interface MatchResult { kind: 'exact' | 'name' | 'review'; shop?: string; invoices: string[]; reason: string }

/**
 * Rules, in order:
 *  (a) the amount equals the balance of exactly ONE open bill -> auto-match
 *  (b) the payer name resembles a shop and the amount equals the sum of that shop's oldest bills -> auto-match
 *  (c) anything else -> a person decides
 */
export function autoMatch(payment: { payer: string; amount: number }, invoices: Invoice[]): MatchResult {
  const open = invoices.filter((i) => balance(i) > 0);
  const exact = open.filter((i) => balance(i) === payment.amount);
  if (exact.length === 1) {
    return { kind: 'exact', shop: exact[0].shop, invoices: [exact[0].no], reason: `Amount equals bill ${exact[0].no} exactly` };
  }
  const shops = [...new Set(open.map((i) => i.shop))].filter((s) => nameMatches(payment.payer, s));
  for (const shop of shops) {
    const list = open.filter((i) => i.shop === shop).sort((a, b) => a.due.localeCompare(b.due));
    let sum = 0;
    const used: string[] = [];
    for (const inv of list) {
      sum += balance(inv); used.push(inv.no);
      if (sum === payment.amount) return { kind: 'name', shop, invoices: used, reason: `Name resembles ${shop}; amount equals its oldest ${used.length === 1 ? 'bill' : used.length + ' bills'}` };
    }
  }
  if (exact.length > 1) return { kind: 'review', invoices: [], reason: 'Several bills have this amount' };
  if (shops.length) return { kind: 'review', shop: shops[0], invoices: [], reason: `Name resembles ${shops[0]}, but the amount fits no bill` };
  return { kind: 'review', invoices: [], reason: 'No bill matches this amount or name' };
}

/** Apply an amount to a shop's bills, oldest first (optionally starting with a chosen bill). */
export function allocate(invoices: Invoice[], shop: string, amount: number, firstNo?: string): { invoices: Invoice[]; applied: string[] } {
  const order = invoices.filter((i) => i.shop === shop && balance(i) > 0).sort((a, b) => a.due.localeCompare(b.due)).map((i) => i.no);
  if (firstNo && order.includes(firstNo)) order.splice(order.indexOf(firstNo), 1), order.unshift(firstNo);
  let left = amount;
  const applied: string[] = [];
  const next = invoices.map((i) => ({ ...i }));
  for (const no of order) {
    if (left <= 0) break;
    const inv = next.find((i) => i.no === no && i.shop === shop)!;
    const pay = Math.min(left, balance(inv));
    inv.paid += pay; left -= pay; applied.push(no);
  }
  return { invoices: next, applied };
}
