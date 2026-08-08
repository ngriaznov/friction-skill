# Provenance and the held-reason taxonomy: `friction explain`

`explain` runs the same repair pipeline as `fix` but reports what
happened and why, per pass, without keeping the output. Use it when the
user asks *why* something was or wasn't changed.

```bash
friction explain doc.md
friction explain doc.md --format json
```

The JSON form lists, per pass, every `fired` patch (rule id, byte
range, replacement) and every `held` candidate with its reason string.
Byte offsets are into that pass's working text.

## Held reasons you will actually see

- **`report-only`** with measured rates ("measured 49.8/M machine vs
  3.3/M human") — the rule is detection-only by design: either no
  closed-set rewrite exists (single-word usage counters) or the
  construction's rewrite was tried and refuted on corpus evidence.
  These never become edits, at any confidence.
- **Gate declines** — a rewrite exists but a gate said no for this
  instance: the seam bigram or POS skeleton isn't attested in human
  writing, the clause would lose its finite verb, or the anchor sits in
  protected context (code span, link, quote). Respect these: the gate
  is usually protecting meaning you'd damage.
- **Register remainders** ("no licensed rewrite and the document is
  still above the human band … needs a human hand") — the document's
  rate for a cadence feature is armed, this instance matched no safe
  rewrite shape, and a human (you) should restructure or accept.
- **Anchor demotions** ("anchor too common in human prose to
  auto-edit") — the phrase is real English; friction reports it only
  because the document is machine-flavored overall. Weight these low.

## Presenting explain output

Summarize by rule family with one concrete quote each: never dump raw
JSON at the user. When a user disputes an edit, `explain` is the
evidence: the rule id, its measured machine/human rates, and the gate
trail are the answer to "why did it change this?"
