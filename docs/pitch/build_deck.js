// Herba Codex — 10-slide EthnoHack 2026 pitch deck
// Design system: parchment herbal palette, specimen-label motif, Georgia display serif.
const pptxgen = require("pptxgenjs");
const fs = require("fs");

const NUM = JSON.parse(fs.readFileSync(__dirname + "/deck_numbers.json", "utf8"));

const BG = "FBF8F1";        // warm paper (content-informed: herbal manuscript)
const INK = "24382A";       // deep herbal green (dark slides + primary)
const ACCENT = "B8862B";    // antique gold
const TEXT = "22301F";
const MUTED = "6B7263";
const CARD = "F3EDDD";      // card tint (same hue family as BG)
const RED = "9C3B2E";       // only for the D-grade emphasis

const SERIF = "Georgia";
const SANS = "Helvetica Neue";

const W = 13.33, H = 7.5, M = 0.6;
let p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "Team Herba Codex";
p.title = "Herba Codex — EthnoHack 2026";

const rule = (s, x, y, w, color = ACCENT, pt = 1.2) =>
  s.addShape(p.shapes.LINE, { x, y, w, h: 0, line: { color, width: pt } });

const label = (s, txt, x, y, w, color = ACCENT, size = 11) =>
  s.addText(txt.toUpperCase(), { x, y, w, h: 0.3, fontFace: SANS, fontSize: size,
    color, charSpacing: 3, bold: true, margin: 0 });

// ---------------------------------------------------------------- 1 TITLE (dark)
{
  const s = p.addSlide();
  s.background = { color: INK };
  s.addText("Herba Codex", { x: M, y: 2.1, w: 10.5, h: 1.5, fontFace: SERIF, fontSize: 66,
    bold: true, color: BG, margin: 0 });
  s.addText("From Culpeper to contemporary evidence — one audited claim at a time.", {
    x: M, y: 3.55, w: 9.6, h: 0.9, fontFace: SERIF, fontSize: 24, italic: true, color: "D8CFB4", margin: 0 });
  rule(s, M, 3.35, 5.4);
  label(s, "EthnoHack 2026 · Track 🌿 Traditional Knowledge", M, 1.55, 8, "C9A45C", 13);
  s.addText([
    { text: "An agentic pipeline that maps two millennia of herbal medicine onto modern pharmacology —\n", options: {} },
    { text: "with provenance on every claim.", options: { bold: true, color: "E8D9A8" } },
  ], { x: M, y: 4.75, w: 9.3, h: 1.0, fontFace: SANS, fontSize: 16, color: "BFC8B9", margin: 0 });
  s.addText("Team Herba Codex", { x: M, y: 6.55, w: 5, h: 0.4, fontFace: SANS, fontSize: 13,
    color: "8E9B88", margin: 0 });
  s.addText("demo & repo: github.com/… (on screen at close)", { x: 8.2, y: 6.55, w: 4.5, h: 0.4,
    fontFace: SANS, fontSize: 11, color: "6E7D68", align: "right", margin: 0 });
}

