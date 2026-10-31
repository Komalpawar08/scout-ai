# Scout AI

> **Scout: find what's missing before you decide.**
> *AI-assisted information gap detection for News and Scholarship research* — SHINCHAN Online Hackathon 2026.

Scout AI analyses several sources about a topic. It shows **what information is available, what is missing, which
sources disagree, what may be outdated, how strong the evidence is, and what to verify next**, and every finding traces
back to a verbatim quotation, with page/section references, in its source. It is not a chatbot or a summariser. It is
an evidence-first verification workbench.

---

## Key Features

| Area | What it does |
|---|---|
| **⭐ Evidence Viewer (Side Panel)** | Clicking any finding (claim, possible conflict, or information gap) opens a slide-over panel displaying the full source text with the verbatim quote highlighted in context, source name, page/section location, and date origin. |
| **⭐ "Ask the Official Source" Drafts** | For every Critical/High gap or possible conflict, auto-generates a ready-to-send clarification inquiry (email / phone script) with a one-click copy button. Explicitly labeled *"AI-suggested, verify"*, and dynamically adapts to the selected language (English or Hindi). |
| **⭐ Hindi / English Toggle** | Full bilingual support across the UI, navigation, form controls, and verification checklist at the click of a button. Quotations remain in their original source language to preserve fidelity. |
| **⭐ UI Polish & Dark Mode** | Clean modern typography, dark mode toggle, smooth micro-animations (hover lifts, section reveal, live progress bar), responsive mobile drawer navigation, and robust loading, empty, and error states. |
| **Landing Hero & Demos** | One-line problem statement hero with two one-click demo buttons (*Demo A: Scholarship* and *Demo B: News*) executing on clearly labeled fictional fixture sources. |
| **Two research domains** | *News Intelligence* and *Scholarship Intelligence*, each with its own expected-information template, extraction prompts, conflict scope rules, freshness logic, completeness weights and checklist wording. |
| **Source collection** | Automatic web search (Tavily or Brave, replaceable provider), user URLs, uploaded PDFs; partial results when a source fails. |
| **Content & metadata extraction** | Trafilatura + BeautifulSoup for HTML (section spans, meta/JSON-LD dates), PyMuPDF for PDFs (page spans), academic-cycle detection. Publication dates are never inferred; their origin is recorded. |
| **Claims & evidence** | Grok structured output (Pydantic-validated). Every quotation is re-located in the source text; quotes that cannot be found are marked **unsupported**. Offsets, page and section are attached. |
| **Conflict detection** | Rule-based comparison of numbers, money, dates and requirement lists after **scope checks** (subject, unit/definition, period/academic cycle, category). Free-text pairs are adjudicated by Grok. Scope differences are reported as *scope notes*, not conflicts. Labels are always “Possible conflict” or “Potential inconsistency”. |
| **Information gaps** | Every template field is classified *Found / Partially found / Not found in the sources reviewed / Conflicting / Unable to determine*, with why it matters, sources checked, suggested search and priority. Sentences such as “it remains unclear whether…” are recognised as uncertainty, not as answers. |
| **Freshness analysis** | Scholarship: academic cycle vs current cycle, passed deadlines, conflicting cycles. News: an article is “potentially outdated” only when newer reporting exists; old ≠ outdated. Undated and unknown are kept distinct. |
| **Information Coverage Matrix** | Expected fields × sources, with found/partial/conflict/missing/not-extracted cells; click a field to inspect its claims and quotations. |
| **Claim Relationship Graph** | Sources → claims → gaps, with *states*, *corroborates*, *conflicts with* and *missing evidence* edges (React Flow); focus filters keep it readable. |
| **Evidence Confidence Breakdown** | Five explicit components (authority, relevance, freshness, directness, corroboration) with weights, reasons, supporting sources and missing evidence. |
| **Research completeness** | A transparent deterministic formula with per-component explanations. It is not an accuracy score. |
| **Verification checklist** | Prioritised (Critical/High/Medium/Low) tasks derived from conflicts, gaps, freshness warnings and unsupported claims; tick off tasks during the session. |
| **Export** | PDF and JSON reports generated in memory and streamed to the browser. |
| **Live progress** | Server-Sent Events stream real stage updates from the LangGraph nodes. |

---

## Architecture

