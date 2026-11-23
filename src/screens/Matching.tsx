import { useState } from 'react';
import { Button, Card, Chip, useToast } from '../components/ui';
import { balance } from '../lib/matching';
import { inr } from '../lib/format';
import { useStore } from '../lib/store';
import type { Payment } from '../types';

function Review({ p }: { p: Payment }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const shops = [...new Set(state.invoices.filter((i) => balance(i) > 0).map((i) => i.shop))];
  const [shop, setShop] = useState(p.shop ?? '');
  const bills = state.invoices.filter((i) => i.shop === shop && balance(i) > 0).sort((a, b) => a.due.localeCompare(b.due));
  const [inv, setInv] = useState('');
  const chosen = bills.some((b) => b.no === inv) ? inv : bills[0]?.no ?? '';

  const handleConfirm = () => {
    if (!shop || !chosen) return;
    dispatch({ t: 'confirm', id: p.id, shop, invoice: chosen });
    toast(`Payment matched to ${shop} (Bill ${chosen}). Outstanding updated ✓`);
  };

  return (
    <div className="mt-3 space-y-2">
      <select value={shop} onChange={(e) => setShop(e.target.value)} className="w-full rounded-xl border border-navy/30 px-3 py-2 text-sm" aria-label="Shop for this payment">
        <option value="">Pick a shop</option>{shops.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select value={chosen} onChange={(e) => setInv(e.target.value)} disabled={!shop} className="w-full rounded-xl border border-navy/30 px-3 py-2 text-sm" aria-label="Bill">
        {bills.map((b) => <option key={b.no} value={b.no}>Bill {b.no} &middot; {inr(balance(b))} due</option>)}
      </select>
      <Button kind="gold" disabled={!shop || !chosen} onClick={handleConfirm}>Confirm match</Button>
    </div>
  );
}

export default function Matching() {
  const { state, dispatch } = useStore();
  const pending = state.payments.filter((p) => p.state === 'pending').length;
  const review = state.payments.filter((p) => p.state === 'review').length;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div><h2 className="text-xl font-bold">Incoming payments</h2><p className="text-sm text-navy/60">{pending} waiting &middot; {review} need a person</p></div>
        <Button disabled={!pending} onClick={() => dispatch({ t: 'runMatch' })}>Run auto-match</Button>
      </div>
      {state.payments.map((p) => (
        <Card key={p.id}>
          <div className="flex items-start justify-between gap-2">
            <div><p className="font-semibold">{p.payer}</p><p className="text-xs text-navy/50">{p.ref} &middot; {p.time}</p></div>
            <div className="text-right"><p className="font-bold">{inr(p.amount)}</p>
              {p.state === 'pending' && <Chip text="Waiting" />}
              {(p.state === 'matched' || p.state === 'confirmed') && <Chip text="Matched" />}
              {p.state === 'review' && <Chip text="Needs a person" />}
            </div>
          </div>
          {(p.state === 'matched' || p.state === 'confirmed') && <p className="mt-2 text-sm text-navy/70">{p.shop} &middot; bill {p.invoices?.join(', ')}<br /><span className="text-xs text-navy/50">{p.how}</span></p>}
          {p.state === 'review' && (<><p className="mt-2 text-sm text-red-800">{p.how}</p><Review p={p} /></>)}
        </Card>
      ))}
      {state.payments.length === 0 && <Card><p className="text-sm">No payments yet. Use the Shop tab to simulate one.</p></Card>}
    </div>
  );
}
