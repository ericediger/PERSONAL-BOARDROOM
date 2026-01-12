# CLAUDE.md — Personal Board of Directors

## Project Overview

This is a **Personal Board of Directors** application — a decision-support system that simulates a board meeting with AI personas. The user (Chair) submits structured memos, and a panel of AI advisors provides analysis, culminating in an integrated recommendation from the Supreme Strategist.

### Core Concept

- **You are the Chair.** You define the decision, provide context, and own the outcome.
- **6 AI Personas** act as your board: Supreme Strategist, Board Secretary, Operator, Finance Brain, Craft Expert, and Contrarian.
- **Every session** follows: Memo → Secretary Processing → Board Review → Strategist Synthesis → Decision Log.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL HTML FRONTEND                      │
│  (Static HTML + CSS + Vanilla JS)                           │
│  - board-memo.html (input form)                             │
│  - session-view.html (responses + synthesis)                │
│  - decision-log.html (history + search)                     │
│  - dashboard.html (overview)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL API SERVER                         │
│  (Node/Express or Python/FastAPI)                           │
│  - /api/sessions (CRUD)                                     │
│  - /api/sessions/:id/run (orchestration)                    │
│  - /api/decisions (log + search)                            │
│  - /api/personas (manage)                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      LLM ORCHESTRATOR                        │
│  - OpenAI GPT-5.2 Responses API                             │
│  - Reasoning effort: none → xhigh                           │
│  - Structured JSON output enforcement                       │
│  - Retry + rate limiting + caching                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL STORAGE (SQLite)                   │
│  Tables: personas, sessions, memos, responses,              │
│          decisions, actions, tags                           │
└─────────────────────────────────────────────────────────────┘
```

---

## The 6 Personas

| # | Persona | Role | Primary Output |
|---|---------|------|----------------|
| 1 | **Supreme Strategist** | Mentor. Clarifies first principles, reconciles competing advice, delivers integrated recommendation. | Single coherent decision + rationale + guardrails |
| 2 | **Board Secretary** | Chief of Staff. Enforces structure, normalizes input, maintains logs. | Clean briefing packet + synthesis-ready summaries |
| 3 | **The Operator** | COO. Converts decisions into sequences, dependencies, next-7-days steps. | Execution plan + risk controls |
| 4 | **Finance Brain** | CFO. Evaluates ROI, downside risk, opportunity cost, liquidity. | Financial framing + thresholds + do/don't guidance |
| 5 | **Craft Expert** | Domain Mentor. Improves approach quality within the Chair's domain. | Better method, sharper narrative |
| 6 | **The Contrarian** | Red Team. Assumes the plan is wrong. Identifies failure modes. | Pre-mortem + counter-proposal |

---

## Key Data Structures

### Board Memo (Input from Chair)

```json
{
  "id": "uuid",
  "session_id": "uuid",
  "created_at": "ISO8601",
  "category": "career | project | finance",
  "context": ["bullet1", "bullet2"],
  "decision_required": "One sentence describing what needs to be decided",
  "options": [
    {"id": "A", "description": "..."},
    {"id": "B", "description": "..."}
  ],
  "constraints": {
    "time": "string",
    "budget": "string",
    "politics": "string",
    "risk_tolerance": "low | medium | high"
  },
  "success_metrics": ["metric1", "metric2"],
  "questions_for_board": ["q1", "q2", "q3"],
  "attachments": ["optional notes or links"]
}
```

### Persona Response Schema

```json
{
  "persona_id": "string",
  "session_id": "uuid",
  "position": "Clear stance on the decision",
  "top_reasons": ["reason1", "reason2", "reason3"],
  "top_risks": ["risk1", "risk2"],
  "recommended_modifications": ["mod1", "mod2"],
  "validation_metrics": {
    "30_day": ["metric"],
    "90_day": ["metric"]
  },
  "confidence": "low | medium | high",
  "raw_analysis": "Optional extended reasoning"
}
```

### Strategist Synthesis Schema

```json
{
  "session_id": "uuid",
  "integrated_recommendation": {
    "decision": "Clear, unambiguous decision statement",
    "rationale": "Why this is the right call",
    "reversibility": "high | medium | low"
  },
  "agreement_areas": ["area1", "area2"],
  "disagreement_areas": ["area1"],
  "execution_guardrails": ["guardrail1", "guardrail2"],
  "pre_mortem": {
    "failure_modes": ["mode1", "mode2"],
    "mitigations": ["mitigation1", "mitigation2"]
  },
  "next_actions": [
    {"action": "string", "owner": "Chair", "due": "relative date"}
  ],
  "assumption_to_test": "The one assumption most worth validating",
  "decision_statement": "Reusable verbatim statement for the log"
}
```

---

## Orchestration Flow (`/api/sessions/:id/run`)

```
1. SECRETARY PHASE
   - Receive raw memo
   - Normalize and clean
   - Extract assumptions
   - Flag missing blocking info
   - Output: Standardized briefing packet