// ---------------------------------------------------------------- 2 PROBLEM
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "The problem · scientific relevance", M, 0.45, 6);
  s.addText("The record is vast. The trust is missing.", { x: M, y: 0.75, w: 12, h: 0.85,
    fontFace: SERIF, fontSize: 38, bold: true, color: TEXT, margin: 0 });

  // focal: the comfrey case, two opposing claims
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.85, w: 7.2, h: 4.6, fill: { color: CARD },
    rectRadius: 0.08, shadow: { type: "outer", color: "3A3A2E", blur: 7, offset: 2, angle: 90, opacity: 0.18 } });
  s.addText("“It heals all inward wounds… and knits together broken bones.”", {
    x: 0.95, y: 2.15, w: 6.5, h: 1.5, fontFace: SERIF, fontSize: 25, italic: true, color: TEXT, margin: 0 });
  s.addText("— Nicholas Culpeper, The Complete Herbal, 1653 · on Comfrey", {
    x: 0.95, y: 3.6, w: 6.5, h: 0.4, fontFace: SANS, fontSize: 12, color: MUTED, margin: 0 });
  rule(s, 0.95, 4.15, 6.4, "D8CDB4");
  s.addText([
    { text: "2021: ", options: { bold: true, color: RED } },
    { text: "EMA restricts comfrey — pyrrolizidine alkaloids are hepatotoxic.", options: { color: TEXT } },
  ], { x: 0.95, y: 4.35, w: 6.4, h: 0.6, fontFace: SANS, fontSize: 16, margin: 0 });
  s.addText("Two claims, one plant, 370 years apart. Ethnopharmacology lives in this gap — and the gap is uncomputed.", {
    x: 0.95, y: 5.15, w: 6.4, h: 1.0, fontFace: SERIF, fontSize: 17, italic: true, color: INK, margin: 0 });

  s.addText([
    { text: "Semantic extraction from legacy texts is the field's named bottleneck", options: { bold: true, breakLine: true } },
    { text: "(Kew 2026 LLM pipeline covers modern literature only).", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "No end-to-end, provenance-carrying, honestly-validated pipeline exists", options: { bold: true, breakLine: true } },
    { text: "for historical Western herbals.", options: {} },
  ], { x: 8.2, y: 2.15, w: 4.5, h: 3.0, fontFace: SANS, fontSize: 15.5, color: TEXT, paraSpaceAfter: 6, margin: 0 });
  s.addText("And the rules we live by: unvalidated computational findings are never medical facts.", {
    x: 8.2, y: 5.35, w: 4.5, h: 0.9, fontFace: SANS, fontSize: 12.5, italic: true, color: MUTED, margin: 0 });
}

// ---------------------------------------------------------------- 3 DATA
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "Data · every source licensed, every claim cited", M, 0.45, 8);
  s.addText("Open data in, provenance out.", { x: M, y: 0.75, w: 12, h: 0.8,
    fontFace: SERIF, fontSize: 36, bold: true, color: TEXT, margin: 0 });

  const rows = [
    ["Corpus", "Culpeper, Complete Herbal (1653/1850) — 297 remedy entries, exact char offsets", "Public domain · Gutenberg #49513"],
    ["Plant identity", "Kew Plants of the World Online + GBIF backbone", "CC-BY 4.0 · open"],
    ["Regulatory evidence", "EMA/HMPC EU herbal monographs (curated index, canonical links)", "EU reuse 2011/833/EU"],
    ["Biomedical evidence", "PubMed via NCBI E-utilities · PubChem compounds", "Public service · CC0"],
  ];
  let y = 1.9;
  for (const [k, v, lic] of rows) {
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 12.13, h: 1.02, fill: { color: CARD }, rectRadius: 0.06 });
    s.addText(k.toUpperCase(), { x: 0.9, y: y + 0.13, w: 2.2, h: 0.3, fontFace: SANS, fontSize: 11.5,
      bold: true, color: ACCENT, charSpacing: 2, margin: 0 });
    s.addText(v, { x: 0.9, y: y + 0.42, w: 8.3, h: 0.5, fontFace: SANS, fontSize: 14.5, color: TEXT, margin: 0 });
    s.addText(lic, { x: 9.4, y: y + 0.13, w: 3.2, h: 0.75, fontFace: SANS, fontSize: 12,
      italic: true, color: MUTED, align: "right", valign: "middle", margin: 0 });
    y += 1.18;
  }
  s.addText("Traditional-knowledge note: Culpeper is the published early-modern European record (no restricted Indigenous knowledge); CARE principles stated for future corpora.", {
    x: M, y: y + 0.05, w: 12.13, h: 0.55, fontFace: SANS, fontSize: 11.5, italic: true, color: MUTED, margin: 0 });
}

