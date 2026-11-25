import type { State } from '../types';
import { balance } from './matching';
import { daysOverdue } from './format';
import type { SessionEntry } from './sessions';

export type CadenceCommand =
  | { type: 'navigate'; tab: 'owner' | 'accountant' | 'shop' | 'matching' }
  | { type: 'filter_aging'; bucket: '0-30' | '31-60' | '60+' }
  | { type: 'draft_reminder'; shopName: string; lang: 'en' | 'hi' | 'kn'; tone?: 'friendly' | 'firm' | 'festival' }
  | { type: 'upsert_invoice'; shop: string; invoiceNo: string; invoiceDate: string; dueDate: string; amount: number }
  | { type: 'run_match' }
  | { type: 'summarize' }
  | { type: 'record_payment'; shop: string; amount: number; method: 'cash' | 'upi' | 'bank' }
  | { type: 'business_insights' }
  | { type: 'switch_model'; model: string };

export interface CadenceAgentResponse {
  success: boolean;
  offline?: boolean;
  reply: string;
  commands: CadenceCommand[];
  model?: string;
  switchedModel?: string;
  durationMs?: number;
}

export const GROQ_MODELS = [
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Ultra-fast ~500 t/s)' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Flagship Reasoning)' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Multilingual)' },
] as const;

/** Compact ledger snapshot sent to the agent so it reasons over real data. */
export function buildContext(state: State) {
  const shops = state.shops.map((s) => {
    const open = state.invoices.filter((i) => i.shop === s.name && balance(i) > 0);
    const outstanding = open.reduce((a, i) => a + balance(i), 0);
    return {
      name: s.name,
      status: s.status,
      outstanding,
      oldestDueDays: open.length ? Math.max(...open.map((i) => daysOverdue(i.due))) : 0,
      openBills: open.length,
      promisedDate: s.promised || undefined,
      reminded: s.reminded || false,
      askedCall: s.askedCall || false,
    };
  });

  const totalOutstanding = shops.reduce((a, s) => a + s.outstanding, 0);
  const collectedToday = state.payments
    .filter((p) => p.state === 'matched' || p.state === 'confirmed')
    .reduce((a, p) => a + p.amount, 0);
  const recoveryRate = totalOutstanding > 0
    ? Math.round((collectedToday / (collectedToday + totalOutstanding)) * 100)
    : 0;

  return {
    today: '2026-11-23',
    selectedShop: state.selectedShop || shops[0]?.name,
    language: state.lang,
    pendingPayments: state.payments.filter((p) => p.state === 'pending').length,
    reviewPayments: state.payments.filter((p) => p.state === 'review').length,
    totalOutstanding,
    collectedToday,
    recoveryRate,
    shops,
    activeModel: typeof localStorage !== 'undefined' ? localStorage.getItem('cadence_ai_model') || 'openai/gpt-oss-20b' : 'openai/gpt-oss-20b',
  };
}

/** Build a compact conversation history from the session entries for multi-turn memory. */
export function buildHistory(entries: SessionEntry[], maxTurns = 6): { role: 'user' | 'assistant'; content: string }[] {
  const recent = entries.slice(-maxTurns);
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const e of recent) {
    history.push({ role: 'user', content: e.prompt });
    history.push({ role: 'assistant', content: e.reply });
  }
  return history;
}

export async function askCadence(params: {
  prompt: string;
  state: State;
  model?: string;
  history?: SessionEntry[];
}): Promise<CadenceAgentResponse | null> {
  try {
    const res = await fetch('/api/cadence/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        context: buildContext(params.state),
        model: params.model,
        history: params.history ? buildHistory(params.history) : [],
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
