
Folder highlights
Agentic workflows detail automation pipelines for lead scraping, proposal generation, and email auto-reply using Anthropic models and Google services.

# MedFlow-AI Rules

- **Always commit and push**: After making any changes to the MedFlow-AI app, always `git add`, `git commit`, and `git push` the changes to GitHub. Do not wait to be asked — push as soon as the build passes.
- **Verify deployment**: After pushing, check that the Vercel deployment succeeded. If the app is running locally, restart the dev server after pushing.
- **Persist ALL UI state to localStorage**: Any user input, submitted/draft status, or UI state that should survive page navigation MUST be persisted to localStorage keyed by patient ID. React state alone is not enough — it resets on navigation.
- **Admission Workflow page layout order**: Clinical Summary → Past Day Summaries (collapsible, collapsed by default) → Current Day N of Admission → Discharge. Past day summaries sit between the clinical summary and the active day card so the user can reference previous days while working on the current day.
- **Day N of Admission structure**: The Day card has 3 collapsible sections in order:
  1. **Assessment** (collapsible) — contains collapsible sub-sections (Follow-up Questions, ROS, Vitals, Physical Exam, Impression, Test Interpretation, Differential Diagnoses, Confirmatory Tests, Management Plan, Complications). Each input section has its own Submit and Edit button. Individual Submit buttons are UX confirmation only — they do NOT gate what goes into the final notes.
  2. **Checklist** (collapsible) — brief checkboxes only (no badges/descriptions). Auto-checks from user input in Assessment.
  3. **Day Notes Summary** (collapsible) — editable textarea. Contains ONLY the user's own sections: HPI (no header, narrative), "Review of Systems:", "Vital Signs:", "Physical Examination:", "Investigations:", "PLAN:". The AI clinical summary and AI management plan are NEVER included in these notes — they live in the Analysis only. User reviews, optionally edits, and submits.