2. BOARD PHASE (parallel)
   - Send briefing packet to: Operator, Finance Brain, Craft Expert, Contrarian
   - Each returns structured PersonaResponse
   - Collect all responses

3. STRATEGIST PHASE
   - Receive: original memo + all board responses
   - Synthesize into integrated recommendation
   - Output: StrategistSynthesis

4. PERSIST
   - Save all responses to DB
   - Update session status to "complete"
```

---

## File Structure

```
personal-board/
├── CLAUDE.md                 # This file
├── BUILD.md                  # Local setup guide
├── config/
│   └── config.example.json   # API keys template (copy to config.json)
├── frontend/
│   ├── index.html            # Dashboard
│   ├── new-memo.html         # Board memo input form
│   ├── session-view.html     # View responses + synthesis
│   ├── decision-log.html     # History + search
│   ├── personas.html         # Persona library
│   ├── settings.html         # Configuration
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── api.js            # API client
│       ├── memo-form.js      # Form handling
│       └── session.js        # Session view logic
├── server/
│   ├── index.js              # Express entry point (or main.py for FastAPI)
│   ├── routes/
│   │   ├── sessions.js
│   │   ├── decisions.js
│   │   └── personas.js
│   ├── services/
│   │   ├── orchestrator.js   # Run the board meeting
│   │   └── llm-client.js     # LLM adapter interface
│   ├── prompts/
│   │   ├── secretary.txt
│   │   ├── operator.txt
│   │   ├── finance.txt
│   │   ├── craft-expert.txt
│   │   ├── contrarian.txt
│   │   └── strategist.txt
│   └── db/
│       ├── schema.sql
│       └── db.js             # SQLite wrapper
├── data/
│   └── board.db              # SQLite database (gitignored)
└── package.json              # (or requirements.txt)
```

---

## Development Guidelines

### When Writing Prompts

1. **Be specific about role boundaries.** Each persona has a lane; don't let them overlap.
2. **Enforce JSON output.** Use structured output / JSON mode. Include the schema in the prompt.
3. **No vague advice.** Every persona must provide actionable next steps.
4. **Citations to memo.** Personas should reference specific parts of the Chair's memo.
5. **Confidence levels.** Always require personas to state their confidence.

### When Writing Code

1. **Fail gracefully.** LLM calls can fail; always have retry logic and fallbacks.
2. **Token budgets.** Set max_tokens per persona to control costs.
3. **Cache aggressively.** Same memo shouldn't re-run personas unless explicitly requested.
4. **Keep frontend dumb.** All logic in the server; frontend just renders.
5. **No API keys in frontend.** Ever. All LLM calls go through your local server.

### Persona Voice Guidelines

| Persona | Tone | Avoid |
|---------|------|-------|
| Supreme Strategist | Calm, incisive, mentor-like. "If this is true, then…" | Verbosity, hedging, "it depends" without resolution |
| Secretary | Crisp, procedural, neutral | Opinions, recommendations |
| Operator | Direct, concrete, timeline-focused | Abstract strategy talk |
| Finance Brain | Quantitative, threshold-driven | Vague "it's expensive" |
| Craft Expert | Domain-deep, craft-proud | Generic advice |
| Contrarian | Skeptical, devil's advocate | Nihilism, unconstructive criticism |

---

## Decision Log Fields

Every finalized decision should capture:

| Field | Description |
|-------|-------------|
| `decision_id` | UUID |
| `session_id` | Link to the board session |
| `decision_date` | When finalized |
| `category` | career / project / finance |
| `decision_statement` | Verbatim from Strategist |
| `rationale` | Why this decision |
| `success_metrics` | How we'll know it worked |
| `review_date` | When to check back |
| `outcome` | (filled in later) actual result |
| `retrospective` | (filled in later) what we learned |
| `tags` | For search/filtering |

---

## Goals and Non-Goals

### Goals

- Produce **repeatable, high-quality decision support** across career, projects, and finances.
- Keep a **decision log** (context → decision → why → measures → outcome) to reduce rework.
- Make the experience feel like a "real board meeting": brief, structured, decisive.

### Non-Goals (MVP)

- Full autonomous agents operating without Chair's memo.
- Deep personal-data ingestion or "read my whole life" memory.
- Complex plugin ecosystems. Keep it simple and controllable.

---

## Milestones

1. **Foundations** — Finalize personas + schemas, memo templates, session/storage model
2. **MVP Board Meeting** — New Memo page, /run orchestration, Session View
3. **Decision Log** — Finalization flow, action list, searchable history
4. **Quality Controls** — Prompt tests, hallucination controls, cost controls
5. **Personalization** — Persona tuning UI, Chair Profile (principles, risk tolerance)

---

## Useful Commands

```bash
# Start the server (Node)
npm run dev

