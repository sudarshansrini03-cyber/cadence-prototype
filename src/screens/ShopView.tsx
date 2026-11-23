import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Chip, Sheet, useToast } from '../components/ui';
import { DISTRIBUTOR, UPI_ID } from '../data/sample';
import { balance } from '../lib/matching';
import { fmtDate, inr, TODAY, daysOverdue } from '../lib/format';
import { labels, LANGS, reminderText } from '../lib/i18n';
import { shopSummary, useStore } from '../lib/store';

export default function ShopView() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const sums = shopSummary(state);
  const activeShopName = state.selectedShop || sums[0]?.shop.name || '';
  const [modal, setModal] = useState<'upi' | 'date' | null>(null);
  const [date, setDate] = useState('2026-11-28');
  const cur = sums.find((x) => x.shop.name === activeShopName) ?? sums[0];
  const L = labels(state.lang);
  if (!cur) return <p className="text-sm">No shops loaded.</p>;
  const oldest = cur.open[0];
  const amt = oldest ? balance(oldest) : 0;
  const upi = oldest ? `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(DISTRIBUTOR)}&am=${amt}&cu=INR&tn=${encodeURIComponent('Inv ' + oldest.no)}` : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={cur.shop.name} onChange={(e) => dispatch({ t: 'selectShop', shop: e.target.value })} className="rounded-xl border border-navy/30 bg-white px-3 py-2 text-sm" aria-label="Shop">
          {sums.map((x) => <option key={x.shop.name}>{x.shop.name}</option>)}
        </select>
        <div className="ml-auto flex overflow-hidden rounded-xl border border-navy/30 bg-white text-sm" role="group" aria-label="Language">
          {LANGS.map((l) => <button key={l.id} onClick={() => dispatch({ t: 'lang', lang: l.id })} className={`px-3 py-2 ${state.lang === l.id ? 'bg-navy text-white' : ''}`}>{l.label}</button>)}
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border-4 border-navy bg-[#E8DFCB]">
        <div className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold font-bold text-navy">A</span>
          <div><p className="text-sm font-semibold">{DISTRIBUTOR}</p><p className="text-xs text-white/60">Business account</p></div>
        </div>
        <div className="min-h-[300px] space-y-3 p-4">
          {oldest ? (
            <>
              <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm shadow">
                <p>{reminderText(state.lang, oldest, amt, daysOverdue(oldest.due) > 0)}</p>
                <p className="mt-1 text-right text-[11px] text-navy/50">{cur.shop.reminded ? '✓✓ Delivered' : 'Not sent yet (preview)'}</p>
              </div>
              <div className="space-y-2">
                <button onClick={() => setModal('upi')} className="w-full rounded-xl border-2 border-teal-700 bg-white py-2.5 text-sm font-semibold text-teal-800">{L.upi}</button>
                <button onClick={() => setModal('date')} className="w-full rounded-xl border-2 border-teal-700 bg-white py-2.5 text-sm font-semibold text-teal-800">{L.date}</button>
                <button onClick={() => { dispatch({ t: 'call', shop: cur.shop.name }); toast('Request sent. Moved to the top of Call first.'); }} className="w-full rounded-xl border-2 border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700">{L.call}</button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-white p-4 text-center text-sm">All bills paid. Thank you!</div>
          )}
        </div>
        <div className="border-t border-navy/10 bg-white/60 px-4 py-2 text-xs">Status: <Chip text={cur.shop.status} /></div>
      </div>

      {modal === 'upi' && oldest && (
        <Sheet title={L.upi} onClose={() => setModal(null)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <QRCodeSVG value={upi} size={190} />
            <p className="text-2xl font-bold">{inr(amt)}</p>
            <p className="text-sm text-navy/60">Pay to {UPI_ID} &middot; note: Inv {oldest.no}</p>
            <p className="rounded-lg bg-amber-50 px-3 py-1 text-xs text-amber-800">Sample QR. No real payment is made.</p>
            <Button kind="gold" onClick={() => { dispatch({ t: 'pay', shop: cur.shop.name, amount: amt }); setModal(null); toast('Payment received and matched. See the Matching tab.'); }}>{L.simulatePay}</Button>
          </div>
        </Sheet>
      )}
      {modal === 'date' && (
        <Sheet title={L.date} onClose={() => setModal(null)}>
          <input type="date" min={TODAY} value={date} onChange={(e) => setDate(e.target.value)} className="mb-3 w-full rounded-xl border border-navy/30 px-3 py-2" />
          <Button disabled={!date || date < TODAY} onClick={() => { dispatch({ t: 'promise', shop: cur.shop.name, date }); setModal(null); toast(`Promise saved: ${fmtDate(date)}`); }}>{L.confirm}</Button>
        </Sheet>
      )}
    </div>
  );
}
