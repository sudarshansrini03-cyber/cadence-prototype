import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Chip } from './ui';
import { balance } from '../lib/matching';
import { daysOverdue, inr, lakh } from '../lib/format';
import { shopSummary, useStore } from '../lib/store';
import { generateAIReminder } from '../lib/ai';
import { askCadence, type CadenceCommand } from '../lib/cadence';

export type TabId = 'owner' | 'accountant' | 'shop' | 'matching';
const TAB_INDEX: Record<TabId, number> = { owner: 0, accountant: 1, shop: 2, matching: 3 };

const QUICK_PROMPTS = ['Pull 60+ day dues', 'Draft Kannada reminder', 'Add new invoice', 'Match payments'] as const;

interface ExecResult { kind: string; title: string; detail: string; rows?: { label: string; value: string }[] }

function agingBucket(due: string): '0-30' | '31-60' | '60+' {
  const d = daysOverdue(due);
  return d <= 30 ? '0-30' : d <= 60 ? '31-60' : '60+';
}

export default function CadenceAgent({ tab, onNavigate }: { tab: number; onNavigate: (k: number) => void }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [results, setResults] = useState<ExecResult[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [results, reply, busy]);

  const execute = async (cmds: CadenceCommand[]) => {
    const out: ExecResult[] = [];
    for (const c of cmds) {
      switch (c.type) {
        case 'navigate': {
          onNavigate(TAB_INDEX[c.tab]);
          out.push({ kind: 'navigate', title: `Switched to ${c.tab[0].toUpperCase()}${c.tab.slice(1)}`, detail: 'View changed.' });
          break;
        }
        case 'filter_aging': {
          const rows = state.invoices
            .filter((i) => balance(i) > 0 && agingBucket(i.due) === c.bucket)
            .map((i) => ({ label: `${i.shop} · Bill ${i.no} (${daysOverdue(i.due)}d late)`, value: inr(balance(i)) }));
          const total = rows.length ? state.invoices.filter((i) => balance(i) > 0 && agingBucket(i.due) === c.bucket).reduce((a, i) => a + balance(i), 0) : 0;
          out.push({ kind: 'filter', title: `${c.bucket} day dues`, detail: rows.length ? `Total ${lakh(total)} across ${rows.length} bills` : 'Nothing in this bucket — all clear.', rows });
          break;
        }
        case 'draft_reminder': {
          const sums = shopSummary(state);
          const target = sums.find((x) => x.shop.name.toLowerCase() === c.shopName.toLowerCase()) ?? sums.find((x) => x.outstanding > 0);
          const oldest = target?.open[0];
          if (!oldest) { out.push({ kind: 'draft', title: 'Draft reminder', detail: `No open bills for ${c.shopName}.` }); break; }
          const res = await generateAIReminder({
            shopName: target.shop.name, invoiceNo: oldest.no, amount: balance(oldest), dueDate: oldest.due,
            daysOverdue: daysOverdue(oldest.due), lang: c.lang, tone: c.tone ?? 'friendly',
            model: localStorage.getItem('cadence_ai_model') || undefined,
          });
          out.push(res?.success
            ? { kind: 'draft', title: `WhatsApp draft for ${target.shop.name} (${c.lang.toUpperCase()}${res.durationMs ? `, ${res.durationMs}ms` : ''})`, detail: res.message }
            : { kind: 'draft', title: 'Draft reminder', detail: 'Could not reach the Groq backend for the draft.' });
          break;
        }
        case 'upsert_invoice': {
          dispatch({ t: 'addInvoice', invoice: { no: c.invoiceNo, shop: c.shop, date: c.invoiceDate, due: c.dueDate, amount: Number(c.amount), paid: 0 } });
          out.push({ kind: 'ledger', title: `Ledger updated: Bill ${c.invoiceNo}`, detail: `${c.shop} · ${inr(Number(c.amount))} due ${c.dueDate}. The 3D aging chart now reflects this.` });
          break;
        }
        case 'run_match': {
          const pending = state.payments.filter((p) => p.state === 'pending').length;
          if (pending) dispatch({ t: 'runMatch' });
          out.push({ kind: 'match', title: 'Auto-match run', detail: pending ? `${pending} payment(s) processed. Check the Matching tab.` : 'No payments were waiting.' });
          break;
        }
        case 'summarize': {
          const buckets = [0, 0, 0];
          for (const i of state.invoices) { const b = balance(i); if (b > 0) buckets[agingBucket(i.due) === '0-30' ? 0 : agingBucket(i.due) === '31-60' ? 1 : 2] += b; }
          const outstanding = buckets.reduce((a, b) => a + b, 0);
          out.push({
            kind: 'summary', title: 'Ledger snapshot', detail: `Outstanding ${lakh(outstanding)} · ${state.payments.filter((p) => p.state === 'pending').length} payments waiting`,
            rows: [
              { label: '0–30 days', value: lakh(buckets[0]) },
              { label: '31–60 days', value: lakh(buckets[1]) },
              { label: '60+ days', value: lakh(buckets[2]) },
            ],
          });
          break;
        }
      }
    }
    setResults((r) => [...r, ...out]);
  };

  const ask = async (prompt: string) => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setInput('');
    setReply(null);
    const res = await askCadence({ prompt, state, model: localStorage.getItem('cadence_ai_model') || undefined });
    setBusy(false);
    if (!res || !res.success) { setReply('Cadence could not reach the backend. Check the Groq connection and try again.'); return; }
    setOffline(!!res.offline);
    setReply(res.reply);
    await execute(res.commands ?? []);
  };

  return (
    <>
      {/* Floating launcher */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="glass fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white lg:bottom-6 lg:right-6 glow-cyan"
      >
        <span className="text-base">✨</span> Ask Cadence
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="glass flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-3xl bg-obsidian-800/95 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-obsidian-900">✦</span>
                  <div>
                    <p className="font-display font-bold text-white">Cadence Agent</p>
                    <p className="text-[11px] text-slate-400">{offline ? 'Offline fallback mode' : 'Groq-powered command mode'}</p>
                  </div>
                </div>
                <button aria-label="Close" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-xl leading-none text-slate-400 hover:text-white">&times;</button>
              </div>

              <div ref={scroller} className="min-h-[200px] flex-1 space-y-3 overflow-y-auto p-4">
                {!reply && !busy && results.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400">Ask me to pull dues, draft reminders in any language, add invoices, or match payments — I&apos;ll act on the live ledger.</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((q) => (
                        <button key={q} onClick={() => ask(q)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {busy && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" /> Thinking through the ledger…
                  </div>
                )}

                {reply && (
                  <div className={`rounded-2xl border p-3 text-sm ${offline ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50'}`}>
                    {reply}
                  </div>
                )}

                {results.map((r, k) => (
                  <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-soft rounded-2xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{r.title}</p>
                      <Chip text={r.kind === 'ledger' ? 'Ledger updated' : r.kind === 'draft' ? 'Draft ready' : r.kind === 'filter' ? 'Filtered' : r.kind === 'match' ? 'Matched' : r.kind === 'navigate' ? 'Navigated' : 'Snapshot'} />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{r.detail}</p>
                    {r.rows && (
                      <ul className="mt-2 divide-y divide-white/8 border-t border-white/8">
                        {r.rows.map((row) => (
                          <li key={row.label} className="flex justify-between py-1.5 text-xs"><span className="text-slate-400">{row.label}</span><span className="font-semibold text-white">{row.value}</span></li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="border-t border-white/10 p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); ask(input); }}
                  className="flex items-center gap-2 rounded-2xl border border-white/15 bg-obsidian-700/80 p-1.5 focus-within:border-emerald-400/50"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Cadence… e.g. 'Pull 60+ day dues'"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-bold text-obsidian-900 disabled:opacity-40">
                    Run
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