```
React (Vite, TS, Tailwind, React Flow)  ──POST multipart──▶  FastAPI  ──▶  LangGraph workflow (in-memory)
          ▲   SSE: progress events + final result                              │
          └────────────────────────────────────────────────────────────────────┘
                                   │ HTTPX (SSRF-guarded)   │ xAI Grok API     │ Search API (Tavily/Brave)
```

### LangGraph workflow (`backend/app/agents/graph.py`)

```
research_planner → source_collector → content_extractor → metadata_extractor
    ├─(no usable sources)──────────────────────────────────────────→ report_generator → END
    └─(usable)→ claim_evidence_extractor
                 → [conflict_detector ∥ freshness_checker]
                 → [information_gap_detector ∥ evidence_evaluator]
                 → [coverage_matrix_generator ∥ claim_relationship_graph_generator]
                 → checklist_generator → completeness_calculator → report_generator → END
```

* `ResearchState` is a `TypedDict` (`agents/state.py`). Each analysis node writes only its own keys; `errors`, `progress` and `limitations` use additive reducers, so parallel branches never overwrite each other.
* The graph is compiled **without a checkpointer**. A fresh state is built for every request and discarded afterwards.
* Grok is used where language understanding helps: search planning, claim extraction, text-conflict adjudication and the narrative summary. Everything that produces a number or a label (conflicts on values, gaps, freshness, coverage, graph, scores, completeness, checklist) is **deterministic and unit-tested**.

### Technology

* **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide icons, React Flow (`@xyflow/react`), React Context (Theme, Lang, Research).
* **Backend:** Python, FastAPI, Pydantic v2, HTTPX, LangGraph, Trafilatura, BeautifulSoup, PyMuPDF, ReportLab.
* **LLM:** **xAI Grok** via its OpenAI-compatible Chat Completions API with JSON-schema structured output (`services/llm/grok_client.py`).
* **Deployment:** Docker images for backend (uvicorn) and frontend (nginx), wired with `docker-compose.yml`.

---

## Folder structure

```
Scout AI/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile  requirements.txt  requirements-dev.txt  .env.example  pytest.ini
│   ├── app/
│   │   ├── main.py                    FastAPI app (CORS, router)
│   │   ├── api/routes.py              /api/health, /research, /research/stream, /export/*
│   │   ├── core/config.py             env-based settings
│   │   ├── schemas/research.py        all Pydantic request/response models
│   │   ├── agents/
│   │   │   ├── graph.py  state.py  templates.py (domain expected-field templates)
│   │   │   ├── nodes/                 collection, claims, analysis, report nodes
│   │   │   └── prompts/               Grok prompt builders + structured-output schemas
│   │   ├── services/
│   │   │   ├── url_security.py  fetcher.py  html_extractor.py  pdf_extractor.py  metadata.py
│   │   │   ├── source_collector.py  research_service.py  export_service.py
│   │   │   ├── search/providers.py    Tavily / Brave / disabled
│   │   │   ├── llm/grok_client.py
│   │   │   └── analysis/              evidence, values, heuristic_extractor, conflicts, gaps,
│   │   │                              freshness, scoring, relationships, checklist, report
│   │   └── fixtures/demo.py           clearly labelled DEMO fixtures
│   └── tests/                         62 tests (mocked network, mocked Grok)
└── frontend/
    ├── Dockerfile  nginx.conf  package.json  vite.config.ts
    └── src/
        ├── context/                   ResearchContext, ThemeContext, LangContext
        ├── i18n/strings.ts            English and Hindi localized strings & templates
        ├── services/api.ts            REST + SSE client, exports
        ├── pages/                     LandingPage, DashboardPage
        ├── features/                  evidence (EvidencePanel, breakdown), checklist, conflicts,
        │                              gaps, claims, sources, freshness, coverage, graph, export
        ├── components/                ui.tsx, AskOfficialDraft.tsx
        └── test/                      Vitest + Testing Library test suite
```

---

## Configuration

Copy `backend/.env.example` to `backend/.env` and fill in what you have:

