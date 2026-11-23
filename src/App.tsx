import { useEffect, useState } from 'react';
import { Button, Sheet, ToastProvider, useToast } from './components/ui';
import Accountant from './screens/Accountant';
import Matching from './screens/Matching';
import Owner from './screens/Owner';
import ShopView from './screens/ShopView';
import { useStore } from './lib/store';
import { checkAIHealth, type AIHealth } from './lib/ai';

const TABS = [['Owner', Owner], ['Accountant', Accountant], ['Shop', ShopView], ['Matching', Matching]] as const;

function AppContent() {
  const [tab, setTab] = useState(0);
  const { state } = useStore();
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

  const Screen = TABS[tab][1];
  const badge = state.payments.filter((p) => p.state === 'review').length;

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-24">
      <div className="bg-navy px-4 py-1.5 text-center text-xs text-gold flex items-center justify-between">
        <span className="truncate">Prototype. Sample data, not real shops.</span>
        <button
          onClick={() => setShowAiModal(true)}
          className="ml-2 shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <span className={`inline-block w-2 h-2 rounded-full ${aiInfo?.groqConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span>{aiInfo?.groqConnected ? `Groq LPU (${selectedModel.split('/')[1] || selectedModel})` : 'Offline Prototype'}</span>
        </button>
      </div>

      <header className="px-4 pb-1 pt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadence</h1>
          <p className="text-sm text-navy/60">Friendly reminders, one-tap payments and automatic matching.</p>
        </div>
      </header>

      <main className="px-4 py-3"><Screen /></main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/10 bg-white">
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map(([label], k) => (
            <button key={label} onClick={() => setTab(k)} className={`relative py-3.5 text-sm font-semibold ${tab === k ? 'text-navy' : 'text-navy/45'}`}>
              {label}{label === 'Matching' && badge > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{badge}</span>}
              {tab === k && <span className="absolute inset-x-6 top-0 h-1 rounded-b bg-gold" />}
            </button>
          ))}
        </div>
      </nav>

      {showAiModal && (
        <Sheet title="⚡ Groq AI Backend Engine" onClose={() => setShowAiModal(false)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className={`w-3 h-3 rounded-full ${aiInfo?.groqConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy">
                  {aiInfo?.groqConnected ? 'Connected to Groq LPU Cloud' : 'Offline / Standalone Mode'}
                </p>
                <p className="text-xs text-navy/60">
                  {aiInfo?.groqConnected
                    ? 'Ultra-low latency inference engine active (~200ms responses)'
                    : 'Backend offline. Run `npm run dev:all` to connect Groq.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-navy/60 mb-1">Active AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  localStorage.setItem('cadence_ai_model', e.target.value);
                  toast(`Active Model switched to ${e.target.value}`);
                }}
                className="w-full rounded-xl border border-navy/30 bg-white p-2.5 text-sm"
              >
                <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (Ultra-fast ~500 tokens/sec)</option>
                <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Flagship 120B Reasoning)</option>
                <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Multilingual)</option>
              </select>
              <p className="text-xs text-navy/50 mt-1">
                You can switch between Groq models without changing API keys!
              </p>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="font-semibold text-xs uppercase text-navy/60">Live AI Capabilities Enabled</p>
              <ul className="text-xs space-y-1 text-navy/70">
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
      )}
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
