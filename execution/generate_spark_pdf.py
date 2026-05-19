#!/usr/bin/env python3
"""
Generate a 14-day NBU clinical teaching PDF.
Usage:  python execution/generate_spark_pdf.py
Output: .tmp/nbu_14day_sparks.html  — open in Chrome, Ctrl+P → Save as PDF
"""

import base64
import json
import os
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "anthropic/claude-sonnet-4"
URL = "https://openrouter.ai/api/v1/chat/completions"

# Each entry: (topic, format) or (topic, format, hint)
# hint = optional extra instruction appended to the AI user message
TOPICS = [
    ("Neonatal Sepsis",                  "clinical_twist"),
    ("Neonatal Jaundice",                "quick_teach"),
    ("HIE and Birth Asphyxia",           "senior_asks"),
    ("Meconium Aspiration Syndrome",     "know_your_drugs"),
    ("Preterm and Low Birth Weight",     "clinical_twist"),
    ("Bacterial Meningitis in Children", "quick_teach"),
    ("Convulsions in Children",          "senior_asks"),
    ("Convulsions — Causes by Category", "quick_teach",
        "Classify causes of convulsions in children into metabolic (hypoglycaemia, "
        "hyponatraemia, hypocalcaemia, hypomagnesaemia — include diagnostic thresholds), "
        "infectious (febrile seizures vs meningitis/encephalitis — key distinguishing features), "
        "structural (HIE, cortical dysplasia), and epileptic/idiopathic. "
        "For each category include the first-line investigation and immediate management step."),
    ("Childhood Pneumonia",              "know_your_drugs"),
    ("Dehydration and Shock",            "clinical_twist"),
    ("Dehydration in Children — WHO Fluid Plans", "quick_teach",
        "Cover WHO Dehydration Plans A, B, and C as separate cards. "
        "Plan A: no/mild dehydration — home ORS, how much per stool/vomit. "
        "Plan B: moderate dehydration — supervised ORS 75 mL/kg over 4 hours, reassessment. "
        "Plan C: severe dehydration — IV Ringer's lactate (Hartmann's): 30 mL/kg in 30 min "
        "(infants) or 1 h (children), then 70 mL/kg in 2.5 h (infants) or 3 h (children). "
        "Include the clinical signs used to classify each plan and when to reassess."),
    ("Childhood Malaria",                "quick_teach"),
    ("Diabetic Ketoacidosis",            "senior_asks"),
    ("Acute Kidney Injury in Children",  "know_your_drugs"),
    ("Heart Failure in Children",        "clinical_twist"),
    ("Rheumatic Heart Disease",          "senior_asks"),
    ("Tuberculosis in Children",         "quick_teach"),
    ("HIV-Exposed Infant",               "know_your_drugs"),
    ("HIV in Pregnancy — PMTCT Screening Timeline", "quick_teach",
        "Cover the complete PMTCT screening timeline as sequential cards: "
        "(1) First antenatal contact — HIV test regardless of previous negative; "
        "(2) Repeat test at 28 weeks if initially negative; "
        "(3) 36 weeks / third trimester — repeat again; "
        "(4) Labour — rapid HIV test for any woman with unknown or untested status; "
        "(5) Postpartum — test if missed antenatally. "
        "Also include: start ART immediately regardless of CD4 (Option B+), "
        "preferred regimen (TDF/3TC/DTG or country equivalent), "
        "and infant prophylaxis (NVP for 6 weeks low-risk; NVP + AZT for high-risk infants)."),
    ("Chronic Kidney Disease in Children","clinical_twist"),
    ("Childhood Asthma",                 "senior_asks"),
    ("Rickets",                          "quick_teach"),
    ("CPAP in Neonatal Resuscitation",   "senior_asks",
        "Focus on the role of CPAP in neonates with birth asphyxia or respiratory distress. "
        "When is CPAP the right choice vs bag-mask PPV? "
        "Physiological rationale: FRC establishment, surfactant conservation, atelectasis prevention. "
        "Starting PEEP (5 cmH2O) and FiO2 (0.21 for term, 0.30 for preterm). "
        "When does CPAP fail and intubation is required? "
        "The key mistake: using CPAP when PPV is actually indicated (apnea, HR < 100). "
        "Make the question confront this specific confusion."),
]

