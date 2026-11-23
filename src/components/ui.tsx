import { ReactNode, createContext, useCallback, useContext, useState } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#E3D7BC] bg-white p-4 ${className}`}>{children}</div>;
}

export function Chip({ text }: { text: string }) {
  const t = text.toLowerCase();
  const cls = t.startsWith('paid') || t.startsWith('payment') || t.startsWith('matched') ? 'bg-green-100 text-green-800'
    : t.startsWith('promised') || t.startsWith('needs') ? 'bg-amber-100 text-amber-800'
    : t.startsWith('asked') || t.startsWith('no reply') ? 'bg-red-100 text-red-800'
    : 'bg-slate-100 text-slate-700';
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}

export function Button({ children, onClick, kind = 'primary', disabled, className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'gold'; disabled?: boolean; className?: string }) {
  const k = kind === 'primary' ? 'bg-navy text-white' : kind === 'gold' ? 'bg-gold text-navy' : 'border border-navy/30 bg-white text-navy';
  return <button disabled={disabled} onClick={onClick} className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40 ${k} ${className}`}>{children}</button>;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="rounded-full px-3 py-1 text-xl leading-none text-navy/60">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const show = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2200); }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-navy px-5 py-2 text-sm text-white shadow-lg">{msg}</div>}
    </ToastCtx.Provider>
  );
}
