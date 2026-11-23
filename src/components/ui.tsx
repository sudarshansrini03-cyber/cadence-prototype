import { ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl p-4 ${className}`}>{children}</div>;
}

/** Tactile 2.5D card: tilts toward the pointer with spring physics. */
export function TiltCard({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 260, damping: 22 });
  const ry = useSpring(useTransform(mx, [0, 1], [-7, 7]), { stiffness: 260, damping: 22 });
  const glareX = useTransform(mx, [0, 1], ['0%', '100%']);
  const glareY = useTransform(my, [0, 1], ['0%', '100%']);

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
      whileHover={{ scale: 1.01 }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', perspective: 900 }}
      className={`glass relative overflow-hidden rounded-2xl ${className}`}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(420px circle at ${'var(--gx)'} var(--gy), rgba(148,178,255,0.08), transparent 65%)`, ['--gx' as never]: glareX, ['--gy' as never]: glareY }}
      />
      {children}
    </motion.div>
  );
}

export function Chip({ text }: { text: string }) {
  const t = text.toLowerCase();
  const cls = t.startsWith('paid') || t.startsWith('payment') || t.startsWith('matched')
    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
    : t.startsWith('promised') || t.startsWith('needs')
      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
      : t.startsWith('asked') || t.startsWith('no reply')
        ? 'bg-red-500/15 text-red-300 border border-red-400/30'
        : 'bg-white/8 text-slate-300 border border-white/15';
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}

export function Button({ children, onClick, kind = 'primary', disabled, className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'gold'; disabled?: boolean; className?: string }) {
  const k = kind === 'primary'
    ? 'bg-emerald-500 text-obsidian-900 hover:bg-emerald-400 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)]'
    : kind === 'gold'
      ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-obsidian-900 hover:from-amber-200 hover:to-amber-400 shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)]'
      : 'border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10';
  return <button disabled={disabled} onClick={onClick} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${k} ${className}`}>{children}</button>;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="glass max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-obsidian-800/95 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="rounded-full px-3 py-1 text-xl leading-none text-slate-400 hover:text-white">&times;</button>
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
      {msg && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-medium text-white shadow-xl"
        >
          {msg}
        </motion.div>
      )}
    </ToastCtx.Provider>
  );
}
