import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const viteOrigin = process.env.VITE_DEV_ORIGIN || 'http://localhost:5173';
const groqApiKey = process.env.GROQ_API_KEY || '';
const defaultModel = process.env.DEFAULT_MODEL || 'openai/gpt-oss-20b';

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// In dev, non-/api requests hitting this port (e.g. from the preview panel) are
// forwarded to the Vite dev server so the frontend renders instead of "Cannot GET /".
const viteProxy = isProd ? null : createProxyMiddleware({
  target: viteOrigin,
  changeOrigin: true,
  ws: true,
  onError: (_err, _req, res) => {
    res.statusCode = 502;
    res.end('Vite dev server is not running on ' + viteOrigin);
  },
});

app.use(cors());
if (isProd) {
  app.use(express.static(path.resolve(__dirname, '../dist')));
} else {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    viteProxy!(req, res, next);
  });
}
app.use(express.json());

// 1. Health check & status
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    groqConnected: !!groq,
    activeModel: defaultModel,
    availableModels: [
      { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Ultra-fast ~500 t/s)' },
      { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Flagship Reasoning)' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Multilingual)' },
    ],
  });
});

// 2. Generate personalized WhatsApp reminder
app.post('/api/ai/reminder', async (req, res) => {
  const {
    shopName,
    invoiceNo,
    amount,
    dueDate,
    daysOverdue = 0,
    lang = 'en',
    tone = 'friendly',
    model = defaultModel,
  } = req.body;

  if (!groq) {
    return res.status(503).json({ error: 'Groq API key not configured' });
  }

  const startTime = Date.now();

  const langInstruction =
    lang === 'hi'
      ? 'Output purely in Hindi (Devanagari script). Use natural, respectful Indian business Hindi appropriate for talking to a Kirana shopkeeper.'
      : lang === 'kn'
      ? 'Output purely in Kannada script. Use polite, respectful local business phrasing for a Karnataka FMCG retailer.'
      : 'Output in clear, warm Indian English.';

  const toneInstruction =
    tone === 'firm'
      ? 'Tone: Firm yet professional, emphasizing that the credit cycle is overdue and new stock delivery requires bill clearance.'
      : tone === 'festival'
      ? 'Tone: Festive and warm (mention festive season/Diwali blessings), politely requesting account clearance for seamless deliveries.'
      : 'Tone: Warm, friendly, respectful partnership tone.';

  const systemPrompt = `You are the automated WhatsApp assistant for "ABC Distributors (sample)", a leading FMCG distributor in India.
Your job is to compose a short (2-3 sentences), warm, and effective WhatsApp payment reminder for a shopkeeper.

Rules:
1. Always state the shop name ("${shopName}"), the invoice number ("${invoiceNo}"), the exact amount ("₹${Number(amount).toLocaleString('en-IN')}"), and the due date ("${dueDate}").
2. Mention that payment can be made with 1 tap via UPI QR code.
3. Sign off as "- ABC Distributors (sample)".
4. Do NOT include markdown bold asterisks or greeting headings—just the pure message ready to send on WhatsApp.
5. ${langInstruction}
6. ${toneInstruction}
${daysOverdue > 0 ? `The bill is ${daysOverdue} days overdue.` : 'The bill is due soon.'}`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate the WhatsApp reminder for ${shopName}.` },
      ],
      temperature: 0.6,
      max_tokens: 800,
    });

    const durationMs = Date.now() - startTime;
    const message = completion.choices[0]?.message?.content?.trim() || '';

    res.json({
      success: true,
      message,
      model,
      durationMs,
      tokensUsed: completion.usage?.total_tokens || 0,
    });
  } catch (err: any) {
    console.error('Groq Reminder API Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate reminder' });
  }
});

// 3. Intelligent payment narration matching
app.post('/api/ai/match', async (req, res) => {
  const { payment, openInvoices = [], model = 'openai/gpt-oss-120b' } = req.body;

  if (!groq) {
    return res.status(503).json({ error: 'Groq API key not configured' });
  }

  const startTime = Date.now();

  const prompt = `You are an expert FMCG accounting AI for an Indian distributor.
Analyze this incoming UPI / bank payment and match it to the most probable customer and open bill:

INCOMING PAYMENT:
- Payer Name / Remark: "${payment.payer}"
- Amount: ₹${payment.amount}
- UPI Ref: "${payment.ref}"

OPEN INVOICES:
${openInvoices
  .map(
    (inv: any) =>
      `- Bill #${inv.no} | Shop: "${inv.shop}" | Balance Due: ₹${inv.amount - (inv.paid || 0)} | Due Date: ${inv.due}`
  )
  .join('\n')}

Task:
Analyze if the payer name resembles any shop (even with abbreviations like "Ganesh P." for "Ganesh Provisions" or proprietor names like "Sri Venkateshwara" paying for a partner shop), and whether the amount matches an exact invoice balance or a combination of oldest bills.

Return your analysis strictly as valid JSON in this exact structure:
{
  "matchedShop": "<exact shop name from list or null if completely unknown>",
  "matchedInvoiceNo": "<bill number or null>",
  "confidence": <number between 0 and 100>,
  "matchType": "exact" | "name_heuristics" | "unclear_needs_human",
  "reasoning": "<concise 1-sentence explanation of why this was matched or why human review is required>"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a financial reconciliation AI that outputs strictly valid JSON without any markdown formatting or commentary.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const durationMs = Date.now() - startTime;
    const rawContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent);

    res.json({
      success: true,
      result: parsed,
      model,
      durationMs,
    });
  } catch (err: any) {
    console.error('Groq Matching API Error:', err);
    res.status(500).json({ error: err.message || 'Failed to match payment' });
  }
});

