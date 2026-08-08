---
name: friction
description: Use when producing English technical prose as a deliverable — READMEs, docs, guides, blog posts, PR or commit text — or when asked to de-LLM, humanize, or check text for AI tells. Run friction before presenting; not for chat answers, fiction, or marketing copy.
---

# friction

[friction](https://friction-cli.dev) is a deterministic engine that
removes the machine layer from LLM-generated technical prose: the ritual
closers, filler spans, hedge phrases, and constructions that make text
read as machine-written. It never invents content, every edit passes
hard gates, and where no safe edit exists it reports instead of
rewriting. Your job splits the same way: apply its fixes untouched, then
revise the constructions it can only detect.

## Setup

Always invoke friction as:

```bash
npx friction-cli@latest <command> <args>
```

`@latest` resolves against the registry, so every session runs the
newest published release with no install and no update step. The
examples below write `friction` for brevity — expand each to `npx
friction-cli@latest` when you run it. If npx cannot fetch the package
(offline, registry blocked), tell the user and stop — do not
hand-imitate what the tool does.

Once per session, also refresh this skill's own marketplace clone (a
safe no-op offline or when already current):

```bash
git -C ~/.claude/plugins/marketplaces/friction-skill pull --ff-only
```

## The loop

Run this on every prose deliverable you produce, before presenting it:

```bash
friction fix --in-place --suggest path/to/doc.md
```

`--in-place` is for files you authored this session. For a file you did
not author, work on a copy or use stdout (`friction fix doc.md >
fixed.md`) so the original survives.

Read stderr. It has three tiers, and each demands a different response:

### 1. Patches applied — trust them, absolutely

Every applied patch came through attestation gates and is
byte-deterministic. **Never revert, re-edit, or "improve" a patch.**
Un-fixing friction's output is the one forbidden move. If a patched
sentence now reads oddly to you, the fix exposed a weakness the original
prose papered over. Revise the whole sentence for content, don't
restore the tell.

### 2. Held findings — revise the construction, never synonym-swap

Lines like `frame vsub.surface::vbz: measured 49.8/M machine vs 3.3/M
human; report-only` are detections without a licensed rewrite. Swapping
the flagged word for a synonym defeats the point — the *construction* is
the tell. Respond by kind:

| finding | your move |
|---|---|
| `register.em_dash` remainder | Restructure the sentence so the dash is unnecessary — split it, subordinate the clause, or use a colon where one belongs. Don't just substitute punctuation. |
| `register.past_progressive` remainder | Ask whether the simple past tells the truth ("was crashing" → "crashed"). If the ongoing aspect is real, keep it. |
| `register.contrast_closer` | "X rather than Y" / "X, not Y" — state one side and let it stand, unless the contrast carries real information (a diagnosis, an instruction); then keep it. |
| `vsub.*` verb reports (e.g. `surface`) | Recast the clause around a concrete verb: "the migration surfaces every place…" → "the migration breaks every place…" or name what actually happened. |
| `intg.*` / `adjg.*` / `vguard.*` counters | The *habit* is flagged, not one word. Cut the intensifier or ground it in a fact ("actually" → delete; "robust" → say what it withstands). |
| `dms.machine` paraphrase spans | Statistical machine-register smell with no named rule. Rephrase the span in plain register, then re-run and confirm the flag clears. |

**Accepting a finding is a legitimate outcome.** If the flagged
construction is load-bearing — a real contrast, a true "by default", an
em dash doing honest work — keep it and move on. friction's own
philosophy is report-don't-rewrite when meaning is at stake; yours is
too. Never fabricate content to satisfy a finding.

### 3. Convergence

After revising, run the same command again. Repeat until a pass applies
0 patches and the remaining findings are ones you consciously accepted.
friction is idempotent, so this loop terminates; two rounds is typical.

## Scope lines

- **English technical prose only.** On other languages friction is
  inert; on fiction or marketing, the register calibration is wrong —
  don't run it there.
- Code spans, links, numbers, and quotes are friction's job to protect.
  Never route prose around the tool to shield them yourself.
- Chat answers are out of scope for the automatic loop. If the user
  asks you to check chat-sized text, use stdin: `printf '%s' "text" |
  friction fix --suggest -`.

## Beyond the loop

Load these when the task needs more than fix:

- [references/check-and-genres.md](references/check-and-genres.md) —
  measurement without editing: `friction check`, genre envelopes, SARIF
  for CI, exit codes.
- [references/explain-and-residual.md](references/explain-and-residual.md)
  — rule-level provenance (`friction explain`), the held-reason
  taxonomy, and `--residual` as a work queue.
- [references/input-modes.md](references/input-modes.md) — stdin
  snippets, static HTML documents, and the stdout-vs-`--in-place`
  discipline in detail.
