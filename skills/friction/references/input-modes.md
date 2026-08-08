# Input modes and file discipline

## stdout vs `--in-place`

`fix` defaults to printing the fixed text to stdout and the summary to
stderr; the file on disk stays byte-identical. This is the safety
model, not an inconvenience:

- File you authored this session: `--in-place` is fine.
- File you did not author: never `--in-place` on the first run. Use
  stdout into a new file, show the diff (`git diff --no-index
  --word-diff original fixed`), and let the user decide.
- Piping: stdout carries only the fixed text, so `friction fix doc.md
  2>/dev/null` is clean input for the next tool.

## stdin snippets

For prose that isn't a file (a paragraph the user pasted, a commit
message draft):

```bash
printf '%s' "the text" | friction fix --suggest -
```

Everything works the same. Positions in findings refer to the piped
text. Very short inputs are handled honestly. The register bands use
confidence bounds, so a single semicolon in a two-line comment does not
arm a document-level feature.

## Markdown and HTML

Input syntax is detected from the extension (`.md`, `.html`/`.htm`) or
sniffed on stdin. In both formats friction edits only prose runs:
markdown structure, HTML tags, entities, attributes, code/pre spans,
`{{ }}`-style template markers, and executable script content are
byte-preserved. For HTML generated from another source (a deck, a site
builder), prefer running friction on the *generator's* source. Run it
on the HTML only when that source isn't available.

## Idempotence as a check

`fix` is idempotent: running it twice must produce byte-identical
output. If you ever observe it not converging, that is a friction bug
worth reporting to the user, not something to work around silently.
