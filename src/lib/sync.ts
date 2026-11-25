export type SyncMessage =
  | { kind: 'navigate'; tab: number }
  | { kind: 'addInvoice'; invoice: { no: string; shop: string; date: string; due: string; amount: number; paid: number } }
  | { kind: 'runMatch' };

const CHANNEL = 'cadence-sync';

export function getSyncChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  } catch {
    return null;
  }
}

export function sendSync(msg: SyncMessage): void {
  const ch = getSyncChannel();
  if (!ch) return;
  try { ch.postMessage(msg); } catch { /* ignore */ }
  setTimeout(() => { try { ch.close(); } catch { /* ignore */ } }, 500);
}
