import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Sheet, ToastProvider, useToast } from './components/ui';
import Accountant from './screens/Accountant';
import CadenceAgent from './components/CadenceAgent';
import Matching from './screens/Matching';
import Owner from './screens/Owner';
import ShopView from './screens/ShopView';
import { useStore } from './lib/store';
import { checkAIHealth, type AIHealth } from './lib/ai';

const TABS = [['Owner', '📊'], ['Accountant', '🧾'], ['Shop', '🏪'], ['Matching', '🔗']] as const;

function AppContent() {
  const [tab, setTab] = useState(0);
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [aiInfo, setAiInfo] = useState<AIHealth | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('openai/gpt-oss-20b');

  useEffect(() => {
    checkAIHealth().then((info) => {
      if (info) {
        setAiInfo(info);
        setSelectedModel(info.activeModel);
      }
    });
  }, []);

  const Screen = TABS[tab][1] && [Owner, Accountant, ShopView, Matching][tab];
  const badge = state.payments.filter((p) => p.state === 'review').length;
  const connected = !!aiInfo?.groqConnected;

  const StatusPill = (
    <button
      onClick={() => setShowAiModal(true)}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:scale-[1.03] ${
        connected
          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 glow-emerald'
          : 'border-amber-400/40 bg-amber-500/15 text-amber-300 glow-amber'
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} />
      <span className="whitespace-nowrap">{connected ? `Groq LPU (${selectedModel.split('/')[1] || selectedModel})` : 'Offline Prototype'}</span>
    </button>
  );

  const aiModal = showAiModal && (
    <Sheet title="⚡ Groq AI Backend Engine" onClose={() => setShowAiModal(false)}>
      <div className="space-y-4 text-sm">
        <div className={`glass-soft flex items-center gap-3 rounded-2xl p-3 ${connected ? 'glow-emerald' : 'glow-amber'}`}>
          <div className={`h-3 w-3 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">
              {connected ? 'Connected to Groq LPU Cloud' : 'Offline / Standalone Mode'}
            </p>
            <p className="text-xs text-slate-400">
              {connected
                ? 'Ultra-low latency inference engine active (~200ms responses)'
                : 'Backend offline. Run `npm run dev:all` to connect Groq.'}
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Active AI Model</label>
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              localStorage.setItem('cadence_ai_model', e.target.value);
              toast(`Active Model switched to ${e.target.value}`);
            }}
            className="w-full rounded-xl border border-white/15 bg-obsidian-700 p-2.5 text-sm text-white"
          >
            <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (Ultra-fast ~500 tokens/sec)</option>
            <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Flagship 120B Reasoning)</option>
            <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Multilingual)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            You can switch between Groq models without changing API keys!
          </p>
        </div>

        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live AI Capabilities Enabled</p>
          <ul className="space-y-1 text-xs text-slate-300">
            <li>✨ <strong>Dynamic WhatsApp Reminders</strong>: Personalized vernacular Hindi/Kannada tone.</li>
            <li>🧠 <strong>Intelligent Payment Matching</strong>: Reads fuzzy bank narrations and explains match logic.</li>
            <li>🎙️ <strong>Kirana Voice Note Parser</strong>: Extracts promised payment dates from Hindi voice notes.</li>
          </ul>
        </div>

        <Button onClick={() => setShowAiModal(false)} className="w-full mt-2">
          Done
        </Button>
      </div>
    </Sheet>
  );

  return (
    <div className="min-h-screen bg-obsidian-900">
      {/* Ambient background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-amber-500/8 blur-3xl" />
      </div>

      <div className="relative flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/8 bg-obsidian-800/60 p-5 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 font-display text-lg font-bold text-obsidian-900 shadow-[0_0_24px_rgba(16,185,129,0.5)]">C</span>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-white">Cadence</h1>
              <p className="text-[11px] text-slate-500">Collections, on rhythm</p>
            </div>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-2">
            {TABS.map(([label, icon], k) => (
              <button
                key={label}
                onClick={() => setTab(k)}
                className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  tab === k ? 'bg-white/8 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
                {label === 'Matching' && badge > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{badge}</span>
                )}
                {tab === k && <motion.span layoutId="sidebar-indicator" className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />}
              </button>
            ))}
          </nav>
          <div className="mt-auto">{StatusPill}</div>
          <p className="mt-3 text-[10px] leading-snug text-slate-600">Prototype. Sample data, not real shops.</p>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/8 bg-obsidian-900/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 font-display font-bold text-obsidian-900">C</span>
              <span className="font-display text-lg font-bold tracking-tight text-white">Cadence</span>
            </div>
            {StatusPill}
          </header>

          {/* Desktop page header */}
          <header className="hidden items-center justify-between px-8 pt-6 lg:flex">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-white">{TABS[tab][0]}</h2>
              <p className="text-sm text-slate-400">Friendly reminders, one-tap payments and automatic matching.</p>
            </div>
            <p className="text-xs text-slate-600">Prototype. Sample data, not real shops.</p>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-4 pb-28 lg:px-8 lg:pb-8"><Screen /></main>
        </div>
      </div>

      {/* Mobile floating glass dock */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 lg:hidden">
        <div className="glass flex w-full max-w-md items-center justify-between gap-1 rounded-2xl p-1.5">
          {TABS.map(([label, icon], k) => (
            <button
              key={label}
              onClick={() => setTab(k)}
              className={`relative flex-1 rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors ${
                tab === k ? 'text-emerald-300' : 'text-slate-400'
              }`}
            >
              {tab === k && (
                <motion.span
                  layoutId="dock-pill"
                  className="absolute inset-0 rounded-xl border border-emerald-400/30 bg-emerald-500/15"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex flex-col items-center gap-0.5">
                <span className="text-base">{icon}</span>
                <span>{label}</span>
                {label === 'Matching' && badge > 0 && <span className="absolute right-1 top-0.5 rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{badge}</span>}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {aiModal}
      <CadenceAgent tab={tab} onNavigate={setTab} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
