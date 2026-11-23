import type { State } from '../types';
import { balance } from './matching';
import { daysOverdue } from './format';

export type CadenceCommand =
  | { type: 'navigate'; tab: 'owner' | 'accountant' | 'shop' | 'matching' }
  | { type: 'filter_aging'; bucket: '0-30' | '31-60' | '60+' }
  | { type: 'draft_reminder'; shopName: string; lang: 'en' | 'hi' | 'kn'; tone?: 'friendly' | 'firm' | 'festival' }
  | { type: 'upsert_invoice'; shop: string; invoiceNo: string; invoiceDate: string; dueDate: string; amount: number }
  | { type: 'run_match' }
  | { type: 'summarize' };

export interface CadenceAgentResponse {
  success: boolean;
  offline?: boolean;
  reply: string;
  commands: CadenceCommand[];
  model?: string;
  durationMs?: number;
}

/** Compact ledger snapshot sent to the agent so it reasons over real data. */
export function buildContext(state: State) {
  const shops = state.shops.map((s) => {
    const open = state.invoices.filter((i) => i.shop === s.name && balance(i) > 0);
    return {
      name: s.name,
      status: s.status,
      outstanding: open.reduce((a, i) => a + balance(i), 0),
      oldestDueDays: open.length ? Math.max(...open.map((i) => daysOverdue(i.due))) : 0,
    };
  });
  return {
    today: '2026-11-23',
    selectedShop: state.selectedShop || shops[0]?.name,
    language: state.lang,
    pendingPayments: state.payments.filter((p) => p.state === 'pending').length,
    reviewPayments: state.payments.filter((p) => p.state === 'review').length,
    shops,
  };
}

export async function askCadence(params: { prompt: string; state: State; model?: string }): Promise<CadenceAgentResponse | null> {
  try {
    const res = await fetch('/api/cadence/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: params.prompt, context: buildContext(params.state), model: params.model }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