// ---------------------------------------------------------------- 4 ARCHITECTURE
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "Method · agentic-driven architecture", M, 0.45, 8);
  s.addText("Five specialists. One deterministic spine.", { x: M, y: 0.75, w: 12, h: 0.8,
    fontFace: SERIF, fontSize: 36, bold: true, color: TEXT, margin: 0 });

  const agents = [
    ["📜", "Historian", "extracts claims verbatim", "quotes ≤25 words"],
    ["🌿", "Botanist", "resolves to modern taxonomy", "Kew POWO · GBIF"],
    ["⚗️", "Pharmacologist", "links modern evidence", "EMA · PubMed · PubChem"],
    ["⚖️", "Evidence Scorer", "grades concordance", "A–D/X rubric"],
    ["🛡️", "Auditor", "adversarial integrity gate", "verify_quote + coherence"],
  ];
  const bw = 2.18, gap = 0.22, x0 = M, y0 = 2.3, bh = 2.35;
  agents.forEach(([ic, name, mandate, tools], i) => {
    const x = x0 + i * (bw + gap);
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: y0, w: bw, h: bh, fill: { color: CARD },
      rectRadius: 0.07, shadow: { type: "outer", color: "3A3A2E", blur: 6, offset: 2, angle: 90, opacity: 0.15 } });
    s.addText(ic, { x, y: y0 + 0.18, w: bw, h: 0.55, fontSize: 26, align: "center", margin: 0 });
    s.addText(name, { x, y: y0 + 0.78, w: bw, h: 0.4, fontFace: SERIF, fontSize: 17, bold: true,
      color: INK, align: "center", margin: 0 });
    s.addText(mandate, { x: x + 0.12, y: y0 + 1.22, w: bw - 0.24, h: 0.62, fontFace: SANS, fontSize: 12,
      color: TEXT, align: "center", margin: 0 });
    s.addText(tools, { x: x + 0.12, y: y0 + 1.86, w: bw - 0.24, h: 0.4, fontFace: SANS, fontSize: 10.5,
      italic: true, color: MUTED, align: "center", margin: 0 });
    if (i < 4) s.addShape(p.shapes.LINE, { x: x + bw, y: y0 + bh / 2, w: gap, h: 0,
      line: { color: ACCENT, width: 2, endArrowType: "arrow" } });
  });

  s.addText([
    { text: "Deterministic orchestrator: ", options: { bold: true, color: INK } },
    { text: "validation · caching · per-entry checkpoints · full JSONL trace of every LLM & tool call. Agents propose; the orchestrator disposes.", options: { color: TEXT } },
  ], { x: M, y: 5.05, w: 12.13, h: 0.75, fontFace: SANS, fontSize: 15, margin: 0 });
  s.addText([
    { text: "Provenance on every edge: ", options: { bold: true } },
    { text: "quote · agent · confidence — and a machine-verified quote backstop before anything enters the knowledge graph.", options: {} },
  ], { x: M, y: 5.8, w: 12.13, h: 0.7, fontFace: SANS, fontSize: 15, color: TEXT, margin: 0 });
  s.addText("Runs fully offline on a local model (reproducible, zero-cost); any frontier model swaps in via one config change.", {
    x: M, y: 6.55, w: 12.13, h: 0.5, fontFace: SANS, fontSize: 12.5, italic: true, color: MUTED, margin: 0 });
}

// ---------------------------------------------------------------- 5 WHY AGENTS
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "Why agents", M, 0.45, 6);
  s.addText("Each stage needs a different expert — and different tools.", {
    x: M, y: 0.75, w: 12.2, h: 0.8, fontFace: SERIF, fontSize: 33, bold: true, color: TEXT, margin: 0 });

  const rows = [
    ["📜 Historian", "A historian reads Culpeper the way a historian does: polarity (Culpeper denies uses too), preparations, authorities cited — “as Dioscorides saith” is data.", "cross-era signal: ⟨n_authorities⟩ authority citations captured"],
    ["🌿 Botanist", "“All-heal” is three plants depending on era. Tool-verified resolution against Kew POWO + GBIF — never an unverified guess — with confidence and honest ambiguity.", "accuracy@1 ⟨res_acc⟩ [CI ⟨lo⟩–⟨hi⟩] · calibration binned"],
    ["⚗️ Pharmacologist", "PubMed queries need modern biomedical terms — “jangling of the belly” indexes under nothing. Absence of evidence is reported as a finding.", "⟨evidence_docs⟩ evidence documents attached"],
    ["🛡️ Auditor", "An adversarial gate: mechanical quote verification + grade coherence. Failed quotes fail the entry — and stay visible.", "quote integrity ⟨quote_rate⟩ machine-verified"],
  ];
  let y = 1.75;
  for (const [who, what, stat] of rows) {
    s.addText(who, { x: M, y, w: 2.6, h: 0.9, fontFace: SERIF, fontSize: 17, bold: true, color: INK, margin: 0 });
    s.addText(what, { x: 3.35, y, w: 6.55, h: 1.15, fontFace: SANS, fontSize: 13, color: TEXT, margin: 0 });
    s.addText(stat, { x: 10.1, y, w: 2.65, h: 1.15, fontFace: SANS, fontSize: 12, italic: true, color: ACCENT, margin: 0 });
    y += 1.25;
    if (y < 6.5) rule(s, M, y - 0.12, 12.13, "DDD4BE", 0.75);
  }
}