| Variable | Purpose | Default |
|---|---|---|
| `GROK_API_KEY` | xAI API key. **Empty → heuristic mode** (clearly labelled). | — |
| `GROK_MODEL` | Grok model id, e.g. `grok-4` | `grok-4` |
| `GROK_BASE_URL` | xAI OpenAI-compatible endpoint | `https://api.x.ai/v1` |
| `LLM_MODE` | `auto` (Grok if key present) or `heuristic` (force offline) | `auto` |
| `SEARCH_PROVIDER` | `tavily`, `brave` or `none` | `tavily` |
| `SEARCH_API_KEY` | API key for the search provider | — |
| `FRONTEND_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| `MAX_SOURCE_COUNT` | Upper bound on web sources per run | `10` |
| `MAX_PDF_SIZE_MB` | Per-PDF upload limit | `15` |
| `REQUEST_TIMEOUT_SECONDS` | Per-request fetch timeout | `15` |

---

## Running

### With Docker (recommended)

```bash
cp backend/.env.example backend/.env      # add GROK_API_KEY / SEARCH_API_KEY
docker compose up --build
# open http://localhost:8080
```

### Local development

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000 --workers 1
```

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173 (proxies /api → localhost:8000)
```

### Tests

```bash
cd backend  && python -m pytest -q     # 62 backend tests
cd frontend && npm test                # Vitest frontend tests (17 tests)
cd frontend && npm run build           # type-check + production build
```

---

## Demo scenarios

The landing page has two **clearly labelled demo** buttons. They run the real pipeline on fictional fixture sources
(`backend/app/fixtures/demo.py`, reserved `.example` domains, titles prefixed `[DEMO]`, `is_demo=true`, a DEMO banner
on every view and in exports). Fixture dates are generated relative to today, so the scenario stays reproducible.

* **Demo A: Scholarship.** An official notice (current cycle), a secondary news article, and a **PDF notice from the
  previous cycle**. It shows a possible conflict on the income limit (₹2.5 lakh vs ₹3 lakh), a document-list inconsistency
  (domicile vs caste certificate), previous-cycle differences reported as scope notes (55% vs 60% marks is **not** flagged),
  an outdated-cycle warning, a passed deadline, renewal requirements that a source says are unclear, the matrix, graph,
  evidence breakdown and checklist.
* **Demo B: News.** Three publishers on a bridge collapse. It shows conflicting death tolls (8 / 12 / 15) with
  “may reflect an update” caveats, a corroborated event date, a **missing official response** (critical gap), an earlier
  report flagged as potentially outdated because newer coverage exists, and source comparison.


---

## Live Demo & Deployment

> **Live Frontend URL:** [https://scout-ai-0hhw.onrender.com](https://scout-ai-0hhw.onrender.com)  
> **Live Backend API (Health):** [https://scout-api-b22b.onrender.com/api/health](https://scout-api-b22b.onrender.com/api/health)

### Deploy on Render (free tier, no Docker needed)

The repo contains a `render.yaml` Blueprint that provisions both services automatically.

#### One-click Blueprint deploy

1. Fork / push this repo to GitHub.
2. Go to **Render Dashboard → New → Blueprint**, connect the repo, and let Render read `render.yaml`.
3. Set the following **secret environment variables** in the Render dashboard (do **not** commit them):

   | Service | Variable | Value |
   |---|---|---|
   | `scout-api` | `GROK_API_KEY` | your xAI key |
   | `scout-api` | `SEARCH_API_KEY` | your Tavily / Brave key |
   | `scout-api` | `SEARCH_PROVIDER` | `tavily` or `brave` |
   | `scout-api` | `FRONTEND_ORIGIN` | `https://scout-web.onrender.com` (your static site URL) |
   | `scout-web` | `VITE_API_BASE_URL` | `https://scout-api.onrender.com` (your web service URL) |

4. Click **Apply** — Render builds and deploys both services.

#### Manual deploy steps

```bash
# Backend (Render Web Service, Python 3.12)
# Root dir: backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1

# Frontend (Render Static Site)
# Root dir: frontend
npm install && npm run build
# Publish dir: dist
```

#### Local dev still works via Vite proxy

```bash
# No VITE_API_BASE_URL needed locally — Vite proxies /api → http://localhost:8000
cd frontend && npm run dev
```

#### UptimeRobot keep-alive monitor

Render free-tier web services spin down after 15 minutes of inactivity.
Configure an **UptimeRobot** (free) HTTP monitor to ping `https://scout-api.onrender.com/api/health`
every **5 minutes** to keep the backend warm during a demo.