PROMPTS = {
    "senior_asks": """You are a PGY-3 senior resident doing an informal teaching moment with an intern. Tone: collegial, direct. Like a friend who happens to know more.

INPUT: A medical condition.
OUTPUT: ONE pointed clinical reasoning question — focused on the "why" behind a management decision, a commonly missed finding, a contraindication trap, or a gray area where reasonable doctors disagree.

The question does NOT have to be framed around a patient scenario. It can be a direct clinical question, a "what do most clinicians get wrong about X", or a decision-logic challenge. Use whichever framing makes the teaching point land harder.

Return ONLY valid JSON:
{
  "question": "The question — direct, specific, clinically confronting",
  "context": "One sentence of setup. Can be a brief patient scenario OR a direct framing ('Here is something most interns get wrong about X...'). Choose whichever fits.",
  "answer": "Clear, concise answer (3-4 sentences). Lead with the non-obvious insight. Explain the reasoning, not just the conclusion. Include specific drugs, doses, or thresholds where relevant.",
  "teaching_point": "The deeper principle — a commonly misunderstood rule, a contraindication trap, or a decision threshold that is counter-intuitive",
  "clinical_pearl": "One memorable takeaway: a rule, a number, or a principle they will actually use on rounds tomorrow",
  "topic": "Condition name"
}

Rules:
- Ask questions that test REASONING, not recall
- The answer must include the clinical logic — what to check, what changes the decision, what the failure mode is
- Do NOT always frame as a patient scenario — direct learning points are equally valid
- Reference AMBOSS only
- Return ONLY the JSON object, no markdown fences""",

    "quick_teach": """You are a PGY-3 senior resident giving a focused teaching moment to an intern. Tone: efficient, practical.

INPUT: A medical condition.
OUTPUT: A tight teaching card deck — a classification with clinical implications, a mnemonic that encodes a decision rule, diagnostic criteria with their most-missed pitfall, or a pathophysiology insight that explains why management works the way it does.

The intro does NOT have to reference a patient. It can open directly: "Here is what most people get wrong about X", "The classification that actually changes your management in X", or "The thing the textbook does not emphasise about X". Lead with the insight, not the scenario.

Return ONLY valid JSON:
{
  "topic": "Condition name",
  "intro": "One sentence opening. Can link to a patient scenario OR open directly with the insight. Choose whichever is more compelling.",
  "teach_type": "classification or mnemonic or pathophysiology or criteria",
  "cards": [
    { "id": "1", "title": "Card title", "content": "2-3 sentences. Not just the definition — include the clinical implication or the exception that makes this worth knowing." },
    { "id": "2", "title": "Title", "content": "Content with clinical implication" },
    { "id": "3", "title": "Title", "content": "Content with clinical implication" },
    { "id": "4", "title": "Title", "content": "Content with clinical implication" }
  ],
  "summary_pearl": "The one thing they will use on rounds tomorrow — a decision rule, a threshold, or the common mistake this framework prevents"
}

Rules:
- 3-5 cards. Each card must go beyond the label — include what it MEANS for management
- For mnemonics: each letter encodes a clinical action or decision, not just a noun
- For classifications: each class includes the management implication that changes with it
- Content must be ward-applicable with specific numbers, drugs, or monitoring targets where relevant
- Reference AMBOSS only
- Return ONLY the JSON object, no markdown fences""",

    "know_your_drugs": """You are a PGY-3 senior resident doing a pharmacology teaching moment with an intern. Tone: practical. "Here is what you actually need to know."

INPUT: A medical condition.
OUTPUT: A focused drug comparison — covering when to pick one over another, dose adjustments in edge cases, contraindication traps, and the prescribing errors that actually harm patients.

The context does NOT have to open with a patient scenario. It can open directly: "In X, the drug choice question most interns get wrong is...", or "Here is the dosing trap in X that causes real harm..." Use whichever framing makes the teaching point sharper.

Return ONLY valid JSON:
{
  "topic": "Condition or drug class",
  "context": "One sentence opening. Can be a patient scenario OR a direct statement of the prescribing problem. Choose whichever is more instructive.",
  "drugs": [
    { "name": "Drug name (dose/route/frequency)", "mechanism": "One sentence MOA focused on the part that explains why it is chosen or avoided in specific contexts", "when_to_use": "The specific patient characteristic, comorbidity, or test result that tips the decision toward this drug", "key_point": "The prescribing trap: dose adjustment, contraindication, or monitoring requirement that is commonly missed and clinically consequential" },
    { "name": "Drug 2", "mechanism": "MOA", "when_to_use": "When to use", "key_point": "Prescribing trap" },
    { "name": "Drug 3", "mechanism": "MOA", "when_to_use": "When to use", "key_point": "Prescribing trap" }
  ],
  "clinical_pearl": "The decision rule: the single patient characteristic that most commonly changes which drug you choose — and the failure mode if you ignore it"
}

Rules:
- 2-4 drugs compared within the same clinical decision
- "key_point" must be the prescribing error that has actually harmed patients
- Include dose adjustments for renal/hepatic impairment, weight-based dosing, or age-specific thresholds where relevant
- Reference AMBOSS only
- Return ONLY the JSON object, no markdown fences""",

    "clinical_twist": """You are a PGY-3 senior resident using Socratic teaching with an intern. Tone: direct, collegial.

INPUT: A medical condition.
OUTPUT: A teaching moment built around ONE thing that changes everything — a pivot point, a missed finding, a management trap, or a "what most clinicians do wrong" insight. This can be framed as:
  (a) A scenario where one variable changes and the management pivots — "Good plan. But what changes if..."
  (b) A direct learning point — "Here is the thing most clinicians miss in X" or "Here is why the standard approach fails in this specific situation"

Choose whichever framing delivers the insight more powerfully. Not every teaching moment needs a patient scenario.

Return ONLY valid JSON:
{
  "topic": "Condition name",
  "scenario": "The setup (1-2 sentences). Can be a patient scenario OR a direct statement: 'In X, the standard approach is Y. Here is why that fails in one specific context.'",
  "twist": "The pivot point (1 sentence). Can be a variable that changes OR a direct missed insight ('What most clinicians miss is that...')",
  "original_plan": "The default or expected management — specific enough to show exactly what now needs to change",
  "revised_plan": "The corrected approach (2-3 sentences): what to stop, what to start with specific doses, what to monitor, and what thresholds now apply",
  "reasoning": "Why the default approach fails here (2-3 sentences): the mechanism, the consequence, and why the intuitive response makes it worse before it gets better",
  "clinical_pearl": "A broadly applicable rule — something that lets a clinician anticipate this situation, not just react to it"
}

Rules:
- Choose scenario vs direct learning point based on which lands harder for this specific condition
- The revised plan must be a step-by-step hierarchy with specific drugs, doses, and thresholds
- The reasoning must explain WHY the intuitive response fails
- The clinical pearl should be a decision rule, not a fact
- Reference AMBOSS only
- Return ONLY the JSON object, no markdown fences""",
}

