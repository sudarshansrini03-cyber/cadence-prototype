export interface AIHealth {
  status: string;
  groqConnected: boolean;
  activeModel: string;
  availableModels: Array<{ id: string; name: string }>;
}

export interface AIReminderResponse {
  success: boolean;
  message: string;
  model: string;
  durationMs: number;
  tokensUsed: number;
}

export interface AIMatchResponse {
  success: boolean;
  result: {
    matchedShop: string | null;
    matchedInvoiceNo: string | null;
    confidence: number;
    matchType: 'exact' | 'name_heuristics' | 'unclear_needs_human';
    reasoning: string;
  };
  model: string;
  durationMs: number;
}

export interface AIVoicePromiseResponse {
  success: boolean;
  result: {
    promisedDate: string | null;
    promisedAmount: number | null;
    intent: string;
    summary: string;
  };
  model: string;
}

export async function checkAIHealth(): Promise<AIHealth | null> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateAIReminder(params: {
  shopName: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  lang: 'en' | 'hi' | 'kn';
  tone?: 'friendly' | 'firm' | 'festival';
  model?: string;
}): Promise<AIReminderResponse | null> {
  try {
    const res = await fetch('/api/ai/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function matchPaymentWithAI(params: {
  payment: { ref: string; payer: string; amount: number; time: string };
  openInvoices: any[];
  model?: string;
}): Promise<AIMatchResponse | null> {
  try {
    const res = await fetch('/api/ai/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function parseVoicePromiseWithAI(voiceText: string, model?: string): Promise<AIVoicePromiseResponse | null> {
  try {
    const res = await fetch('/api/ai/voice-promise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceText, model }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
