import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CadenceWorkspace from './CadenceWorkspace';

const genieVariants = {
  initial: {
    opacity: 0,
    scaleX: 0.02,
    scaleY: 0.02,
    y: '42vh',
    x: '42vw',
    borderRadius: '9999px',
  },
  animate: {
    opacity: 1,
    scaleX: 1,
    scaleY: 1,
    y: 0,
    x: 0,
    borderRadius: '0px',
    transition: { type: 'spring' as const, stiffness: 200, damping: 26, mass: 0.9 },
  },
  exit: {
    opacity: 0,
    scaleX: 0.02,
    scaleY: 0.02,
    y: '42vh',
    x: '42vw',
    borderRadius: '9999px',
    transition: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 0.8 },
  },
};

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2, delay: 0.15 } },
};

export default function CadenceAgent({ onNavigate }: { tab: number; onNavigate: (k: number) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="glass fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white lg:bottom-6 lg:right-6 glow-cyan"
      >
        <span className="text-base">✦</span> Ask Cadence
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="cadence-overlay"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 bg-obsidian-900/95 backdrop-blur-md"
          >
            <motion.div
              key="cadence-panel"
              variants={genieVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ transformOrigin: 'bottom right' }}
              className="absolute inset-0 overflow-hidden bg-obsidian-900"
            >
              <CadenceWorkspace onNavigate={onNavigate} onBack={() => setOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
