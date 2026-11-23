import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Chip, TiltCard, useToast } from '../components/ui';
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
        <span className="text-xs text-slate-400">Manual or AI Selection:</span>
        <button
          onClick={handleAskGroq}
          disabled={aiLoading}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 py-1 text-xs font-semibold text-obsidian-900 transition-colors hover:from-amber-200 hover:to-amber-400 disabled:opacity-50"
        >
          {aiLoading ? '⚡ Analyzing…' : '✨ Ask Groq AI'}
        </button>
      </div>

      {aiResult && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-1 rounded-xl border border-amber-400/30 bg-amber-500/10 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-300">Groq Recommendation:</span>
            <span className="rounded border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
              {aiResult.confidence}% Confidence
            </span>
          </div>
          <p className="text-amber-100/90">{aiResult.reasoning}</p>
        </motion.div>
      )}

      <select value={shop} onChange={(e) => setShop(e.target.value)} className="w-full rounded-xl border border-white/15 bg-obsidian-700 px-3 py-2 text-sm text-white" aria-label="Shop for this payment">
        <option value="">Pick a shop</option>{shops.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select value={chosen} onChange={(e) => setInv(e.target.value)} disabled={!shop} className="w-full rounded-xl border border-white/15 bg-obsidian-700 px-3 py-2 text-sm text-white" aria-label="Bill">
        {bills.map((b) => <option key={b.no} value={b.no}>Bill {b.no} &middot; {inr(balance(b))} due</option>)}
      </select>
      <Button kind="gold" disabled={!shop || !chosen} onClick={handleConfirm}>Confirm match</Button>
    </div>
  );
}

const STATE_BADGE: Record<Payment['state'], { text: string; cls: string }> = {
  pending: { text: 'Waiting', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
  matched: { text: 'Matched', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  confirmed: { text: 'Matched', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  review: { text: 'Needs a person', cls: 'bg-red-500/15 text-red-300 border-red-400/30' },
};

export default function Matching() {
  const { state, dispatch } = useStore();
  const pending = state.payments.filter((p) => p.state === 'pending').length;
  const review = state.payments.filter((p) => p.state === 'review').length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-display text-xl font-bold text-white">Incoming payments</h2><p className="text-sm text-slate-400">{pending} waiting &middot; {review} need a person</p></div>
        <Button disabled={!pending} onClick={() => dispatch({ t: 'runMatch' })}>Run auto-match</Button>
      </div>
      {state.payments.map((p, k) => {
        const badge = STATE_BADGE[p.state];
        return (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.04 }}>
            <TiltCard className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold text-white">{p.payer}</p><p className="text-xs text-slate-500">{p.ref} &middot; {p.time}</p></div>
                <div className="text-right">
                  <p className="font-display font-bold text-white">{inr(p.amount)}</p>
                  <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
                </div>
              </div>
              {(p.state === 'matched' || p.state === 'confirmed') && <p className="mt-2 text-sm text-slate-300">{p.shop} &middot; bill {p.invoices?.join(', ')}<br /><span className="text-xs text-slate-500">{p.how}</span></p>}
              {p.state === 'review' && (<><p className="mt-2 text-sm text-red-300">{p.how}</p><Review p={p} /></>)}
            </TiltCard>
          </motion.div>
        );
      })}
      {state.payments.length === 0 && <Card><p className="text-sm text-slate-400">No payments yet. Use the Shop tab to simulate one.</p></Card>}
    </div>
  );
}