// ---------------------------------------------------------------- 6 DEMO
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "Demo · one golden path, three views", M, 0.45, 8);
  s.addText("You can audit every pixel of this.", { x: M, y: 0.75, w: 12, h: 0.8,
    fontFace: SERIF, fontSize: 36, bold: true, color: TEXT, margin: 0 });
  // screenshots inserted at build time if present
  const shots = [["shot_graph.png", "Graph Explorer — provenance-carrying KG"],
                 ["shot_audit.png", "Historian's Audit Desk — claim vs source"],
                 ["shot_trace.png", "Agent Trace Viewer — the run, replayed"]];
  let x = M;
  for (const [f, cap] of shots) {
    const path = __dirname + "/" + f;
    if (fs.existsSync(path)) {
      s.addImage({ path, x, y: 1.9, w: 3.94, h: 2.7, sizing: { type: "cover", w: 3.94, h: 2.7 } });
    } else {
      s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: 1.9, w: 3.94, h: 2.7, fill: { color: CARD }, rectRadius: 0.05 });
      s.addText("screenshot", { x, y: 3.0, w: 3.94, h: 0.4, align: "center", fontFace: SANS, fontSize: 11, color: MUTED, margin: 0 });
    }
    s.addText(cap, { x, y: 4.68, w: 3.94, h: 0.65, fontFace: SANS, fontSize: 12, color: MUTED, align: "center", margin: 0 });
    x += 4.095;
  }
  s.addText([
    { text: "Live in the demo: ", options: { bold: true, color: INK } },
    { text: "comfrey's D grade (risk surfaced, not echoed) · the Auditor catching a bad quote in the trace · every PMID one click away.", options: { color: TEXT } },
  ], { x: M, y: 5.6, w: 12.13, h: 0.8, fontFace: SANS, fontSize: 15.5, margin: 0 });
}

