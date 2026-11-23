import { useRef, useState } from 'react';
import { Button, Card, Chip, Sheet, useToast } from '../components/ui';
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
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div><h2 className="text-xl font-bold">Call first</h2><p className="text-sm text-navy/60">Today's list, most urgent first</p></div>
        <div>
          <input ref={file} type="file" accept=".csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <Button kind="ghost" onClick={() => file.current?.click()}>Import from Tally</Button>
        </div>
      </div>
      <ul className="space-y-2">
        {list.map((x, k) => (
          <li key={x.shop.name}>
            <button onClick={() => { setOpen(x.shop.name); setCash(''); }} className="flex w-full items-center gap-3 rounded-2xl border border-[#E3D7BC] bg-white p-3 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold font-bold">{k + 1}</span>
              <span className="flex-1">
                <span className="block font-semibold">{x.shop.name}</span>
                <span className="block text-sm text-navy/60">{inr(x.outstanding)} &middot; {x.days} days</span>
              </span>
              <Chip text={x.shop.status} />
            </button>
          </li>
        ))}
        {list.length === 0 && <Card><p className="text-sm">No open bills.</p></Card>}
      </ul>

      <Card>
        <button className="flex w-full items-center justify-between font-bold" onClick={() => setShowCad(!showCad)}>
          Reminder cadence <span className="text-navy/50">{showCad ? '−' : '+'}</span>
        </button>
        {showCad && (
          <div className="mt-3 space-y-2 text-sm">
            {CADENCE.map((c, k) => (
              <label key={c} className="flex items-center gap-3"><input type="checkbox" checked={on[k]} onChange={() => setOn(on.map((v, j) => (j === k ? !v : v)))} />{c}</label>
            ))}
            <p className="text-xs text-navy/50">Display only in this prototype. Nothing is scheduled.</p>
          </div>
        )}
      </Card>
      <div className="text-center"><button className="text-xs text-navy/50 underline" onClick={() => { dispatch({ t: 'reset' }); toast('Sample data restored'); }}>Reset sample data</button></div>

      {sel && (
        <Sheet title={sel.shop.name} onClose={() => setOpen(null)}>
          <div className="mb-3 flex items-center justify-between"><span className="text-2xl font-bold">{inr(sel.outstanding)}</span><Chip text={sel.shop.status} /></div>
          <table className="mb-4 w-full text-sm">
            <thead><tr className="text-left text-navy/50"><th>Bill</th><th>Due</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {sel.open.map((i) => (
                <tr key={i.no} className="border-t border-slate-100"><td className="py-1.5">{i.no}</td><td>{fmtDate(i.due)} <span className="text-navy/50">({daysOverdue(i.due) > 0 ? daysOverdue(i.due) + 'd late' : 'not due'})</span></td><td className="text-right">{inr(balance(i))}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-2">
            <Button kind="ghost" onClick={() => toast(`Calling ${sel.shop.name}… (simulated)`)}>Call</Button>
            <Button onClick={() => { dispatch({ t: 'remind', shop: sel.shop.name }); toast('Reminder sent. See the Shop tab.'); setOpen(null); }}>Send reminder</Button>
          </div>
          <div className="mt-3 flex gap-2">
            <input value={cash} onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Cash received (₹)" className="min-w-0 flex-1 rounded-xl border border-navy/30 px-3 py-2 text-sm" />
            <Button kind="gold" disabled={!cash || Number(cash) > sel.outstanding} onClick={() => { dispatch({ t: 'cash', shop: sel.shop.name, amount: Number(cash) }); toast('Cash logged'); setOpen(null); }}>Log cash</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
