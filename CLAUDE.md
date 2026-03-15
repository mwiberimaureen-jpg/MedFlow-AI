
Folder highlights
Agentic workflows detail automation pipelines for lead scraping, proposal generation, and email auto-reply using Anthropic models and Google services.

# MedFlow-AI Rules

- **Always commit and push**: After making any changes to the MedFlow-AI app, always `git add`, `git commit`, and `git push` the changes to GitHub. Do not wait to be asked — push as soon as the build passes.
- **Verify deployment**: After pushing, check that the Vercel deployment succeeded. If the app is running locally, restart the dev server after pushing.
- **Persist ALL UI state to localStorage**: Any user input, submitted/draft status, or UI state that should survive page navigation MUST be persisted to localStorage keyed by patient ID. React state alone is not enough — it resets on navigation.
- **Admission Workflow page layout order**: Clinical Summary → Past Day Summaries (collapsible, collapsed by default) → Current Day N of Admission → Discharge. Past day summaries sit between the clinical summary and the active day card so the user can reference previous days while working on the current day.
- **Day N of Admission structure**: The Day card has 3 collapsible sections in order:
  1. **Assessment** (collapsible) — contains collapsible sub-sections (Follow-up Questions, ROS, Vitals, Physical Exam, Impression, Test Interpretation, Differential Diagnoses, Confirmatory Tests, Management Plan, Complications). Each input section has its own Submit and Edit button.
  2. **Checklist** (collapsible) — brief checkboxes only (no badges/descriptions). Auto-checks from user input in Assessment.
  3. **Day Notes Summary** (collapsible) — editable textarea formatted as proper clinical documentation. HPI flows as narrative (no header), then each section has its own header on a new line: "Review of Systems:", "Vital Signs:", "Physical Examination:", "Investigations:", "PLAN:" (caps). Matches the format of a clinical history document. Final submit button lives here. Does NOT auto-submit — user reviews and edits before submitting.
- **Always show clinical reasoning sections**: Impression, Test Interpretation, Differential Diagnoses, and Complications sections must always be visible (not conditional). Show fallback text if AI content is not available.
- **Day number calculation**: Day 1 = admission day. Use `Math.floor(diffDays) + 1` from admission date.
- **AI Clinical Summary format (ward-round presentation)**: The AI-generated summary MUST be a self-contained ward-round presentation. Mandatory structure:
  - **Paragraph 1**: "This is [Name], a [age]-year-old [sex], [parity if OB/GYN], on day [N] of admission following [original admission diagnosis with brief context — e.g. incomplete abortion at 31 weeks gestation in a now para 3+1 woman who experienced fetal expulsion at home followed by manual removal of retained placenta on admission]. [Current status: chief complaints today, key vital signs, significant exam findings, relevant lab results — woven into flowing clinical prose, NOT a copy-paste of assessment inputs]."
  - **Paragraph 2**: Clinical interpretation — what the findings mean, the working impression, and immediate management priorities.
  - A doctor reading ONLY this summary should know: who the patient is, why they are admitted, what happened today, and what needs to happen next.
- **Clinical reasoning rules**:
  - **SIRS vs Sepsis**: Do NOT diagnose "sepsis" without documented end-organ damage (SOFA criteria). Use "SIRS secondary to [source]" if no organ damage. See prompt in `lib/openrouter/client.ts`.
  - **Anemia grading (WHO)**: Moderate 8-10.9 g/dL, Severe <8 g/dL. For pregnant/postpartum: Moderate 7-9.9, Severe <7. Never call HB ≥8 "severe anemia".
  - **Source**: AMBOSS only. No UpToDate, Medscape, BMJ, or WHO guidelines references.
- **Clinical summary writing style**:
  - Describe **symptoms** first, not diagnostic labels. Say "patient developed hotness of body and drenching sweats from day 3, with temperatures of 39.3°C" NOT "she has developed post-abortion sepsis."
  - Always name **specific drugs** with dose/route/frequency. Say "patient was on IV ceftriaxone 1g BD from day 1-3, changed to IV ceftazidime 1g BD on day 4" NOT "despite 4 days of antibiotic therapy."
  - When recommending drug changes, be specific: "Plan: change from IV ceftazidime 1g BD to IV meropenem 1g TDS" NOT "requires escalation to broad-spectrum antibiotics."
  - Report investigation results factually: "normal chest X-ray" NOT "chest X-ray remains normal despite respiratory symptoms."
  - Do NOT assume diagnoses without evidence. Normal WBC + normal CXR rules out hospital-acquired pneumonia.
  - When querying a diagnosis, say "querying sepsis — plan: LFTs, UECs, serum lactate to rule in/out end-organ damage."

# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- Basically just SOPs written in Markdown, live in `directives/`
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution. E.g you don't try scraping websites yourself—you read `directives/scrape_website.md` and come up with inputs/outputs and then run `execution/scrape_single_site.py`

**Layer 3: Execution (Doing the work)**
- Deterministic Python scripts in `execution/`
- Environment variables, api tokens, etc are stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

## Operating Principles

**1. Check for tools first**
Before writing a script, check `execution/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)
- Update the directive with what you learned (API limits, timing, edge cases)
- Example: you hit an API rate limit → you then look into API → find a batch endpoint that would fix → rewrite script to accommodate → test → update directive.

**3. Update directives as you learn**
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations—update the directive. But don't create or overwrite directives without asking unless explicitly told to. Directives are your instruction set and must be preserved (and improved upon over time, not extemporaneously used and then discarded).

## Self-annealing loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the tool
3. Test tool, make sure it works
4. Update directive to include new flow
5. System is now stronger

## File Organization

**Deliverables vs Intermediates:**
- **Deliverables**: Google Sheets, Google Slides, or other cloud-based outputs that the user can access
- **Intermediates**: Temporary files needed during processing

**Directory structure:**
- `.tmp/` - All intermediate files (dossiers, scraped data, temp exports). Never commit, always regenerated.
- `execution/` - Python scripts (the deterministic tools)
- `directives/` - SOPs in Markdown (the instruction set)
- `.env` - Environment variables and API keys
- `credentials.json`, `token.json` - Google OAuth credentials (required files, in `.gitignore`)

**Key principle:** Local files are only for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in `.tmp/` can be deleted and regenerated.

## Cloud Webhooks (Modal)

The system supports event-driven execution via Modal webhooks. Each webhook maps to exactly one directive with scoped tool access.

**When user says "add a webhook that...":**
1. Read `directives/add_webhook.md` for complete instructions
2. Create the directive file in `directives/`
3. Add entry to `execution/webhooks.json`
4. Deploy: `modal deploy execution/modal_webhook.py`
5. Test the endpoint

**Key files:**
- `execution/webhooks.json` - Webhook slug → directive mapping
- `execution/modal_webhook.py` - Modal app (do not modify unless necessary)
- `directives/add_webhook.md` - Complete setup guide

**Endpoints:**
- `https://nick-90891--claude-orchestrator-list-webhooks.modal.run` - List webhooks
- `https://nick-90891--claude-orchestrator-directive.modal.run?slug={slug}` - Execute directive
- `https://nick-90891--claude-orchestrator-test-email.modal.run` - Test email

**Available tools for webhooks:** `send_email`, `read_sheet`, `update_sheet`

**All webhook activity streams to Slack in real-time.**

## Summary

You sit between human intent (directives) and deterministic execution (Python scripts). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.

Also, use Opus-4.5 for everything while building. It came out a few days ago and is an order of magnitude better than Sonnet and other models. If you can't find it, look it up first.