// ---------------------------------------------------------------- 7 VALIDATION
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "Validation · data science quality", M, 0.45, 8);
  s.addText("Measured, calibrated, intervalled.", { x: M, y: 0.75, w: 12, h: 0.8,
    fontFace: SERIF, fontSize: 36, bold: true, color: TEXT, margin: 0 });

  const stats = [
    [NUM.res_acc, "resolution accuracy@1", `95% CI ${NUM.res_lo}–${NUM.res_hi} · 30-entry gold set`],
    [NUM.quote_rate, "quote integrity (machine-verified)", "every quote checked against source text"],
    [NUM.n_entries, "entries processed end-to-end", `unattended run · ${NUM.n_resolved} taxa resolved`],
  ];
  let x = M;
  for (const [v, cap, sub] of stats) {
    s.addText(String(v), { x, y: 1.8, w: 3.9, h: 1.15, fontFace: SERIF, fontSize: 64, bold: true, color: INK, align: "center", margin: 0 });
    s.addText(cap, { x, y: 2.95, w: 3.9, h: 0.4, fontFace: SANS, fontSize: 14, bold: true, color: TEXT, align: "center", margin: 0 });
    s.addText(sub, { x, y: 3.35, w: 3.9, h: 0.6, fontFace: SANS, fontSize: 11.5, italic: true, color: MUTED, align: "center", margin: 0 });
    x += 4.095;
  }

  if (NUM.calib && NUM.calib.length) {
    s.addChart(p.charts.BAR, [{
      name: "accuracy in bin", labels: NUM.calib.map(c => c.bin), values: NUM.calib.map(c => c.acc),
    }], {
      x: M, y: 4.2, w: 7.3, h: 2.6, barDir: "col", varyColors: true,
      chartColors: NUM.calib.map(c => c.acc >= c.mean_conf ? INK : "C9A45C"),
      chartArea: { fill: { color: BG } },
      catAxisLabelColor: MUTED, valAxisLabelColor: MUTED,
      valAxisMaxVal: 100, valAxisMinVal: 0,
      showValue: true, dataLabelPosition: "outEnd", dataLabelColor: TEXT, dataLabelFontSize: 11,
      showLegend: false, showTitle: true, title: "Calibration: accuracy within confidence bins (%)",
      titleFontSize: 12, titleColor: TEXT, catAxisTitle: "model confidence bin", showCatAxisTitle: true,
      catAxisTitleFontSize: 10, catAxisTitleColor: MUTED,
    });
    s.addText([
      { text: "Bootstrap 95% CIs on every headline metric\n", options: { bold: true, color: INK } },
      { text: "(1000 resamples, percentile method) · status distribution reported honestly: " +
              `${NUM.resolved} resolved · ${NUM.ambiguous} ambiguous · ${NUM.unresolved} unresolved`, options: { color: TEXT } },
    ], { x: 8.3, y: 4.35, w: 4.4, h: 2.3, fontFace: SANS, fontSize: 13.5, paraSpaceAfter: 6, margin: 0 });
  }
  s.addText("Source: eval/results.json — reproducible with one command.", { x: M, y: 7.0, w: 12, h: 0.35,
    fontFace: SANS, fontSize: 10.5, color: MUTED, margin: 0 });
}

