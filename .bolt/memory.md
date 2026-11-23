# Project memory

## Product intent & audience

- AI-powered app using Groq LPU as the LLM backend via an Express API server.
- Express server on port 3001 serves API routes; Vite dev server serves the frontend and proxies `/api` to it.
- `/api/health` endpoint reports Groq connectivity status and active model.

## Brand personality & voice

- Not yet inferred.

## Visual design & UX direction

- Status pill indicator in UI: green + "Groq LPU" label when connected; "Offline Prototype" when not connected.
- Pill reflects backend connection state in real time.

## Decisions, constraints & rationale

- Default `dev` script set to `dev:all` so Vite and Express start together (concurrent run).
- Vite proxies `/api` requests to `http://localhost:3001`.
- `.env` file required with `GROQ_API_KEY`; `.env.example` provided as template.
- Assistant environment blocks long-running dev servers; the preview panel manages its own server process.

## Open questions & assumptions

- No `.env` exists yet; user must create one with a Groq API key from console.groq.com/keys.
- Exact Groq models used and any API routes beyond `/api/health` not yet confirmed.
- Production deployment strategy for the Express server is undecided.