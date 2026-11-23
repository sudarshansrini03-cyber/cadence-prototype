import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const viteOrigin = process.env.VITE_DEV_ORIGIN || 'http://localhost:5173';
const groqApiKey = process.env.GROQ_API_KEY || '';
const defaultModel = process.env.DEFAULT_MODEL || 'openai/gpt-oss-20b';

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// In dev, non-/api requests hitting this port (e.g. from the preview panel) are
// forwarded to the Vite dev server so the frontend renders instead of "Cannot GET /".
const viteProxy = createProxyMiddleware({
  target: viteOrigin,
  changeOrigin: true,
  ws: true,
  onError: (_err, _req, res) => {
    res.statusCode = 502;
    res.end('Vite dev server is not running on ' + viteOrigin);
  },
});

app.use(cors());
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
  viteProxy(req, res, next);
});
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
// and returns structured commands the frontend executes (navigate, filter, draft, upsert).
type CadenceCommand =
  | { type: 'navigate'; tab: 'owner' | 'accountant' | 'shop' | 'matching' }
  | { type: 'filter_aging'; bucket: '0-30' | '31-60' | '60+' }
  | { type: 'draft_reminder'; shopName: string; lang: 'en' | 'hi' | 'kn'; tone?: 'friendly' | 'firm' | 'festival' }
  | { type: 'upsert_invoice'; shop: string; invoiceNo: string; invoiceDate: string; dueDate: string; amount: number }
  | { type: 'run_match' }
  | { type: 'summarize' };

app.post('/api/cadence/agent', async (req, res) => {
  const { prompt = '', context = {}, model = defaultModel } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ error: 'prompt is required' });

  // Deterministic offline fallback: keyword routing when Groq is not configured.
  if (!groq) {
    const p = prompt.toLowerCase();
    const cmds: CadenceCommand[] = [];
    if (/60|old|age|aging|oldest/.test(p)) cmds.push({ type: 'navigate', tab: 'owner' }, { type: 'filter_aging', bucket: '60+' });
    else if (/match|payment|reconcil/.test(p)) cmds.push({ type: 'navigate', tab: 'matching' }, { type: 'run_match' });
    else if (/kannada|kn/.test(p)) cmds.push({ type: 'draft_reminder', shopName: context.selectedShop || 'Lakshmi Stores', lang: 'kn' });
    else if (/reminder|draft|whatsapp|message/.test(p)) cmds.push({ type: 'draft_reminder', shopName: context.selectedShop || 'Lakshmi Stores', lang: 'en' });
    else if (/add|new invoice|create/.test(p)) cmds.push({ type: 'navigate', tab: 'accountant' }, { type: 'summarize' });
    else cmds.push({ type: 'summarize' });
    return res.json({ success: true, offline: true, reply: 'Offline mode: used a built-in fallback interpreter (no Groq key configured).', commands: cmds, model });
  }

  const startTime = Date.now();
  const systemPrompt = `You are Cadence, the command agent for an Indian FMCG distributor's collections dashboard.
Interpret the user's prompt against the ledger context and return STRICT JSON:
{"reply": "<1-2 sentence friendly answer or plan>", "commands": [<list of commands to execute>]}

Available commands (use only these shapes):
{"type":"navigate","tab":"owner"|"accountant"|"shop"|"matching"}
{"type":"filter_aging","bucket":"0-30"|"31-60"|"60+"}
{"type":"draft_reminder","shopName":"<exact shop name>","lang":"en"|"hi"|"kn","tone":"friendly"|"firm"|"festival"}
{"type":"upsert_invoice","shop":"<shop name>","invoiceNo":"<no>","invoiceDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD","amount":<number>}
{"type":"run_match"}
{"type":"summarize"}

Rules:
- Today is 2026-11-23. Resolve relative dates against it.
- "Pull 60+ day dues" style asks => navigate owner + filter_aging 60+.
- Reminder/draft asks => draft_reminder with the best-matching shop and language (Kannada => kn).
- Add/record invoice asks with complete details => upsert_invoice (amount as a plain number).
- "Match payments" => navigate matching + run_match.
- Keep commands minimal and ordered. If the prompt is just a question, reply and include "summarize".`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `LEDGER CONTEXT:\n${JSON.stringify(context)}\n\nUSER PROMPT: ${prompt}` },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    res.json({
      success: true,
      offline: false,
      reply: parsed.reply || 'Done.',
      commands: Array.isArray(parsed.commands) ? parsed.commands : [],
      model,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('Cadence Agent API Error:', err);
    res.status(500).json({ error: err.message || 'Cadence agent failed' });
  }
});

const server = app.listen(port, () => {
  console.log(`⚡ Cadence Groq AI Backend running on http://localhost:${port}`);
  console.log(`↪ Frontend requests proxied to Vite at ${viteOrigin}`);
});

// Vite HMR websocket upgrades arrive on this port when previewing through it.
server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/api')) return socket.destroy();
  viteProxy.upgrade?.(req, socket, head);
});
