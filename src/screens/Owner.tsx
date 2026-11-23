import { motion } from 'framer-motion';
import AgingLedger3D from '../components/AgingLedger3D';
import { Card, Chip } from '../components/ui';
import { balance } from '../lib/matching';
import { COLLECTED_BASE, OTHER_CUSTOMERS } from '../data/sample';
import { daysOverdue, inr, lakh } from '../lib/format';
import { ranked, useStore } from '../lib/store';

export default function Owner() {
  const { state } = useStore();
  const buckets = [...OTHER_CUSTOMERS];
  for (const i of state.invoices) {
    const b = balance(i); if (b <= 0) continue;
    const d = daysOverdue(i.due);
    buckets[d <= 30 ? 0 : d <= 60 ? 1 : 2] += b;
  }
  const total = buckets.reduce((a, b) => a + b, 0);
  const collected = COLLECTED_BASE + state.payments.filter((p) => p.state === 'matched' || p.state === 'confirmed').reduce((a, p) => a + p.amount, 0);
  const top = ranked(state).slice(0, 3);
  const ledger = [
    { label: '0–30 days', amount: buckets[0], color: '#10B981', emissive: '#065F46' },
    { label: '31–60 days', amount: buckets[1], color: '#F59E0B', emissive: '#92400E' },
    { label: '60+ days', amount: buckets[2], color: '#EF4444', emissive: '#7F1D1D' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass glow-emerald rounded-2xl p-5 lg:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">Outstanding now</p>
              <p className="mt-1 font-display text-4xl font-bold text-white">{lakh(total)}</p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-400/25">Live book</span>
          </div>
          <AgingLedger3D buckets={ledger} />
          <p className="text-center text-xs text-slate-500">Drag to rotate &middot; hover a pillar for the exact amount &middot; includes other demo customers</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass glow-cyan rounded-2xl p-5 lg:col-span-2 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">Collected today</p>
            <p className="mt-1 font-display text-4xl font-bold text-cyan-200">{lakh(collected)}</p>
          </div>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/8">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (collected / (collected + total)) * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">Share of book collected against today&apos;s outstanding</p>
        </motion.div>
      </div>

      <Card>
        <p className="mb-3 font-display text-lg font-bold">Follow up first</p>
        <ul className="divide-y divide-white/6">
          {top.map((x) => (
            <li key={x.shop.name} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <div><p className="font-semibold text-white">{x.shop.name}</p><p className="text-slate-400">{inr(x.outstanding)} &middot; {x.days} days</p></div>
              <Chip text={x.shop.status} />
            </li>
          ))}
          {top.length === 0 && <li className="py-2 text-sm text-slate-400">Everyone has paid up.</li>}
        </ul>
      </Card>
    </div>
  );
}