FORMAT_LABELS = {
    "clinical_twist":  "Clinical Twist",
    "quick_teach":     "Quick Teach",
    "senior_asks":     "Senior Asks",
    "know_your_drugs": "Know Your Drugs",
}

FORMAT_COLORS = {
    "clinical_twist":  "#f97316",
    "quick_teach":     "#10b981",
    "senior_asks":     "#3b82f6",
    "know_your_drugs": "#a855f7",
}


# ── API call ──────────────────────────────────────────────────────────────────

def call_api(topic: str, fmt: str, hint: str = "") -> dict:
    user_msg = (
        f"Topic: {topic}\n\n"
        "Generate a focused teaching moment. Push into gray areas, "
        "contraindication traps, or decision logic — not basic recall."
    )
    if hint:
        user_msg += f"\n\nSpecific focus for this post:\n{hint}"
    resp = requests.post(
        URL,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "MedFlow AI - NBU Teaching PDF",
        },
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": PROMPTS[fmt]},
                {"role": "user",   "content": user_msg},
            ],
            "temperature": 0.7,
            "max_tokens": 1200,
        },
        timeout=90,
    )
    resp.raise_for_status()
    raw = resp.json()["choices"][0]["message"]["content"].strip()
    # strip markdown fences if model adds them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ── HTML renderers per format ─────────────────────────────────────────────────

