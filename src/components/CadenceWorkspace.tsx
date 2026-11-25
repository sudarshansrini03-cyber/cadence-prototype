import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Chip } from './ui';
import { balance } from '../lib/matching';
import { daysOverdue, inr, lakh } from '../lib/format';
import { shopSummary, useStore } from '../lib/store';
import { generateAIReminder } from '../lib/ai';
import { askCadence, type CadenceCommand } from '../lib/cadence';
import { useSessions, exportSessionJSON, type ExecResult, type ConversationSession } from '../lib/sessions';
import { OTHER_CUSTOMERS } from '../data/sample';

const QUICK_PROMPTS = ['Pull 60+ day dues', 'Draft Kannada reminder', 'Add new invoice', 'Match payments'] as const;

function agingBucket(due: string): '0-30' | '31-60' | '60+' {
  const d = daysOverdue(due);
  return d <= 30 ? '0-30' : d <= 60 ? '31-60' : '60+';
}

function dedupResults(results: ExecResult[]): ExecResult[] {
  const out: ExecResult[] = [];
  for (const r of results) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === r.kind && prev.title === r.title && prev.detail === r.detail) continue;
    out.push(r);
  }
  return out;
}

interface ExecParams {
  onNavigate: (k: number) => void;
  dispatch: ReturnType<typeof useStore>['dispatch'];
  state: ReturnType<typeof useStore>['state'];
}

