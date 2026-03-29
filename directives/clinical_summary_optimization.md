# Clinical Summary Optimization — Auto Research Directive

## Goal
Continuously improve the quality of AI-generated clinical summaries using Karpathy's optimization loop: define rubric → test variants → score → keep winner → iterate.

## User Preferences (collected 2026-03-29)

### Rounds Format: SOAP
The user presents patients in **SOAP format** on ward rounds:
- **S** (Subjective): Chief complaint, HPI, what the patient reports
- **O** (Objective): Vitals, physical exam findings, test results
- **A** (Assessment): Impressions, differential diagnoses
- **P** (Plan): Management plan with specific drugs/doses

### Day Note Presentation Order
When presenting to a senior, the expected order is:
1. Name, age
2. "Doing day N of admission"
3. "Came in experiencing [chief complaint]"
4. "On examination: [findings]"
5. "Results of tests done: [results]"
6. Impression
7. Current management plan

### Known Issues with Current AI Summaries
1. **Format issues** — doesn't always match the ward-round presentation style
2. **Missing drug specifics** — sometimes uses vague terms instead of specific drugs with doses

### Summary Length
- **Adaptive**: Simple cases → brief (2-3 sentences). Complex cases → detailed (2+ paragraphs).
- Do NOT pad simple cases with unnecessary detail.

## Quality Rubric

Score each summary on these criteria (1-5 scale):

| Criterion | What to check |
|-----------|---------------|
| **Format compliance** | Follows SOAP structure, day note order matches user's preferred sequence |
| **Drug specificity** | Every drug named with dose/route/frequency — no vague "antibiotics" or "escalation" |
| **Clinical accuracy** | Anemia thresholds correct, SIRS vs sepsis correct, no hallucinated findings |
| **Appropriate length** | Brief for simple cases, detailed for complex — no padding |
| **Actionable plan** | Reader knows exactly what to do next without guessing |
| **Self-contained** | A doctor reading ONLY this summary knows: who, why admitted, what today, what next |

### Scoring
- 5 = Perfect, ready for a consultant to read
- 4 = Minor issues (e.g., one drug missing dose)
- 3 = Usable but needs editing
- 2 = Significant issues (wrong format, vague plan)
- 1 = Would be harmful or misleading

## Optimization Loop

### Step 1: Baseline
- Current prompt: `SYSTEM_PROMPT` in `lib/openrouter/client.ts` (~305 lines)
- Current model: `anthropic/claude-sonnet-4`
- Current temperature: 0.3
- QA agent: `anthropic/claude-3.5-haiku` at temperature 0.1

### Step 2: Variant Testing
When testing a prompt change:
1. Pick 3 existing patient histories from the database
2. Run the current prompt and new variant on all 3
3. Score both outputs against the rubric (use a separate Haiku call to score)
4. If the variant scores higher on average, adopt it
5. Log the result below

### Step 3: Logging
Record each experiment:

```
### Experiment: [date] — [description]
- Change: [what was changed]
- Result: [baseline avg score] → [variant avg score]
- Adopted: yes/no
- Notes: [observations]
```

## Experiments Log

(No experiments yet — baseline established 2026-03-29)

## Prompt Change Candidates

These are hypotheses to test in order of priority:

1. **SOAP structure enforcement**: Add explicit SOAP headers to the summary output format
2. **Adaptive length instruction**: Add "For patients with <3 active problems, keep summary under 100 words. For patients with 3+ problems, expand as needed."
3. **Drug-first management**: Restructure management plan to lead with the drug table, then rationale
4. **Day note format alignment**: Change the day note summary prompt to match the user's exact presentation order (name → age → day N → chief complaint → exam → tests → impression → plan)
