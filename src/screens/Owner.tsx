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
  const max = Math.max(...buckets);
  const collected = COLLECTED_BASE + state.payments.filter((p) => p.state === 'matched' || p.state === 'confirmed').reduce((a, p) => a + p.amount, 0);
  const top = ranked(state).slice(0, 3);
  const rows = [['0–30 days', 'bg-teal-600'], ['31–60 days', 'bg-amber-600'], ['60+ days', 'bg-red-700']];
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-navy/60">Outstanding now</p>
        <p className="mt-1 text-4xl font-bold">{lakh(total)}</p>
        <div className="mt-4 space-y-3">
          {rows.map(([label, color], k) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-navy/70">{label}</span>
              <div className="h-3 flex-1 rounded bg-slate-100"><div className={`h-3 rounded ${color}`} style={{ width: `${(buckets[k] / max) * 100}%` }} /></div>
              <span className="w-20 shrink-0 text-right font-semibold">{lakh(buckets[k])}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-navy/50">Includes other customers not listed in this demo.</p>
      </Card>
      <Card>
        <p className="text-sm text-navy/60">Collected today</p>
        <p className="mt-1 text-3xl font-bold text-teal-700">{lakh(collected)}</p>
      </Card>
      <Card>
        <p className="mb-2 font-bold">Follow up first</p>
        <ul className="divide-y divide-slate-100">
          {top.map((x) => (
            <li key={x.shop.name} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div><p className="font-semibold">{x.shop.name}</p><p className="text-navy/60">{inr(x.outstanding)} &middot; {x.days} days</p></div>
              <Chip text={x.shop.status} />
            </li>
          ))}
          {top.length === 0 && <li className="py-2 text-sm text-navy/60">Everyone has paid up.</li>}
        </ul>
      </Card>
    </div>
  );
}
