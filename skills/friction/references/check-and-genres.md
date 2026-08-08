# Measurement without editing: `friction check`

`check` parses, measures, and runs the detection channels. It never
edits. Use it when the user wants a verdict or a report rather than a
repaired document.

```bash
friction check doc.md --genre docs             # human-readable report
friction check doc.md --genre blog --format json
friction check doc.md --format sarif > report.sarif
```

## Genres

The metric envelope (the per-metric human bands the document is judged
against) is measured per genre. Pick the one that matches the register,
not the file type:

| genre | use for |
|---|---|
| `docs` | reference docs, guides, design notes (the default, with a printed note) |
| `readme` | project READMEs specifically |
| `blog` | narrative engineering posts |
| `email` | announcements, incident notices, outreach |
| `forum` | Q&A and discussion-style prose |

The same document can sit inside the `forum` envelope and outside the
`docs` one; a wrong genre produces confident nonsense. If the register
is ambiguous, say so and show both.

## Reading the report

- **Metric rows** compare the document's measured distribution
  (sentence rhythm, contraction ratio, triad rate, and the rest of the
  21-metric vector) against the genre's human band. The envelope is
  two-sided: a document can be flagged for being *more* machine-flavored
  or *more* human-favored than the band in either direction.
- **Spans** are the detection channels (DMS differential, frame
  templates, jargon metaphors, overuse bursts) with byte-exact
  locations.
- **`--residual`** appends DMS-flagged spans that no compiled frame rule
  covers — the tells the statistical channel sees but the rule set
  cannot yet explain. Present these as "detected, unexplained" — they
  are a research queue, not findings with named causes.

## Exit codes and CI

`check` exits `0` only when every metric is in-envelope and no span was
detected. Treat nonzero as "report has content", not as failure. A
flagged document is the command working. For CI gating, SARIF output
validates against the 2.1.0 schema and uploads to code-scanning UIs;
pin the friction-cli version in the workflow so a version bump is a
deliberate commit.