# Start the server (Python)
uvicorn server.main:app --reload

# Initialize database
npm run db:init

# Run prompt tests
npm run test:prompts

# Open frontend (just open the HTML file in browser)
open frontend/index.html
```

---

## Environment Variables

```
OPENAI_API_KEY=sk-...              # Your OpenAI API key
LLM_MODEL=gpt-5.2                  # Model to use (gpt-5.2, gpt-5.2-pro)
LLM_REASONING_EFFORT=medium        # none, minimal, low, medium, high, xhigh
LLM_VERBOSITY=medium               # low, medium, high
DB_PATH=./data/board.db            # SQLite path
PORT=3000                          # Server port
```

---

## GPT-5.2 API Integration

This project uses the **OpenAI Responses API** (`POST /v1/responses`) which is the recommended API for GPT-5 series models.

### Key Parameters

| Parameter | Values | Usage |
|-----------|--------|-------|
| `reasoning.effort` | `none`, `minimal`, `low`, `medium`, `high`, `xhigh` | Controls reasoning depth |
| `text.verbosity` | `low`, `medium`, `high` | Controls response length |
| `text.format` | JSON schema object | Enforces structured output |
| `instructions` | string | System-level guidance (replaces system message) |

### Per-Persona Reasoning Levels

```json
{
  "reasoning_overrides": {
    "strategist": "high",     // Deep synthesis
    "contrarian": "high",     // Thorough devil's advocate  
    "operator": "medium",     // Balanced execution planning
    "finance": "medium",      // Standard financial analysis
    "craft-expert": "medium", // Domain review
    "secretary": "low"        // Simple normalization
  }
}
```

---

## Notes for AI Assistants

When helping with this project:

1. **Always enforce the schema.** Persona responses must match the defined JSON structure.
2. **The Supreme Strategist has final say.** Their synthesis is the authoritative output.
3. **The Chair is always the owner.** All actions are assigned to "Chair" — this is a solo tool.
4. **Prefer reversible decisions.** The Strategist should flag when decisions are one-way doors.
5. **Keep it concise.** This is a busy executive tool, not a verbose report generator.