async function executeCommands(cmds: CadenceCommand[], { onNavigate, dispatch, state }: ExecParams): Promise<ExecResult[]> {
  const out: ExecResult[] = [];
  for (const c of cmds) {
    switch (c.type) {
      case 'navigate': {
        const idx = ({ owner: 0, accountant: 1, shop: 2, matching: 3 } as const)[c.tab];
        onNavigate(idx);
        out.push({ kind: 'navigate', title: `Switched to ${c.tab[0].toUpperCase()}${c.tab.slice(1)}`, detail: 'Dashboard view changed.' });
        break;
      }
      case 'filter_aging': {
        const matched = state.invoices.filter((i) => balance(i) > 0 && agingBucket(i.due) === c.bucket);
        const rows = matched.map((i) => ({ label: `${i.shop} · Bill ${i.no} (${daysOverdue(i.due)}d late)`, value: inr(balance(i)) }));
        const total = matched.reduce((a, i) => a + balance(i), 0);
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
        const invoice = { no: c.invoiceNo, shop: c.shop, date: c.invoiceDate, due: c.dueDate, amount: Number(c.amount), paid: 0 };
        dispatch({ t: 'addInvoice', invoice });
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
        const buckets = [...OTHER_CUSTOMERS];
        for (const i of state.invoices) {
          const b = balance(i);
          if (b > 0) {
            const d = daysOverdue(i.due);
            buckets[d <= 30 ? 0 : d <= 60 ? 1 : 2] += b;
          }
        }
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
  return dedupResults(out);
}

function chipText(kind: string): string {
  return kind === 'ledger' ? 'Ledger updated' : kind === 'draft' ? 'Draft ready' : kind === 'filter' ? 'Filtered' : kind === 'match' ? 'Matched' : kind === 'navigate' ? 'Navigated' : 'Snapshot';
}

function ActionCard({ r }: { r: ExecResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-soft rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{r.title}</p>
        <Chip text={chipText(r.kind)} />
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
  );
}

function SessionRow({ session, active, onSelect, onDelete, onExport }: {
  session: ConversationSession; active: boolean; onSelect: () => void; onDelete: () => void; onExport: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const dateStr = new Date(session.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  const timeStr = new Date(session.updatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer rounded-xl border p-2.5 transition-all ${active ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xs font-semibold ${active ? 'text-emerald-200' : 'text-slate-200'}`}>{session.title}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{dateStr} · {timeStr} · {session.entries.length} msg</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            title="Export session log (JSON)"
            className="rounded-md p-1 text-slate-400 hover:text-cyan-300"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </button>
          {confirmDel ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); setConfirmDel(false); }}
              className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300"
            >Del?</button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
              title="Delete session"
              className="rounded-md p-1 text-slate-400 hover:text-red-400"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface CadenceWorkspaceProps {
  onNavigate: (tab: number) => void;
  onBack: () => void;
}

export default function CadenceWorkspace({ onNavigate, onBack }: CadenceWorkspaceProps) {
  const { state, dispatch } = useStore();
  const { sessions, activeId, activeSession, setActiveId, createSession, deleteSession, appendEntry } = useSessions();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveReply, setLiveReply] = useState<string | null>(null);
  const [liveOffline, setLiveOffline] = useState(false);
  const [liveResults, setLiveResults] = useState<ExecResult[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId && sessions.length === 0) createSession();
  }, [activeId, sessions.length, createSession]);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [liveResults, liveReply, busy, activeSession?.entries.length]);

  const ask = async (prompt: string) => {
    if (!prompt.trim() || busy) return;
    let sessionId = activeId;
    if (!sessionId) sessionId = createSession();
    setBusy(true);
    setInput('');
    setLiveReply(null);
    setLiveResults([]);
    const res = await askCadence({ prompt, state, model: localStorage.getItem('cadence_ai_model') || undefined });
    setBusy(false);
    if (!res || !res.success) {
      const fallbackReply = 'Cadence could not reach the backend. Check the Groq connection and try again.';
      setLiveReply(fallbackReply);
      setLiveOffline(true);
      appendEntry(sessionId, { prompt, reply: fallbackReply, offline: true, results: [], timestamp: Date.now() });
      return;
    }
    setLiveOffline(!!res.offline);
    setLiveReply(res.reply);
    const results = await executeCommands(res.commands ?? [], { onNavigate, dispatch, state });
    setLiveResults(results);
    appendEntry(sessionId, { prompt, reply: res.reply, offline: !!res.offline, results, timestamp: Date.now() });
  };

  return (
    <div className="flex h-full w-full bg-obsidian-900 text-white">
      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/8 bg-obsidian-800/60 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-white/8 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 font-display text-base font-bold text-obsidian-900">C</span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-bold tracking-tight">Cadence AI</h1>
            <p className="text-[10px] text-slate-500">Workspace · live dashboard sync</p>
          </div>
        </div>

        <div className="p-3">
          <button
            onClick={() => createSession()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-sm font-bold text-obsidian-900 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="text-lg leading-none">+</span> New
          </button>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
          {sessions.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-slate-600">No conversations yet</p>
          )}
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              active={s.id === activeId}
              onSelect={() => setActiveId(s.id)}
              onDelete={() => deleteSession(s.id)}
              onExport={() => exportSessionJSON(s)}
            />
          ))}
        </div>

        <div className="border-t border-white/8 p-3">
          <p className="text-[10px] leading-snug text-slate-600">Actions here update the dashboard behind you in real time.</p>
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/8 px-6 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-white">{activeSession?.title ?? 'Cadence Workspace'}</p>
            <p className="text-[10px] text-slate-500">{activeSession ? `${activeSession.entries.length} messages` : 'Ready'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {activeSession && (
              <button
                onClick={() => exportSessionJSON(activeSession)}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Export Session Log
              </button>
            )}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
              Back to Dashboard
            </button>
          </div>
        </header>

        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-6">
          {activeSession && activeSession.entries.length === 0 && !busy && !liveReply && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                <p className="text-sm text-slate-300">Ask me to pull dues, draft reminders in any language, add invoices, or match payments — I&apos;ll act on the live ledger behind you.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} onClick={() => ask(q)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.entries.map((entry, i) => (
            <div key={i} className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">You · {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                {entry.prompt}
              </div>
              <div className={`rounded-2xl border p-3 text-sm ${entry.offline ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50'}`}>
                {entry.reply}
              </div>
              <AnimatePresence>
                {entry.results.map((r, k) => <ActionCard key={k} r={r} />)}
              </AnimatePresence>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" /> Thinking through the ledger…
            </div>
          )}

          {liveReply && !busy && (
            <div className={`rounded-2xl border p-3 text-sm ${liveOffline ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50'}`}>
              {liveReply}
            </div>
          )}

          {liveResults.length > 0 && !busy && (
            <AnimatePresence>
              {liveResults.map((r, k) => <ActionCard key={k} r={r} />)}
            </AnimatePresence>
          )}
        </div>

        <div className="border-t border-white/10 p-4">
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
      </div>
    </div>
  );
}
