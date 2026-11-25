import { createContext, ReactNode, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Invoice, Lang, Payment, State } from '../types';
import { initialState } from '../data/sample';
import { allocate, autoMatch, balance } from './matching';
import { daysOverdue, fmtDate, inr } from './format';

export type Action =
  | { t: 'reset' }
  | { t: 'import'; invoices: State['invoices'] }
  | { t: 'lang'; lang: Lang }
  | { t: 'selectShop'; shop: string }
  | { t: 'remind'; shop: string }
  | { t: 'promise'; shop: string; date: string }
  | { t: 'call'; shop: string }
  | { t: 'cash'; shop: string; amount: number }
  | { t: 'runMatch'; only?: string }
  | { t: 'pay'; shop: string; amount: number }
  | { t: 'confirm'; id: string; shop: string; invoice: string }
  | { t: 'addInvoice'; invoice: Invoice };

const KEY = 'cadence-prototype-v2';

function settle(s: State, shopName: string, status?: string): State {
  const left = s.invoices.filter((x) => x.shop === shopName).reduce((a, x) => a + balance(x), 0);
  return {
    ...s,
    shops: s.shops.map((sh) => (sh.name === shopName
      ? { ...sh, askedCall: false, promised: undefined, status: left <= 0 ? 'Paid up' : status ?? 'Payment received' }
      : sh)),
  };
}

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'reset': return initialState();
    case 'import': {
      const names = [...new Set(a.invoices.map((x) => x.shop))];
      return { ...s, invoices: a.invoices, shops: names.map((name) => ({ name, status: 'Not contacted' })), payments: [] };
    }
    case 'lang': return { ...s, lang: a.lang };
    case 'selectShop': return { ...s, selectedShop: a.shop };
    case 'remind': return { ...s, selectedShop: a.shop, shops: s.shops.map((x) => (x.name === a.shop ? { ...x, reminded: true, status: 'Reminder sent' } : x)) };
    case 'promise': return { ...s, shops: s.shops.map((x) => (x.name === a.shop ? { ...x, promised: a.date, askedCall: false, status: `Promised ${fmtDate(a.date)}` } : x)) };
    case 'call': return { ...s, shops: s.shops.map((x) => (x.name === a.shop ? { ...x, askedCall: true, status: 'Asked for a call' } : x)) };
    case 'cash': {
      const r = allocate(s.invoices, a.shop, a.amount);
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      const pay: Payment = { id: 'c' + Date.now(), ref: 'CASH', payer: a.shop + ' (cash)', amount: a.amount, time: timeStr, state: 'confirmed', shop: a.shop, invoices: r.applied, how: 'Logged by accountant' };
      return settle({ ...s, invoices: r.invoices, payments: [pay, ...s.payments] }, a.shop);
    }
    case 'runMatch': {
      let cur = s;
      for (const p of s.payments.filter((x) => x.state === 'pending' && (!a.only || x.id === a.only))) {
        const m = autoMatch(p, cur.invoices);
        if (m.kind === 'review') {
          cur = { ...cur, payments: cur.payments.map((x) => (x.id === p.id ? { ...x, state: 'review', shop: m.shop, how: m.reason } : x)) };
        } else {
          const r = allocate(cur.invoices, m.shop!, p.amount, m.invoices[0]);
          cur = settle({ ...cur, invoices: r.invoices, payments: cur.payments.map((x) => (x.id === p.id ? { ...x, state: 'matched', shop: m.shop, invoices: r.applied, how: m.reason } : x)) }, m.shop!);
        }
      }
      return cur;
    }
    case 'addInvoice': {
      const exists = s.invoices.some((x) => x.no === a.invoice.no);
      const invoices = exists
        ? s.invoices.map((x) => (x.no === a.invoice.no ? { ...x, amount: a.invoice.amount, due: a.invoice.due, shop: a.invoice.shop } : x))
        : [...s.invoices, a.invoice];
      const shops = s.shops.some((sh) => sh.name === a.invoice.shop) ? s.shops : [...s.shops, { name: a.invoice.shop, status: 'Not contacted' }];
      return { ...s, invoices, shops };
    }
    case 'pay': {
      const id = 'u' + Date.now();
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      const p: Payment = { id, ref: 'UPI' + Math.floor(1e9 + Math.random() * 9e9), payer: a.shop, amount: a.amount, time: timeStr, state: 'pending' };
      return reducer({ ...s, payments: [p, ...s.payments] }, { t: 'runMatch', only: id });
    }
    case 'confirm': {
      const p = s.payments.find((x) => x.id === a.id);
      if (!p) return s;
      const r = allocate(s.invoices, a.shop, p.amount, a.invoice);
      const left = s.invoices.filter((x) => x.shop === a.shop).reduce((q, x) => q + balance(x), 0) - p.amount;
      return settle({ ...s, invoices: r.invoices, payments: s.payments.map((x) => (x.id === a.id ? { ...x, state: 'confirmed', shop: a.shop, invoices: r.applied, how: 'Confirmed by a person' } : x)) }, a.shop, left > 0 ? `Part-paid ${inr(p.amount)}` : undefined);
    }
  }
}

function load(): State {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as State; } catch { /* ignore */ }
  return initialState();
}

interface Ctx { state: State; dispatch: (a: Action) => void }
const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);
  const v = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={v}>{children}</StoreCtx.Provider>;
}

/** Derived helpers used by several screens */
export function shopSummary(state: State) {
  return state.shops.map((sh) => {
    const open = state.invoices.filter((i) => i.shop === sh.name && balance(i) > 0).sort((a, b) => a.due.localeCompare(b.due));
    const outstanding = open.reduce((a, i) => a + balance(i), 0);
    const days = open.length ? Math.max(0, ...open.map((i) => daysOverdue(i.due))) : 0;
    return { shop: sh, open, outstanding, days };
  });
}

/** Call-first order: "please call me" first, then most overdue, shops that promised a date last. */
export function ranked(state: State) {
  const today = '2026-11-23';
  const rank = (x: ReturnType<typeof shopSummary>[number]) => (x.shop.askedCall ? 0 : x.shop.promised && x.shop.promised >= today ? 2 : 1);
  return shopSummary(state).filter((x) => x.outstanding > 0)
    .sort((a, b) => rank(a) - rank(b) || b.days - a.days || b.outstanding - a.outstanding);
}