// 4. Voice note promise extractor (Simulated Kirana WhatsApp Voice Note)
app.post('/api/ai/voice-promise', async (req, res) => {
  const { voiceText, model = defaultModel } = req.body;

  if (!groq) {
    return res.status(503).json({ error: 'Groq API key not configured' });
  }

  const prompt = `A Kirana shopkeeper sent this voice message regarding pending payment:
"${voiceText}"

Extract:
1. The shopkeeper's intent
2. Any promised payment date (convert relative dates like "next Tuesday", "coming Friday", "28th" relative to today 2026-11-23 into ISO YYYY-MM-DD format).
3. Any promised partial or full amount mentioned.
4. Professional English summary for the distributor's accountant.

Output strictly as JSON:
{
  "promisedDate": "YYYY-MM-DD" or null,
  "promisedAmount": number or null,
  "intent": "promise_date" | "asking_extension" | "dispute_bill" | "call_request",
  "summary": "1 sentence summary"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an FMCG voice note analysis AI that outputs strictly JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    res.json({ success: true, result: parsed, model });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Cadence agent: interprets a natural-language prompt against ledger context
// and returns structured commands the frontend executes (navigate, filter, draft, upsert,
// record_payment, business_insights, switch_model).
type CadenceCommand =
  | { type: 'navigate'; tab: 'owner' | 'accountant' | 'shop' | 'matching' }
  | { type: 'filter_aging'; bucket: '0-30' | '31-60' | '60+' }
  | { type: 'draft_reminder'; shopName: string; lang: 'en' | 'hi' | 'kn'; tone?: 'friendly' | 'firm' | 'festival' }
  | { type: 'upsert_invoice'; shop: string; invoiceNo: string; invoiceDate: string; dueDate: string; amount: number }
  | { type: 'run_match' }
  | { type: 'summarize' }
  | { type: 'record_payment'; shop: string; amount: number; method: 'cash' | 'upi' | 'bank' }
  | { type: 'business_insights' }
  | { type: 'switch_model'; model: string };

const VALID_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];

const CADENCE_SYSTEM_PROMPT = `You are Cadence, an intelligent Indian retail finance advisor embedded in an FMCG distributor's collections dashboard.

PERSONA — You are NOT a generic chatbot. You are a sharp, street-smart Indian collections advisor who thinks in ₹ figures, overdue days, and risk buckets. You talk like a seasoned credit manager who has worked with kirana stores, provisions shops, and agency distributors across India. You use terms like "credit cycle", "outstanding", "recovery rate", "follow-up", "due date", "overdue" naturally.

VOICE RULES:
- ALWAYS include concrete ₹ figures in your reply (e.g., "₹1,80,000 outstanding across 3 bills").
- ALWAYS mention overdue day counts when relevant (e.g., "53 days overdue — well past the 30-day credit cycle").
- ALWAYS give a clear next-step recommendation (e.g., "Send a firm reminder today, this account is high-risk").
- For questions about "who owes the most", rank shops by outstanding amount and mention the top accounts.
- For follow-up questions (e.g., "draft a reminder for them"), use conversation history to resolve "them" to the exact shop name.
- Keep replies to 1-3 sentences. Be specific and actionable, not generic.
- NEVER say things like "Sure, taking you to the shop section." Instead say WHY: "Ganesh Provisions has ₹1,20,000 across 2 bills, 41 days overdue — let me pull up their account so you can follow up."

LEDGER CONTEXT is provided with each prompt — it contains: today's date, all shops with their outstanding amounts, overdue days, open bill counts, status, promised dates, total outstanding, collected today, recovery rate, pending payments, and the active model.

Available commands (use only these shapes):
{"type":"navigate","tab":"owner"|"accountant"|"shop"|"matching"}
{"type":"filter_aging","bucket":"0-30"|"31-60"|"60+"}
{"type":"draft_reminder","shopName":"<exact shop name from context>","lang":"en"|"hi"|"kn","tone":"friendly"|"firm"|"festival"}
{"type":"upsert_invoice","shop":"<shop name>","invoiceNo":"<no>","invoiceDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD","amount":<number>}
{"type":"run_match"}
{"type":"summarize"}
{"type":"record_payment","shop":"<exact shop name>","amount":<number>,"method":"cash"|"upi"|"bank"}
{"type":"business_insights"}
{"type":"switch_model","model":"openai/gpt-oss-20b"|"openai/gpt-oss-120b"|"qwen/qwen3.8-27b"}

TOOL GUIDE:
- "Pull 60+ day dues" / aging questions => navigate owner + filter_aging 60+
- "Who owes the most?" / "biggest dues" => business_insights (ranks top overdue accounts)
- "Record payment" / "got ₹X from <shop>" / "received payment" => record_payment with the shop name and amount parsed from the prompt
- "Risk briefing" / "collection briefing" / "daily recovery" => business_insights
- "Draft reminder for them" / "send reminder" => draft_reminder with the best-matching shop (resolve "them" from conversation history). Kannada => kn, Hindi => hi, English => en.
- "Add invoice" / "new bill" => upsert_invoice with parsed details. If details are incomplete, ask for them in the reply and do NOT issue the command.
- "Match payments" / "reconcile" => navigate matching + run_match
- "Switch to <model>" / "use gpt-oss-120b" / "switch model" => switch_model with the matching model ID
- "Summary" / "how's the book" / "snapshot" => summarize
- For pure questions with no action needed, reply with the analysis and include "summarize" or "business_insights" so the user sees live data.

RULES:
- Today is 2026-11-23. Resolve relative dates against it.
- Use conversation history to resolve pronouns and references ("them", "that shop", "the biggest one").
- Keep commands minimal and ordered. Include at most one navigate per response.
- Amount must be a plain number (e.g., 60000, not "₹60,000").

Return STRICT JSON:
{"reply": "<your advisor response with concrete ₹ figures and next steps>", "commands": [<list of commands>]}`;

app.post('/api/cadence/agent', async (req, res) => {
  const { prompt = '', context = {}, model = defaultModel, history = [] } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ error: 'prompt is required' });

  // Deterministic offline fallback: keyword routing when Groq is not configured.
  if (!groq) {
    const p = prompt.toLowerCase();
    const cmds: CadenceCommand[] = [];
    const selectedShop = context.selectedShop || 'Lakshmi Stores';
    let reply = 'Offline mode — I used a built-in fallback interpreter (no Groq key configured). ';
    if (/60|old|age|aging|oldest/.test(p)) {
      cmds.push({ type: 'navigate', tab: 'owner' }, { type: 'filter_aging', bucket: '60+' });
      reply += `Showing 60+ day overdue bills. ${context.totalOutstanding ? `Total outstanding is ₹${context.totalOutstanding.toLocaleString('en-IN')}.` : ''}`;
    } else if (/record|received|got.*payment|payment.*from/.test(p)) {
      const amtMatch = p.match(/₹?\s*(\d[\d,]*)/);
      const amt = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 0;
      if (amt > 0 && selectedShop) {
        cmds.push({ type: 'record_payment', shop: selectedShop, amount: amt, method: 'cash' });
        reply += `Recorded ₹${amt.toLocaleString('en-IN')} payment from ${selectedShop}. The Owner pillars will update live.`;
      } else {
        reply += 'Which shop and how much? Tell me the shop name and amount.';
      }
    } else if (/insight|risk|briefing|recovery|who owes|biggest|top/.test(p)) {
      cmds.push({ type: 'business_insights' });
      reply += `Generating a risk briefing. Recovery rate is ${context.recoveryRate || 0}%.`;
    } else if (/switch.*model|use.*gpt|use.*qwen|change.*model/.test(p)) {
      if (/120b/.test(p)) { cmds.push({ type: 'switch_model', model: 'openai/gpt-oss-120b' }); reply += 'Switching to GPT-OSS 120B for deeper reasoning.'; }
      else if (/qwen/.test(p)) { cmds.push({ type: 'switch_model', model: 'qwen/qwen3.8-27b' }); reply += 'Switching to Qwen 3.8 27B for multilingual support.'; }
      else { cmds.push({ type: 'switch_model', model: 'openai/gpt-oss-20b' }); reply += 'Switching to GPT-OSS 20B for ultra-fast responses.'; }
    } else if (/match|payment|reconcil/.test(p)) {
      cmds.push({ type: 'navigate', tab: 'matching' }, { type: 'run_match' });
      reply += `Running auto-match on ${context.pendingPayments || 0} pending payment(s).`;
    } else if (/kannada|kn/.test(p)) {
      cmds.push({ type: 'draft_reminder', shopName: selectedShop, lang: 'kn' });
      reply += `Drafting a Kannada reminder for ${selectedShop}.`;
    } else if (/reminder|draft|whatsapp|message/.test(p)) {
      cmds.push({ type: 'draft_reminder', shopName: selectedShop, lang: 'en' });
      reply += `Drafting a WhatsApp reminder for ${selectedShop}.`;
    } else if (/add|new invoice|create.*bill/.test(p)) {
      cmds.push({ type: 'navigate', tab: 'accountant' }, { type: 'summarize' });
      reply += 'Head to the Accountant tab to add the invoice. Give me the shop, bill number, amount, and due date to create it directly.';
    } else {
      cmds.push({ type: 'summarize' });
      reply += `Total outstanding is ₹${(context.totalOutstanding || 0).toLocaleString('en-IN')} with ${context.pendingPayments || 0} payments pending matching.`;
    }
    return res.json({ success: true, offline: true, reply, commands: cmds, model });
  }

  const startTime = Date.now();
  const useModel = VALID_MODELS.includes(model) ? model : defaultModel;

  // Build messages array: system prompt + conversation history + current turn
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: CADENCE_SYSTEM_PROMPT },
  ];

  // Add multi-turn conversation history (compact: just the text exchanges)
  if (Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      if (h && h.role && h.content) {
        messages.push({ role: h.role as 'user' | 'assistant', content: h.content });
      }
    }
  }

  // Current turn with full ledger context
  messages.push({
    role: 'user',
    content: `LEDGER CONTEXT:\n${JSON.stringify(context)}\n\nUSER PROMPT: ${prompt}`,
  });

  try {
    const completion = await groq.chat.completions.create({
      model: useModel,
      messages,
      temperature: 0.25,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');

    // Handle switch_model: validate the model and echo it back
    let switchedModel: string | undefined;
    const commands: CadenceCommand[] = Array.isArray(parsed.commands) ? parsed.commands : [];
    const switchCmd = commands.find((c: any) => c.type === 'switch_model');
    if (switchCmd && VALID_MODELS.includes((switchCmd as any).model)) {
      switchedModel = (switchCmd as any).model;
    }

    res.json({
      success: true,
      offline: false,
      reply: parsed.reply || 'Done.',
      commands,
      model: useModel,
      switchedModel,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('Cadence Agent API Error:', err);
    res.status(500).json({ error: err.message || 'Cadence agent failed' });
  }
});

if (isProd) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.resolve(__dirname, '../dist/index.html'));
  });
}

const server = app.listen(port, () => {
  console.log(`⚡ Cadence Groq AI Backend running on http://localhost:${port}`);
  console.log(`↪ Frontend requests proxied to Vite at ${viteOrigin}`);
});

// Vite HMR websocket upgrades arrive on this port when previewing through it.
server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/api')) return socket.destroy();
  viteProxy.upgrade?.(req, socket, head);
});
