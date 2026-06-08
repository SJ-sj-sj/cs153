# NuMEDi 💊

**Smarter supplements, safer medications.**
Check interactions, get personalized timing, and earn rewards for staying on track — for everything you take.

NuMEDi is an AI-powered platform that checks supplement and medication interactions, recommends optimal intake timing, and turns daily adherence into a rewards loop. Built for people who manage complex supplement and medication routines — starting with weightlifters and dieters who often stack five or six products daily.

---

## The Problem & Insight

Built by a licensed pharmacist who repeatedly saw the same gap: people combine supplements and prescription medications with little awareness of how they interact (e.g., calcium blocking iron absorption, or supplements interfering with prescription drugs). And even when people know what to take, **adherence** — taking it consistently and at the right time — is where most of the health benefit is won or lost.

NuMEDi addresses both: it makes interactions and timing clear, and it turns consistency into a loyalty loop, so staying healthy also saves users money.

---

## Features

- **Interaction Checker** — Enter supplements and prescription medications; the engine analyzes pairwise combinations and returns color-coded results (Dangerous / Caution / Minor / Beneficial) with plain-language explanations.
- **Optimal Timing Engine** — Generates a personalized daily schedule (morning / afternoon / evening / bedtime), including food and spacing rules (e.g., "Iron on an empty stomach, away from calcium"; "Magnesium at bedtime").
- **Adherence Tracker** — Daily check-in with a streak counter and a calendar view of your history.
- **Reminders** — Set daily reminders, including at the AI-recommended times for each item.
- **Rewards Loop** — Consistent check-ins build toward rewards that translate into discounts.

---

## How It Works (Architecture)

- **Frontend:** React + Vite
- **Backend / Data:** Supabase
- **AI layer:** Interaction and timing analysis runs **server-side** via a server function, so the API key is never exposed to the browser. It calls **Claude (`anthropic/claude-sonnet-4-5`) via OpenRouter** to reason over ingredient combinations in natural language.

---

## Running Locally

1. Clone the repo:

```
   git clone https://github.com/SJ-sj-sj/NuMedi.git
   cd NuMedi
```

2. Install dependencies:

```
   bun install
```

3. Add your API key. Create a `.env` file (or edit the existing one) and set:

```
   OPENROUTER_API_KEY=your-openrouter-api-key-here
```

   > `.env` is gitignored — never commit your real key.

4. Run the dev server:

```
   bun run dev
```

   Then open `http://localhost:8080` in your browser.

---

## Evaluation & Limitations

This is an honest account of what's validated and what isn't:

- **Current approach:** Interaction analysis runs on Claude's reasoning, not a hardcoded clinical database.
- **Validation:** Outputs were spot-checked by a licensed pharmacist against well-established interactions (e.g., calcium–iron, levothyroxine timing) and held up. The app is designed to **flag uncertainty rather than invent interactions**, and always shows a disclaimer to consult a healthcare professional.
- **Known limitation:** LLM reasoning can be incomplete or wrong, especially for rare combinations. NuMEDi is **informational only and not a substitute for a pharmacist or physician.**
- **Next step:** Integrate NIH's **DSLD** (free; for ingredient normalization) and **DrugBank** (under academic/commercial license; for verified interaction data) so the AI reasons on top of authoritative sources rather than from memory alone.

---

## AI Usage Disclosure

In the spirit of the course, AI tools were used heavily and are disclosed here:

- **Claude Code** — primary development agent; built the initial single-file prototype and later rewired the AI layer and secured API keys.
- **Lovable** — used to scaffold the full React + Supabase application structure after the single-file prototype hit scaling limits.
- **Claude (via OpenRouter)** — powers the runtime interaction/timing analysis inside the app.

**Development path:** Started with a working single-file HTML prototype in Claude Code → moved to Lovable to scaffold a proper React/Supabase app → brought it back into Claude Code to switch the AI layer from the default provider to OpenRouter (`anthropic/claude-sonnet-4-5`) and to secure keys via `.env` + `.gitignore`. Commit history reflects this progression.

---

## Disclaimer

NuMEDi is for informational purposes only and does not constitute medical advice. Always consult a licensed pharmacist or physician before changing your supplement or medication routine.
