import { useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Chip, Sheet, TiltCard, useToast } from '../components/ui';
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
  if (!cur) return <p className="text-sm text-slate-400">No shops loaded.</p>;
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
    <div className="space-y-4">
      {/* Shop & Language bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cur.shop.name}
          onChange={(e) => { dispatch({ t: 'selectShop', shop: e.target.value }); setAiMessage(null); setAiMeta(null); }}
          className="rounded-xl border border-white/15 bg-obsidian-700 px-3 py-2 text-sm text-white"
          aria-label="Shop"
        >
          {sums.map((x) => <option key={x.shop.name}>{x.shop.name}</option>)}
        </select>
        <div className="ml-auto flex overflow-hidden rounded-xl border border-white/15 text-sm" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => { dispatch({ t: 'lang', lang: l.id }); setAiMessage(null); }}
              className={`px-3 py-2 ${state.lang === l.id ? 'bg-emerald-500 font-semibold text-obsidian-900' : 'text-slate-300 hover:bg-white/5'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Groq AI Toolbar */}
      <div className="glass-soft flex flex-wrap items-center justify-between gap-2 rounded-2xl p-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-300">AI Tone:</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as any)} className="rounded-lg border border-white/15 bg-obsidian-700 px-2 py-1 text-xs text-white">
            <option value="friendly">Warm / Friendly</option>
            <option value="firm">Firm / Due Clearance</option>
            <option value="festival">Festive / Diwali</option>
          </select>
        </div>
        <button
          onClick={handleGenerateAI}
          disabled={aiGenerating || !oldest}
          className="flex items-center gap-1 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-1.5 font-bold text-obsidian-900 shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)] transition-colors hover:from-amber-200 hover:to-amber-400 disabled:opacity-50"
        >
          {aiGenerating ? '⚡ Generating…' : '✨ Groq AI Draft'}
        </button>
      </div>

      {/* WhatsApp simulated phone */}
      <TiltCard className="mx-auto w-full max-w-sm overflow-hidden p-0">
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 font-bold text-obsidian-900">A</span>
            <div>
              <p className="text-sm font-semibold">{DISTRIBUTOR}</p>
              <p className="text-xs text-white/70">Business account</p>
            </div>
          </div>
          <button
            onClick={() => setModal('voice')}
            className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[11px] text-white transition-colors hover:bg-white/30"
            title="Simulate Kirana Shopkeeper Voice Note"
          >
            <span>🎙️</span> Voice Note
          </button>
        </div>

        <div className="min-h-[300px] space-y-3 bg-obsidian-900/70 p-4">
          {oldest ? (
            <>
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="relative max-w-[88%] rounded-2xl rounded-tl-sm bg-obsidian-600 p-3 text-sm text-slate-100 shadow">
                <p>{displayMessage}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{aiMeta ? `⚡ Groq ${aiMeta.durationMs}ms` : ''}</span>
                  <span>{cur.shop.reminded ? '✓✓ Delivered' : 'Not sent yet (preview)'}</span>
                </div>
              </motion.div>

              <div className="space-y-2">
                <button onClick={() => setModal('upi')} className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20">{L.upi}</button>
                <button onClick={() => setModal('date')} className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 py-2.5 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20">{L.date}</button>
                <button onClick={() => { dispatch({ t: 'call', shop: cur.shop.name }); toast('Request sent. Moved to the top of Call first.'); }} className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10">{L.call}</button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-obsidian-600 p-4 text-center text-sm text-slate-200">All bills paid. Thank you!</div>
          )}
        </div>
        <div className="border-t border-white/10 bg-obsidian-800/70 px-4 py-2 text-xs text-slate-300">Status: <Chip text={cur.shop.status} /></div>
      </TiltCard>

      {modal === 'upi' && oldest && (
        <Sheet title={L.upi} onClose={() => setModal(null)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={upi} size={190} /></div>
            <p className="font-display text-2xl font-bold text-white">{inr(amt)}</p>
            <p className="text-sm text-slate-400">Pay to {UPI_ID} &middot; note: Inv {oldest.no}</p>
            <p className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs text-amber-300">Sample QR. No real payment is made.</p>
            <Button kind="gold" onClick={() => { dispatch({ t: 'pay', shop: cur.shop.name, amount: amt }); setModal(null); toast('Payment received and matched. See the Matching tab.'); }}>{L.simulatePay}</Button>
          </div>
        </Sheet>
      )}

      {modal === 'date' && (
        <Sheet title={L.date} onClose={() => setModal(null)}>
          <input type="date" min={TODAY} value={date} onChange={(e) => setDate(e.target.value)} className="mb-3 w-full rounded-xl border border-white/15 bg-obsidian-700 px-3 py-2 text-white" />
          <Button disabled={!date || date < TODAY} onClick={() => { dispatch({ t: 'promise', shop: cur.shop.name, date }); setModal(null); toast(`Promise saved: ${fmtDate(date)}`); }}>{L.confirm}</Button>
        </Sheet>
      )}

      {modal === 'voice' && (
        <Sheet title="🎙️ Kirana Voice Note Promise (AI)" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-400">
              Kirana shopkeepers often send voice notes on WhatsApp to negotiate dates. Groq understands natural Indian Hindi voice transcriptions and automatically logs the promised date.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Simulated Voice Transcription</label>
              <textarea rows={3} value={voiceText} onChange={(e) => setVoiceText(e.target.value)} className="w-full rounded-xl border border-white/15 bg-obsidian-700 p-2 text-sm text-white" />
            </div>
            <Button kind="gold" disabled={voiceParsing || !voiceText} onClick={handleParseVoice} className="w-full">
              {voiceParsing ? '⚡ Groq Extracting Date…' : '✨ Groq AI: Extract Promise & Update List'}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