- **Day Notes Summary — what is NOT included**: Never inject the AI clinical summary (causes duplicate investigations/treatment sections). Never inject the AI management plan (user copies from analysis if they choose to use any part of it).
- **Always show clinical reasoning sections**: Impression, Test Interpretation, Differential Diagnoses, and Complications sections must always be visible (not conditional). Show fallback text if AI content is not available.
- **Day N Analysis section order** (`app/api/patients/[id]/daily-note/route.ts`): After generating a Day N analysis, the report sections are in this exact order:
  1. Clinical Summary (faithful transcript of progress notes)
  2. **Patient Update — Day N** (user's own HPI extracted from progress_notes — replaces "Gaps in History" at the top)
  3. Test Interpretation
  4. Impression(s)
  5. Differential Diagnoses
  6. Confirmatory Tests
  7. Management Plan
  8. Possible Complications & Prevention
  9. **Outstanding Questions — Next Review** (AI's questions for Day N+1, placed at END not top)
  - The "Outstanding Questions" section maps to `follow_up_questions` via `getSectionKey` so Day N+1's Follow-up Questions section is still pre-populated.
- **Day N AI analysis — clinician-input mirroring rules** (`analyzeDailyProgress` prompt in `lib/openrouter/client.ts`):
  - **MIRROR THE CLINICIAN**: Impressions, differentials, and management must be directly responsive to what the clinician documented in today's progress notes. Never generate generic template content.
  - **New symptom → new differential**: If today's notes contain any symptom, finding, or result not in the admission history or previous notes, add a new differential specifically explaining it.
  - **New symptom → new test**: If a new finding warrants investigation not yet ordered, add it to confirmatory_tests with rationale referencing the specific new finding.
  - **Trajectory**: For each active problem, explicitly state improving / deteriorating / stable.
  - **Management continuity**: If a drug was started in a previous day, acknowledge it and build on it — never describe it as "unspecified."
- **Day number calculation**: Day 1 = admission day. Use `Math.floor(diffDays) + 1` from admission date.
- **AI Clinical Summary format — FAITHFUL TRANSCRIPT**: The summary reports everything documented in the history and nothing else. Include whatever the user wrote — test results, diagnoses, impressions — if they appear in the history. The only rule is: do not add anything that is not in the history. Structure:
  1. Name, age, sex, parity (if OB/GYN), day N of admission.
  2. Chief complaint and relevant background — exactly as documented.
  3. Examination findings as documented (appearance, vitals, key exam findings).
  4. Investigations mentioned in the history — include results and values if the user documented them.
  5. Any diagnoses or impressions the user stated in the history — include them as written.
  6. Treatments/procedures already given — every drug with dose/route/frequency, every procedure.
  7. Any pending plans explicitly stated in the history (e.g. "planning CT head").
  - **One paragraph for most cases.** Two only if genuinely complex.
  - **ABSOLUTE RULES**: Never add anything not written in the history. No AI-generated diagnoses, no inferred results, no interpretations beyond what the user stated. If the user wrote it, report it. If the user did not write it, omit it.
- **Clinical reasoning rules**:
  - **SIRS vs Sepsis**: Do NOT diagnose "sepsis" without documented end-organ damage (SOFA criteria). Use "SIRS secondary to [source]" if no organ damage. See prompt in `lib/openrouter/client.ts`.
  - **Anemia diagnosis (AMBOSS/WHO)**: Non-pregnant women: anemia = HB < 12.0 (HB ≥ 12 is NORMAL, not anemia). Men: HB < 13.0. Pregnant: HB < 11.0. Severity grading — Women: Mild 11-11.9, Moderate 8-10.9, Severe <8. Pregnant: Mild 10-10.9, Moderate 7-9.9, Severe <7. Men: Mild 11-12.9, Moderate 8-10.9, Severe <8. Never call HB ≥8 "severe anemia". Never call HB above the diagnostic threshold "anemia" at all.
  - **Source**: AMBOSS only. No UpToDate, Medscape, BMJ, or WHO guidelines references.
  - **Impressions must be clinical diagnoses**: Every impression must be a named condition or syndrome (e.g., "Acute gastroenteritis with mild dehydration"). NEVER an assessment action. Forbidden first words: Assess, Monitor, Evaluate, Check, Order, Obtain, Continue, Initiate, Ensure, Review, Provide, Calculate, Correct, Refer, Consult, Rule out, Exclude. These are plan items, not diagnoses. Enforced in `sanitizeAnalysis()` AND in `CLINICAL_ASSESSMENT_PROMPT`.
  - **Differential diagnoses — minimum 5, never the impression**: `differential_diagnoses` must contain AT LEAST 5 entries, each with real supporting/against evidence from the documented history. AMBOSS lists extensive differentials for almost every presentation — draw from that breadth, not just the first 1-2 obvious options. A differential must NEVER repeat an entry already in `impressions` — it is an OTHER condition being ruled in/out, not a restatement of the working diagnosis. The minimum-count rule is prompt-only (in `SYSTEM_PROMPT` and `CLINICAL_ASSESSMENT_PROMPT` in `lib/openrouter/client.ts`); the no-duplicate-impression rule is also enforced deterministically in `sanitizeAnalysis()` via fuzzy text match (`normalizeDiagnosisText()`), since the model doesn't reliably self-police free-text instructions (same model that ignores "return ONLY JSON" elsewhere).
  - **Protocol-first management** (enforced in `MANAGEMENT_PLANNING_PROMPT`): Before writing ANY management plan, scan all [Protocol] notes. If a [Protocol] note covers the patient's condition or rotation, use it as the starting point — apply its exact drugs, doses, routes, frequencies, and steps. Do NOT recalculate doses using generic textbook formulas (e.g. Holliday-Segar) if the protocol already specifies them. Cite the protocol in each step's rationale: "Per [protocol name]: [guidance]". Only fall back to AMBOSS if no [Protocol] note covers the condition. For paediatric patients, look for a paediatric protocol before applying any adult or generic formula.
  - **Clinical parameter override** (MANDATORY — applied AFTER protocol selection, in `MANAGEMENT_PLANNING_PROMPT` and `analyzeDailyProgress`): Before finalising ANY management step, cross-check every drug and fluid against the patient's CURRENT clinical parameters. If a protocol default is contraindicated, MODIFY it and state: "Protocol recommends [X], but [X] is contraindicated because [specific parameter + value]. Alternative: [Y]." Protocol = starting point. Current parameters = filter. Both are mandatory.
    - **Dextrose fluids (D5%, D10%, RL+D5%)**: CONTRAINDICATED if BG >11 mmol/L. Use plain Normal Saline 0.9%.
    - **Ringer's Lactate**: flag in hyperlactataemia or severe hyperglycaemia — lactate converts to glucose hepatically.
    - **Potassium-containing fluids**: CONTRAINDICATED in hyperkalaemia.
    - **NSAIDs, aminoglycosides, ACE inhibitors, nephrotoxic contrast**: CONTRAINDICATED or dose-reduce in AKI/CKD.
    - **Hepatotoxic drugs**: flag if transaminases elevated.
    - **Teratogenic drugs**: CONTRAINDICATED in pregnancy — substitute.
  - **Clinical example** (GE + severe dehydration + BG 27.2 mmol/L): Protocol says RL or NS+D5%. D5% is contraindicated (hyperglycaemia). RL contains lactate → glucose; also flag. Correct: plain Normal Saline 0.9% with explicit rationale citing BG 27.2. This is the intended application of protocol-first + parameter override together.
- **Ward round note format** (`generateWardRoundNote` in `lib/openrouter/client.ts`, cached on admission analysis `user_feedback`):
  - Sections in order: demographics line → Chief complaint → Past medical history (if relevant) → Family history (if relevant) → Examination at admission → Management at admission → PLAN.
  - **Chief complaint = synthesized summary of relevant HPI**, NOT a transcript. Include onset, duration, frequency, severity, key associated features that drive the impression (e.g. convulsion count, convulsion duration, tracheal deviation, fecal/urinary incontinence, LOC, photophobia). Omit narrative filler and redundant negatives.
  - Retain every clinically significant number in what you include: episode counts, durations, volumes, exact vitals, drug names with doses and routes.
  - Include ALL procedures (nasal packing, IV access, NGT, catheter, etc.) and ALL investigations sent with results if documented.
  - Include the clinician's plan exactly as documented.
  - Write in brief clinical phrases — no full sentences, no "the patient", no editorialising.
  - The note must be presentable in under 2 minutes. Every line must earn its place.
  - **NEVER add impressions, diagnoses, or differentials** — those come from the AI Assessment section below the note.
  - The prompt lives in `WARD_ROUND_NOTE_PROMPT` in `lib/openrouter/client.ts`. If the format regresses, fix the prompt there.
- **Rounds view — Daily Rounds notes structure** (`components/rounds/PatientDayNotes.tsx`):
  - Each day update (Day 1 of Admission, Day N Update) is a **collapsible card**. Most recent day is open by default; all others collapsed.
  - Each card shows: the day's clinical notes (user's sections), then below it an **AI Recommended Plan** panel (blue) extracted from that day's `raw_analysis_text` — impression + recommended plan steps + adjustments + follow-up tests.
  - Day N updates auto-appear in rounds as soon as the user submits Day N notes (they are stored in `user_feedback` and picked up by `buildDayNotes`).
  - The `allAnalyses` prop must include `raw_analysis_text` for each analysis so the per-day AI plan can be extracted. Ensure the rounds page query and type include this field.
- **Clinical summary writing style**:
  - Report the history faithfully — include whatever the user documented: symptoms, exam findings, results, diagnoses, plans.
  - Describe **symptoms** as documented. If the user wrote a diagnostic label, keep it. If they wrote symptoms without a label, report the symptoms.
  - Always name **specific drugs** with dose/route/frequency as documented.
  - Do NOT add test result values or diagnoses that the user did not write. Do NOT omit values or diagnoses the user did write.
  - Do NOT assume or infer anything beyond what is stated in the history.

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

## Lab Notes — Known Pitfalls

> Accumulated learnings from past sessions. Every entry here prevents a repeat mistake.

1. **Supabase metadata JSONB null safety**: When updating JSONB fields, always use `COALESCE(metadata, '{}')` in raw SQL or spread `{ ...(patient.metadata || {}), rotation: value }` in JS. Bare `jsonb_set` on NULL column = NULL result.

2. **Senior Peer Review refresh — dual-check pattern**: Checking only a localStorage flag misses sparks interacted with before the code change was deployed. Always also check the `seenSparks` array in persisted state. Pattern: explicit flag (SPARK_READ_KEY) + fallback check against seenSparks array.

3. **Anemia threshold enforcement**: The AI still occasionally labels HB ≥ 12.0 in non-pregnant women as "mild anemia." The system prompt alone is not sufficient — the `sanitizeAnalysis()` function must also catch this. Currently relies on prompt rules + QA agent.

4. **Sepsis terminology slip-through**: Even with the SIRS vs Sepsis absolute rule in the system prompt, the AI occasionally uses "evolving sepsis" or "septic" without documented organ damage. The `sanitizeAnalysis()` regex catches most cases, but edge phrases like "sepsis-like picture" can slip through.

5. **Patient rotation assignment**: Don't assign all patients to the same rotation by default. Always check each patient's working diagnosis / admission reason to determine the correct rotation (Internal Medicine, OB/GYN, Surgery, Pediatrics).

6. **localStorage state persistence**: React state alone resets on navigation. Any UI state that should survive page changes (draft forms, submitted status, user selections) MUST be persisted to localStorage keyed by patient ID.

7. **Vercel deployment lag**: After `git push`, Vercel deployments can take 1-3 minutes. If a user reports "changes aren't showing," verify the deployment timestamp before debugging code.

8. **OpenRouter model names**: Use `anthropic/claude-sonnet-4` (not `claude-sonnet-4`). Use `anthropic/claude-haiku-4.5` for fast, cheap tasks like QA checks and learning sparks — `anthropic/claude-3.5-haiku` was sunset by OpenRouter (returns 404 "No endpoints found") and must not be used.

9. **Learning spark format_type constraint**: The `daily_learning_sparks` table must have `CHECK (format_type IN ('senior_asks','quick_teach','know_your_drugs','clinical_twist'))`. The old constraint had `('quiz','mystery','myth','flashcards')`. If inserts fail silently and sparks all look the same format, run `supabase/spark_format_migration.sql`. The temp-ID (`id: 'temp'`) loop: when inserts fail, the spark gets `id: 'temp'`; never add 'temp' to `seenSparks` or the component triggers a refresh every page load.

10. **Learning spark streak — same-day guard**: The streak must increment exactly once per calendar day on the first user interaction. `calculateStreak()` has an early return when `lastInteractionDate === todayISO`. The DB sync merge must always keep the MORE RECENT of the two dates (local vs DB) — never overwrite a newer date with an older DB date, or the next interaction looks like a new day.

11. **Day Notes Submit — all sections included**: `buildClinicalNotes` uses `sectionAnswers[key]?.trim()` directly (no `submittedSections` gate). Individual section Submit buttons are UX confirmation only. If any section has content, it goes into the assembled notes regardless of whether the user clicked the section-level Submit.

12. **Day analysis auto-expands after submit**: After `handleDailyAnalysisComplete`, the new analysis is in `pastAnalyses` (collapsed by default). Track `lastAddedAnalysisId` in `AdmissionTimeline` state and pass `initialOpen={analysis.id === lastAddedAnalysisId}` to `PastDaySection` so the just-submitted analysis is visible.

13. **Rounds duplicate investigations**: Do NOT include the AI clinical summary in `buildClinicalNotes`. It contains investigations and current treatment that already appear in the user's Investigations section, causing duplication. The clinical summary belongs in the separate Clinical Summary card, not embedded in the notes.

## Lab Notes — What Works

> Patterns and approaches that have proven reliable.

1. **Clickable folder cards for grouping**: Users prefer visual folder cards (icon + name + count) over dropdown filters or badges for organizing items by category. Pattern: folder grid view → click to open → patient list inside → back button.

2. **metadata JSONB for extensible fields**: Store soft attributes like `rotation` in an existing JSONB column instead of adding schema migrations. Works well for `patient_histories.metadata` and avoids ALTER TABLE.

3. **Personal notes as AI context**: Fetching the user's clinical notes (up to 30) and passing them to the AI as supplementary context improves analysis quality. Format them clearly with rotation labels and a "do not quote directly" instruction.

4. **Sanitize + QA dual defense**: Regex-based `sanitizeAnalysis()` catches known forbidden phrases deterministically. The QA agent catches semantic violations (wrong anemia grade, unsupported diagnoses). Both layers together provide robust output quality.

5. **`fetchWithRetry` with exponential backoff**: 3 retries with 1s initial backoff handles transient OpenRouter 5xx errors without user intervention.

6. **Day number calculation**: `Math.floor((today - admissionDate) / 86400000) + 1` — Day 1 = admission day. Consistent and simple.

7. **Protocol notes in clinical context**: Personal notes with `source = 'pdf'` are prefixed as `[Protocol]` when passed to the AI. The AI prompt treats `[Protocol]` notes as highest-priority — they override AMBOSS for their specific condition. If a user reports the AI ignoring their uploaded protocol, check: (a) note source is 'pdf', (b) the protocol content is non-empty, (c) the management prompt's PROTOCOL-FIRST RULE is intact in `MANAGEMENT_PLANNING_PROMPT`.

8. **Learning sparks fallback chain**: If no analyses exist, the spark generator falls back to patient histories. Chain: today's analyses → recent analyses (any date) → patient_histories → raw history text snippet. Only show "Add a patient" empty state if ALL four sources are empty.

9. **Impressions filter in sanitizeAnalysis()**: After the AI generates impressions, `sanitizeAnalysis()` runs a regex filter removing any impression that starts with an action verb. This is a hard backstop — if a prompt regression produces "Assess hydration status" as an impression, this filter catches it before it reaches the UI.