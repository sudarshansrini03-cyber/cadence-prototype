import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Chip, Sheet, TiltCard, useToast } from '../components/ui';
import { balance } from '../lib/matching';
import { daysOverdue, fmtDate, inr } from '../lib/format';
import { ranked, useStore } from '../lib/store';
import type { Invoice } from '../types';

const CADENCE = ['Day -2: gentle reminder', 'Day 0: due-date reminder', 'Day +7: polite follow-up', 'Day +15: flag for a phone call'];

function parseCsv(text: string): Invoice[] | string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return 'The file is empty.';
  const head = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const need = ['shop', 'invoice_no', 'invoice_date', 'amount', 'due_date'];
  if (need.some((n) => !head.includes(n))) return 'Columns must be: ' + need.join(', ');
  const idx = (n: string) => head.indexOf(n);
  const out: Invoice[] = [];
  for (const l of lines.slice(1)) {
    const c = l.split(',').map((x) => x.trim());
    const amount = Number(c[idx('amount')]);
    if (!c[idx('shop')] || !(amount > 0)) return 'Bad row: ' + l;
    out.push({ shop: c[idx('shop')], no: c[idx('invoice_no')], date: c[idx('invoice_date')], due: c[idx('due_date')], amount, paid: 0 });
  }
  return out;
}

export default function Accountant() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const list = ranked(state);
  const [open, setOpen] = useState<string | null>(null);
  const [cash, setCash] = useState('');
  const [showCad, setShowCad] = useState(false);
  const [on, setOn] = useState([true, true, true, true]);
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const sel = list.find((x) => x.shop.name === open);

  const onFile = async (f?: File) => {
    if (!f) return;
    const r = parseCsv(await f.text());
    if (typeof r === 'string') return toast(r);
    dispatch({ t: 'import', invoices: r });
    toast(`Imported ${r.length} bills`);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-end justify-between">
            <div><h2 className="font-display text-xl font-bold">Call first</h2><p className="text-sm text-slate-400">Today&apos;s list, most urgent first</p></div>
          </div>
          <ul className="space-y-3">
            {list.map((x, k) => (
              <motion.li key={x.shop.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.04 }}>
                <TiltCard onClick={() => { setOpen(x.shop.name); setCash(''); }} className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 font-bold text-obsidian-900 shadow-[0_0_16px_rgba(245,158,11,0.4)]">{k + 1}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-white">{x.shop.name}</span>
                      <span className="block text-sm text-slate-400">{inr(x.outstanding)} &middot; {x.days} days</span>
                    </span>
                    <Chip text={x.shop.status} />
                  </div>
                </TiltCard>
              </motion.li>
            ))}
            {list.length === 0 && <Card><p className="text-sm text-slate-400">No open bills.</p></Card>}
          </ul>
        </div>

        <div className="space-y-4">
          <TiltCard
            className={`flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-5 text-center transition-colors ${drag ? 'border-emerald-400/60 bg-emerald-500/10' : ''}`}
          >
            <div
              className="absolute inset-0"
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
              onClick={() => file.current?.click()}
            />
            <input ref={file} type="file" accept=".csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <span className="text-3xl">📥</span>
            <p className="font-semibold text-white">Import from Tally</p>
            <p className="text-xs text-slate-400">Drop your CSV export here or click to browse</p>
          </TiltCard>

          <Card>
            <button className="flex w-full items-center justify-between font-bold text-white" onClick={() => setShowCad(!showCad)}>
              Reminder cadence <span className="text-slate-400">{showCad ? '−' : '+'}</span>
            </button>
            {showCad && (
              <div className="mt-3 space-y-2 text-sm">
                {CADENCE.map((c, k) => (
                  <label key={c} className="flex items-center gap-3 text-slate-300"><input type="checkbox" checked={on[k]} onChange={() => setOn(on.map((v, j) => (j === k ? !v : v)))} />{c}</label>
                ))}
                <p className="text-xs text-slate-500">Display only in this prototype. Nothing is scheduled.</p>
              </div>
            )}
          </Card>

          <div className="text-center">
            <button className="text-xs text-slate-400 underline hover:text-slate-200" onClick={() => { dispatch({ t: 'reset' }); toast('Sample data restored'); }}>Reset sample data</button>
          </div>
        </div>
      </div>

      {sel && (
        <Sheet title={sel.shop.name} onClose={() => setOpen(null)}>
          <div className="mb-3 flex items-center justify-between"><span className="font-display text-2xl font-bold text-white">{inr(sel.outstanding)}</span><Chip text={sel.shop.status} /></div>
          <table className="mb-4 w-full text-sm">
            <thead><tr className="text-left text-slate-400"><th>Bill</th><th>Due</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {sel.open.map((i) => (
                <tr key={i.no} className="border-t border-white/8"><td className="py-1.5 text-white">{i.no}</td><td className="text-slate-300">{fmtDate(i.due)} <span className="text-slate-500">({daysOverdue(i.due) > 0 ? daysOverdue(i.due) + 'd late' : 'not due'})</span></td><td className="text-right text-white">{inr(balance(i))}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-2">
            <Button kind="ghost" onClick={() => toast(`Calling ${sel.shop.name}… (simulated)`)}>Call</Button>
            <Button onClick={() => { dispatch({ t: 'remind', shop: sel.shop.name }); toast('Reminder sent. See the Shop tab.'); setOpen(null); }}>Send reminder</Button>
          </div>
          <div className="mt-3 flex gap-2">
            <input value={cash} onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Cash received (₹)" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-obsidian-700 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
            <Button kind="gold" disabled={!cash || Number(cash) > sel.outstanding} onClick={() => { dispatch({ t: 'cash', shop: sel.shop.name, amount: Number(cash) }); toast('Cash logged'); setOpen(null); }}>Log cash</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
