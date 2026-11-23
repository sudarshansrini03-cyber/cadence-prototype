import { useState } from 'react';
import { ToastProvider } from './components/ui';
import Accountant from './screens/Accountant';
import Matching from './screens/Matching';
import Owner from './screens/Owner';
import ShopView from './screens/ShopView';
import { useStore } from './lib/store';

const TABS = [['Owner', Owner], ['Accountant', Accountant], ['Shop', ShopView], ['Matching', Matching]] as const;

export default function App() {
  const [tab, setTab] = useState(0);
  const { state } = useStore();
  const Screen = TABS[tab][1];
  const badge = state.payments.filter((p) => p.state === 'review').length;
  return (
    <ToastProvider>
      <div className="mx-auto min-h-screen max-w-xl pb-24">
        <div className="bg-navy px-4 py-1.5 text-center text-xs text-gold">Prototype. Sample data, not real shops.</div>
        <header className="px-4 pb-1 pt-4">
          <h1 className="text-2xl font-bold tracking-tight">Cadence</h1>
          <p className="text-sm text-navy/60">Friendly reminders, one-tap payments and automatic matching.</p>
        </header>
        <main className="px-4 py-3"><Screen /></main>
      </div>
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
    </ToastProvider>
  );
}
