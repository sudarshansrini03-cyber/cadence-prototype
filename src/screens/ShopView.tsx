import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Chip, Sheet, useToast } from '../components/ui';
import { DISTRIBUTOR, UPI_ID } from '../data/sample';
import { balance } from '../lib/matching';
import { fmtDate, inr, TODAY, daysOverdue } from '../lib/format';
import { labels, LANGS, reminderText } from '../lib/i18n';
import { shopSummary, useStore } from '../lib/store';
import { generateAIReminder, parseVoicePromiseWithAI } from '../lib/ai';

export default function ShopView() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const sums = shopSummary(state);
  const activeShopName = state.selectedShop || sums[0]?.shop.name || '';
  const [modal, setModal] = useState<'upi' | 'date' | 'voice' | null>(null);
  const [date, setDate] = useState('2026-11-28');
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ model: string; durationMs: number } | null>(null);
  const [tone, setTone] = useState<'friendly' | 'firm' | 'festival'>('friendly');
  const [voiceText, setVoiceText] = useState(
    'Bhaiya namaste, aaj bazar mein collection thoda kam tha. Agle mangalwaar 28 tareekh ko subah ₹50,000 pakka UPI kar doonga.'
  );
  const [voiceParsing, setVoiceParsing] = useState(false);

  const cur = sums.find((x) => x.shop.name === activeShopName) ?? sums[0];
  const L = labels(state.lang);
  if (!cur) return <p className="text-sm">No shops loaded.</p>;
  const oldest = cur.open[0];
  const amt = oldest ? balance(oldest) : 0;
  const upi = oldest ? `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(DISTRIBUTOR)}&am=${amt}&cu=INR&tn=${encodeURIComponent('Inv ' + oldest.no)}` : '';

  const handleGenerateAI = async () => {
    if (!oldest) return;
    setAiGenerating(true);
    const activeModel = localStorage.getItem('cadence_ai_model') || 'openai/gpt-oss-20b';
    const res = await generateAIReminder({
      shopName: cur.shop.name,
      invoiceNo: oldest.no,
      amount: amt,
      dueDate: oldest.due,
      daysOverdue: daysOverdue(oldest.due),
      lang: state.lang,
      tone,
      model: activeModel,
    });
    setAiGenerating(false);

    if (res && res.success) {
      setAiMessage(res.message);
      setAiMeta({ model: res.model, durationMs: res.durationMs });
      toast(`✨ Groq AI generated message in ${res.durationMs}ms`);
    } else {
      toast('Could not connect to Groq backend. Showing template.');
    }
  };

  const handleParseVoice = async () => {
    setVoiceParsing(true);
    const activeModel = localStorage.getItem('cadence_ai_model') || 'openai/gpt-oss-20b';
    const res = await parseVoicePromiseWithAI(voiceText, activeModel);
    setVoiceParsing(false);

    if (res && res.success && res.result.promisedDate) {
      dispatch({ t: 'promise', shop: cur.shop.name, date: res.result.promisedDate });
      setModal(null);
      toast(`🎙️ Groq parsed voice: Promised ${fmtDate(res.result.promisedDate)} (₹${res.result.promisedAmount?.toLocaleString('en-IN')})`);
    } else {
      toast('Failed to parse date from voice note.');
    }
  };

  const displayMessage = aiMessage || (oldest ? reminderText(state.lang, oldest, amt, daysOverdue(oldest.due) > 0) : '');

  return (
    <div className="space-y-3">
      {/* Shop & Language bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cur.shop.name}
          onChange={(e) => {
            dispatch({ t: 'selectShop', shop: e.target.value });
            setAiMessage(null);
            setAiMeta(null);
          }}
          className="rounded-xl border border-navy/30 bg-white px-3 py-2 text-sm"
          aria-label="Shop"
        >
          {sums.map((x) => <option key={x.shop.name}>{x.shop.name}</option>)}
        </select>
        <div className="ml-auto flex overflow-hidden rounded-xl border border-navy/30 bg-white text-sm" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                dispatch({ t: 'lang', lang: l.id });
                setAiMessage(null);
              }}
              className={`px-3 py-2 ${state.lang === l.id ? 'bg-navy text-white' : ''}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Groq AI Toolbar */}
      <div className="flex items-center justify-between gap-2 bg-white/70 p-2.5 rounded-2xl border border-gold/40 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-navy">AI Tone:</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
            className="rounded-lg border border-navy/20 bg-white px-2 py-1 text-xs"
          >
            <option value="friendly">Warm / Friendly</option>
            <option value="firm">Firm / Due Clearance</option>
            <option value="festival">Festive / Diwali</option>
          </select>
        </div>
        <button
          onClick={handleGenerateAI}
          disabled={aiGenerating || !oldest}
          className="flex items-center gap-1 bg-gold text-navy font-bold px-3 py-1.5 rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {aiGenerating ? '⚡ Generating…' : '✨ Groq AI Draft'}
        </button>
      </div>

      {/* WhatsApp simulated phone */}
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border-4 border-navy bg-[#E8DFCB]">
        <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold font-bold text-navy">A</span>
            <div>
              <p className="text-sm font-semibold">{DISTRIBUTOR}</p>
              <p className="text-xs text-white/60">Business account</p>
            </div>
          </div>
          <button
            onClick={() => setModal('voice')}
            className="text-[11px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-full flex items-center gap-1 transition-colors"
            title="Simulate Kirana Shopkeeper Voice Note"
          >
            <span>🎙️</span> Voice Note
          </button>
        </div>

        <div className="min-h-[300px] space-y-3 p-4">
          {oldest ? (
            <>
              <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm shadow relative">
                <p>{displayMessage}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-navy/50">
                  <span>{aiMeta ? `⚡ Groq ${aiMeta.durationMs}ms` : ''}</span>
                  <span>{cur.shop.reminded ? '✓✓ Delivered' : 'Not sent yet (preview)'}</span>
                </div>
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

      {modal === 'voice' && (
        <Sheet title="🎙️ Kirana Voice Note Promise (AI)" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-navy/70 text-xs">
              Kirana shopkeepers often send voice notes on WhatsApp to negotiate dates. Groq understands natural Indian Hindi voice transcriptions and automatically logs the promised date.
            </p>
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Simulated Voice Transcription</label>
              <textarea
                rows={3}
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                className="w-full rounded-xl border border-navy/30 p-2 text-sm bg-slate-50"
              />
            </div>
            <Button
              kind="gold"
              disabled={voiceParsing || !voiceText}
              onClick={handleParseVoice}
              className="w-full"
            >
              {voiceParsing ? '⚡ Groq Extracting Date…' : '✨ Groq AI: Extract Promise & Update List'}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
