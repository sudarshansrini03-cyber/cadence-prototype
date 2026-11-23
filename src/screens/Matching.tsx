import { useState } from 'react';
import { Button, Card, Chip, useToast } from '../components/ui';
import { balance } from '../lib/matching';
import { inr } from '../lib/format';
import { useStore } from '../lib/store';
import type { Payment } from '../types';
import { matchPaymentWithAI, type AIMatchResponse } from '../lib/ai';

function Review({ p }: { p: Payment }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const shops = [...new Set(state.invoices.filter((i) => balance(i) > 0).map((i) => i.shop))];
  const [shop, setShop] = useState(p.shop ?? '');
  const bills = state.invoices.filter((i) => i.shop === shop && balance(i) > 0).sort((a, b) => a.due.localeCompare(b.due));
  const [inv, setInv] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIMatchResponse['result'] | null>(null);

  const chosen = bills.some((b) => b.no === inv) ? inv : bills[0]?.no ?? '';

  const handleAskGroq = async () => {
    setAiLoading(true);
    const activeModel = localStorage.getItem('cadence_ai_model') || 'openai/gpt-oss-120b';
    const res = await matchPaymentWithAI({
      payment: { ref: p.ref, payer: p.payer, amount: p.amount, time: p.time },
      openInvoices: state.invoices.filter((i) => balance(i) > 0),
      model: activeModel,
    });
    setAiLoading(false);

    if (res && res.success && res.result) {
      setAiResult(res.result);
      if (res.result.matchedShop && shops.includes(res.result.matchedShop)) {
        setShop(res.result.matchedShop);
        if (res.result.matchedInvoiceNo) {
          setInv(res.result.matchedInvoiceNo);
        }
      }
      toast(`✨ Groq analyzed payment in ${res.durationMs}ms`);
    } else {
      toast('Could not connect to Groq backend.');
    }
  };

  const handleConfirm = () => {
    if (!shop || !chosen) return;
    dispatch({ t: 'confirm', id: p.id, shop, invoice: chosen });
    toast(`Payment matched to ${shop} (Bill ${chosen}). Outstanding updated ✓`);
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-navy/60">Manual or AI Selection:</span>
        <button
          onClick={handleAskGroq}
          disabled={aiLoading}
          className="text-xs bg-gold text-navy font-semibold px-2.5 py-1 rounded-lg hover:bg-gold/90 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          {aiLoading ? '⚡ Analyzing…' : '✨ Ask Groq AI'}
        </button>
      </div>

      {aiResult && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-900">Groq Recommendation:</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold text-[10px]">
              {aiResult.confidence}% Confidence
            </span>
          </div>
          <p className="text-amber-800">{aiResult.reasoning}</p>
        </div>
      )}

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