def esc(s: str) -> str:
    return (str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


def render_clinical_twist(c: dict, color: str) -> str:
    return f"""
    <div class="section"><span class="label">CURRENT SCENARIO</span>
      <p>{esc(c.get('scenario',''))}</p></div>
    <div class="twist-box" style="border-left:3px solid {color};background:rgba(249,115,22,0.07);padding:14px 16px;border-radius:6px;margin:12px 0">
      <span class="label" style="color:{color}">THE TWIST</span>
      <p style="color:#f1f5f9;font-size:15px;margin:6px 0 0">{esc(c.get('twist',''))}</p>
    </div>
    <div class="section"><span class="label">ORIGINAL PLAN</span>
      <p>{esc(c.get('original_plan',''))}</p></div>
    <div class="section" style="background:rgba(59,130,246,0.07);padding:14px 16px;border-radius:6px">
      <span class="label" style="color:#3b82f6">REVISED PLAN</span>
      <p>{esc(c.get('revised_plan',''))}</p></div>
    <div class="section"><span class="label">REASONING</span>
      <p>{esc(c.get('reasoning',''))}</p></div>
    <div class="pearl">💡 {esc(c.get('clinical_pearl',''))}</div>
"""


def render_senior_asks(c: dict, color: str) -> str:
    return f"""
    <div class="section" style="background:rgba(59,130,246,0.07);padding:14px 16px;border-radius:6px">
      <span class="label" style="color:{color}">THE QUESTION</span>
      <p style="color:#f1f5f9;font-size:15px;margin:6px 0 0">{esc(c.get('context',''))}</p>
      <p style="color:#f1f5f9;font-size:16px;font-weight:600;margin:10px 0 0">"{esc(c.get('question',''))}"</p>
    </div>
    <div class="section"><span class="label">ANSWER</span>
      <p>{esc(c.get('answer',''))}</p></div>
    <div class="section"><span class="label">TEACHING POINT</span>
      <p>{esc(c.get('teaching_point',''))}</p></div>
    <div class="pearl">💡 {esc(c.get('clinical_pearl',''))}</div>
"""


def render_quick_teach(c: dict, color: str) -> str:
    cards = c.get("cards", [])
    teach_type = c.get("teach_type", "")
    cards_html = ""
    for card in cards:
        cards_html += f"""
        <div class="qt-card">
          <div class="qt-card-title" style="color:{color}">{esc(card.get('title',''))}</div>
          <div class="qt-card-content">{esc(card.get('content',''))}</div>
        </div>"""
    return f"""
    <div class="section">
      <span class="label">{esc(teach_type.upper())}</span>
      <p style="margin:6px 0 12px">{esc(c.get('intro',''))}</p>
      <div class="qt-grid">{cards_html}</div>
    </div>
    <div class="pearl">💡 {esc(c.get('summary_pearl',''))}</div>
"""


def render_know_your_drugs(c: dict, color: str) -> str:
    drugs = c.get("drugs", [])
    drugs_html = ""
    for drug in drugs:
        drugs_html += f"""
        <div class="drug-card">
          <div class="drug-name" style="color:{color}">{esc(drug.get('name',''))}</div>
          <div class="drug-row"><span class="drug-label">MOA</span><span>{esc(drug.get('mechanism',''))}</span></div>
          <div class="drug-row"><span class="drug-label">WHEN TO USE</span><span>{esc(drug.get('when_to_use',''))}</span></div>
          <div class="drug-row"><span class="drug-label" style="color:#fbbf24">KEY POINT</span><span style="color:#fde68a">{esc(drug.get('key_point',''))}</span></div>
        </div>"""
    return f"""
    <div class="section"><span class="label">CONTEXT</span>
      <p>{esc(c.get('context',''))}</p></div>
    <div class="drugs-grid">{drugs_html}</div>
    <div class="pearl">💡 {esc(c.get('clinical_pearl',''))}</div>
"""


RENDERERS = {
    "clinical_twist":  render_clinical_twist,
    "quick_teach":     render_quick_teach,
    "senior_asks":     render_senior_asks,
    "know_your_drugs": render_know_your_drugs,
}


# ── HTML wrapper ──────────────────────────────────────────────────────────────

def build_html(days: list, logo_b64: str = "") -> str:
    day_cards = ""
    for day_num, topic, fmt, content in days:
        color  = FORMAT_COLORS[fmt]
        label  = FORMAT_LABELS[fmt]
        if content is None:
            body = "<p style='color:#ef4444'>⚠ Generation failed for this topic.</p>"
        else:
            body = RENDERERS[fmt](content, color)

        day_cards += f"""
  <div class="day-card" {'style="page-break-before:always"' if day_num > 1 else ''}>
    <div class="day-header">
      <div class="day-meta">
        <span class="day-num">Post {day_num}</span>
        <span class="format-badge" style="background:rgba({_hex_to_rgb(color)},0.15);color:{color}">{label}</span>
      </div>
      <span class="topic-name">{esc(topic)}</span>
    </div>
    <div class="day-body">{body}</div>
  </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MedFlow AI — NBU Clinical Teaching Posts</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background: #0d1117;
    color: #94a3b8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  /* ── Cover page ── */
  .cover {{
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    page-break-after: always;
    background: #0d1117;
  }}
  .cover-title {{
    font-size: 32px;
    font-weight: 700;
    color: #f1f5f9;
    margin-bottom: 8px;
  }}
  .cover-subtitle {{
    font-size: 18px;
    color: #3b82f6;
    margin-bottom: 4px;
  }}
  .cover-rotation {{
    font-size: 15px;
    color: #64748b;
    margin-bottom: 40px;
  }}
  .cover-dots {{
    display: flex;
    gap: 10px;
  }}
  .cover-dot {{
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }}

  /* ── Watermark — appears on every page ── */
  .day-card::before, .cover::before {{
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 420px;
    height: 420px;
    background-image: url('{logo_b64}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    opacity: 0.09;
    mix-blend-mode: screen;
    filter: invert(1) brightness(1.6);
    pointer-events: none;
    z-index: 0;
  }}
  .cover::before {{ opacity: 0.18; }}
  .day-card > *, .cover > * {{ position: relative; z-index: 1; }}

  /* ── Day card ── */
  .day-card {{
    min-height: 100vh;
    padding: 40px 44px;
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
    overflow: hidden;
  }}
  .day-header {{
    margin-bottom: 20px;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 16px;
  }}
  .day-meta {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }}
  .day-num {{
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }}
  .format-badge {{
    font-size: 11px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 20px;
    letter-spacing: 0.04em;
  }}
  .topic-name {{
    font-size: 22px;
    font-weight: 700;
    color: #f1f5f9;
  }}

  /* ── Content sections ── */
  .day-body {{ flex: 1; }}
  .section {{ margin-bottom: 18px; }}
  .label {{
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #475569;
    text-transform: uppercase;
    margin-bottom: 6px;
  }}
  p {{ color: #94a3b8; margin: 0; }}

  /* ── Pearl ── */
  .pearl {{
    margin-top: 20px;
    padding: 14px 16px;
    background: #161b27;
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 13.5px;
    font-style: italic;
    border-left: 3px solid #334155;
  }}

  /* ── Quick Teach cards ── */
  .qt-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }}
  .qt-card {{
    background: #161b27;
    border-radius: 8px;
    padding: 14px 16px;
  }}
  .qt-card-title {{
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }}
  .qt-card-content {{ color: #94a3b8; font-size: 13px; }}

  /* ── Know Your Drugs ── */
  .drugs-grid {{ display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }}
  .drug-card {{
    background: #161b27;
    border-radius: 8px;
    padding: 14px 16px;
  }}
  .drug-name {{ font-size: 14px; font-weight: 700; margin-bottom: 10px; }}
  .drug-row {{ display: flex; gap: 8px; margin-bottom: 5px; font-size: 13px; }}
  .drug-label {{
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #475569;
    min-width: 90px;
    padding-top: 1px;
  }}

  /* ── Print ── */
  @media print {{
    body {{ background: #0d1117; }}
    .day-card {{ page-break-before: always; }}
    .cover {{ page-break-after: always; }}
  }}
</style>
</head>
<body>

<div class="cover">
  <div style="font-size:13px;color:#3b82f6;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:20px">MedFlow AI · Senior Peer Review</div>
  <div class="cover-title">NBU Clinical Teaching</div>
  <div class="cover-subtitle">Neonatal &amp; Paediatric Rotation</div>
  <div class="cover-rotation">Daily learning sparks — clinical reasoning, decision logic, drug selection</div>
  <div class="cover-dots">
    <div class="cover-dot" style="background:#f97316"></div>
    <div class="cover-dot" style="background:#10b981"></div>
    <div class="cover-dot" style="background:#3b82f6"></div>
    <div class="cover-dot" style="background:#a855f7"></div>
  </div>
  <div style="position:absolute;bottom:40px;color:#334155;font-size:12px">
    Generated by MedFlow AI · AMBOSS-based clinical reasoning
  </div>
</div>

{day_cards}

</body>
</html>"""


def _hex_to_rgb(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"{r},{g},{b}"


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not API_KEY:
        print("ERROR: OPENROUTER_API_KEY not set in .env")
        return

    os.makedirs(".tmp", exist_ok=True)
    days = []

    total = len(TOPICS)
    for i, entry in enumerate(TOPICS):
        topic, fmt = entry[0], entry[1]
        hint = entry[2] if len(entry) > 2 else ""
        post_num = i + 1
        print(f"[{post_num:2d}/{total}] {topic} ({FORMAT_LABELS[fmt]}) ...", end=" ", flush=True)
        try:
            content = call_api(topic, fmt, hint)
            days.append((post_num, topic, fmt, content))
            print("OK")
        except Exception as e:
            print(f"FAIL  {e}")
            days.append((post_num, topic, fmt, None))
        if i < len(TOPICS) - 1:
            time.sleep(1.5)  # avoid rate-limiting

    logo_path = Path("medical-workflow-app/public/logo-watermark.jpg")
    logo_b64 = ""
    if logo_path.exists():
        raw = logo_path.read_bytes()
        logo_b64 = "data:image/jpeg;base64," + base64.b64encode(raw).decode()
    else:
        print("WARNING: logo-watermark.jpg not found — watermark skipped")

    out = Path(".tmp/nbu_14day_sparks.html")
    out.write_text(build_html(days, logo_b64), encoding="utf-8")
    print(f"\nSaved -> {out.resolve()}")
    print("   Open in Chrome  ->  Ctrl+P  ->  Destination: Save as PDF")
    print("   Recommended: Paper A4, Margins: Minimum, Background graphics: ON")


if __name__ == "__main__":
    main()