// ---------------------------------------------------------------- 8 ABLATION
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "Ablation · what did the architecture buy?", M, 0.45, 8);
  s.addText("Same model. Without the agents, it's just a chatbot.", {
    x: M, y: 0.75, w: 12.2, h: 0.8, fontFace: SERIF, fontSize: 34, bold: true, color: TEXT, margin: 0 });

  s.addChart(p.charts.BAR, [
    { name: "Single-shot LLM", labels: ["Resolution acc@1 (%)", "Quote fidelity (%)"],
      values: [NUM.base_acc, NUM.base_quote] },
    { name: "Five-agent pipeline", labels: ["Resolution acc@1 (%)", "Quote fidelity (%)"],
      values: [NUM.pipe_acc, NUM.pipe_quote] },
  ], {
    x: M, y: 1.85, w: 7.4, h: 4.4, barDir: "col", barGapWidthPct: 60,
    chartColors: ["C4B58E", INK], chartArea: { fill: { color: BG } },
    catAxisLabelColor: TEXT, valAxisLabelColor: MUTED, valAxisMaxVal: 100,
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: TEXT, dataLabelFontSize: 12,
    showLegend: true, legendPos: "b", legendFontSize: 12, legendColor: TEXT,
    valGridLine: { color: "E5DEC9", size: 0.5 }, catGridLine: { style: "none" },
  });
  s.addText([
    { text: "Baseline: ", options: { bold: true } },
    { text: "one unaided LLM call — no tools, no roles, no audit.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "Pipeline: ", options: { bold: true } },
    { text: "tool-verified taxonomy (POWO/GBIF), mechanical + agent audit, provenance on every edge.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "The architecture is the result.", options: { bold: true, italic: true, color: ACCENT } },
  ], { x: 8.4, y: 2.1, w: 4.3, h: 3.6, fontFace: SANS, fontSize: 14.5, color: TEXT, paraSpaceAfter: 6, margin: 0 });
  s.addText("Source: eval/ablation.json — same 30 gold entries, same model.", { x: M, y: 6.55, w: 12, h: 0.35,
    fontFace: SANS, fontSize: 10.5, color: MUTED, margin: 0 });
}

// ---------------------------------------------------------------- 9 LIMITATIONS
{
  const s = p.addSlide();
  s.background = { color: BG };
  label(s, "Limitations & responsible research · we say it first", M, 0.45, 9);
  s.addText("What this is not.", { x: M, y: 0.75, w: 12, h: 0.8,
    fontFace: SERIF, fontSize: 36, bold: true, color: TEXT, margin: 0 });

  const items = [
    ["Not medical advice", "Outputs are graded correspondences between historical claims and published evidence — with uncertainty and caveats on every grade. The app says so on every screen."],
    ["Not a clean source lineage", "Culpeper compiles Dioscorides and Galen; authority citations capture the lineage but we don't do source-critical attribution per claim."],
    ["Not frontier-scale", "A local 9B model limits extraction depth (by design: reproducible & free). The pipeline is model-agnostic — one config change upgrades it."],
    ["Not a complete evidence map", "Curated EMA index (~48 substances); PubMed relevance is query-driven — grades lean conservative, and we label that bias."],
  ];
  let y = 1.85;
  for (const [k, v] of items) {
    s.addText(k, { x: M, y, w: 3.3, h: 0.9, fontFace: SERIF, fontSize: 16.5, bold: true, color: INK, margin: 0 });
    s.addText(v, { x: 4.1, y, w: 8.6, h: 1.05, fontFace: SANS, fontSize: 13.5, color: TEXT, margin: 0 });
    y += 1.22;
    if (y < 6.5) rule(s, M, y - 0.14, 12.13, "DDD4BE", 0.75);
  }
}

// ---------------------------------------------------------------- 10 IMPACT (dark)
{
  const s = p.addSlide();
  s.background = { color: INK };
  label(s, "Impact & roadmap", M, 0.55, 6, "C9A45C");
  s.addText("Evidence, not verdicts.", { x: M, y: 0.95, w: 12, h: 1.0,
    fontFace: SERIF, fontSize: 44, bold: true, color: BG, margin: 0 });
  s.addText([
    { text: "Next corpora: ", options: { bold: true, color: "E8D9A8" } },
    { text: "Pliny's medical books (already segmented) · Dioscorides translations · multilingual name resolution · community gold sets · publication-grade exports for the ETHCSTWIN platform.", options: { color: "BFC8B9" } },
  ], { x: M, y: 2.35, w: 11.5, h: 1.1, fontFace: SANS, fontSize: 16, margin: 0 });
  s.addText([
    { text: "For researchers: ", options: { bold: true, color: "E8D9A8" } },
    { text: "a computable, auditable bridge from historical claims to modern evidence.", options: { color: "BFC8B9", breakLine: true } },
    { text: "For the public: ", options: { bold: true, color: "E8D9A8" } },
    { text: "historical remedies surfaced with their warnings — not despite them.", options: { color: "BFC8B9" } },
  ], { x: M, y: 3.7, w: 11.5, h: 1.3, fontFace: SANS, fontSize: 16, paraSpaceAfter: 8, margin: 0 });
  rule(s, M, 5.5, 12.13, "4A5B4C", 1);
  s.addText("Team Herba Codex · EthnoHack 2026 · Track 🌿 Traditional Knowledge", {
    x: M, y: 5.75, w: 8.5, h: 0.4, fontFace: SANS, fontSize: 13, color: "8E9B88", margin: 0 });
  s.addText("github.com/…  ·  reproduce: uv run herba all", { x: 8.0, y: 5.75, w: 4.73, h: 0.4,
    fontFace: SANS, fontSize: 13, color: "C9A45C", align: "right", margin: 0 });
  s.addText("Research prototype — not medical advice.", { x: M, y: 6.6, w: 12.13, h: 0.35,
    fontFace: SANS, fontSize: 11, italic: true, color: "6E7D68", margin: 0 });
}

p.writeFile({ fileName: __dirname + "/herba_codex_deck.pptx" }).then(() => console.log("deck written"));
