# Cadence prototype

Friendly reminders, one-tap payments and automatic matching for FMCG distributors.
A front-end prototype for the SIDT (CS1929) project, RV University Mysuru.

## Run it
- **Full Stack with Groq AI**: `npm run dev:all` (runs Groq backend on :3001 and Vite frontend on :5173).
- **Frontend only**: `npm run dev`.
- **Quick look**: double-click `Cadence_Prototype.html` (works offline, nothing to install).
- **Tests**: `npm test`. Single-file build: `npm run build` (output in `dist/index.html`).

## Groq LPU Backend
Cadence features a live Express backend powered by **Groq LPU** inference (`server/index.ts`):
- `POST /api/ai/reminder`: Generates contextually warm WhatsApp reminders in Hindi, Kannada, and English with tone selection (Friendly, Firm, Festive) in ~200ms using `openai/gpt-oss-20b`.
- `POST /api/ai/match`: Dissects ambiguous bank/UPI payment remarks and matches them to open bills with confidence scores and reasoning using `openai/gpt-oss-120b`.
- `POST /api/ai/voice-promise`: Understands simulated Kirana shopkeeper Hindi voice notes and extracts promised dates and amounts into the Call-first list.
- You can toggle between models on the fly in the header (*Groq LPU pill*).

## Four screens
1. **Owner**: outstanding money by age, collected today, who to follow up first.
2. **Accountant**: "Call first" list. Tap a shop to see its bills, send a reminder, or log cash. "Import from Tally" reads a CSV (`public/tally_sample.csv`). The cadence panel is display only.
3. **Shop** (simulated WhatsApp): the message a shopkeeper sees in English, Hindi or Kannada, with Pay with UPI (sample QR), I will pay on a date, and Please call me.
4. **Matching**: incoming UPI payments matched to bills automatically.

## 5-step demo (about 2 minutes)
1. **Owner:** show the one-screen picture (Rs 48.6 L outstanding, ageing bars).
2. **Accountant:** open the top shop, tap *Send reminder*.
3. **Shop:** show the message, switch to Hindi, tap *Pay with UPI*, then *Simulate payment received*.
4. **Matching:** tap *Run auto-match*. Four payments match by themselves; the rest say "Needs a person". Pick a shop and bill, then *Confirm match*.
5. **Owner:** outstanding has dropped and collected today has gone up.

Tip: run auto-match once *before* simulating a Shop payment, or the sample payment for the same shop will show as a repeat and ask for a person.

## Matching rules (src/lib/matching.ts)
a) Amount equals the balance of exactly one open bill: matched.
b) Payer name resembles a shop and the amount equals the sum of that shop's oldest bills: matched.
c) Anything else goes to a person.

## What is simulated
No backend, no real UPI payment, no real WhatsApp message, no live Tally link. All data is sample data kept in the browser (localStorage). "Today" is fixed to 23 Nov 2026 so the demo always looks the same. Hindi and Kannada texts are short drafts and should be checked by a native speaker. Owner totals include a fixed amount for "other customers" so they read like a real book.
Decisions made without asking: Tailwind v3, Vite 5, React 18, `qrcode.react` for the QR code, shops that promised a date move down the Call-first list, and "Please call me" moves a shop to the top.
