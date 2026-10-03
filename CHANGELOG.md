# Changelog

## 0.1.0

Initial release: the fix/suggest/revise loop as the core skill, with
reference sheets for `check` (genres, SARIF, exit codes), `explain`
(held-reason taxonomy, `--residual`), and input modes (stdin, HTML,
stdout-vs-`--in-place` discipline). Written against friction 0.6.0.

## 0.1.1

The CLI is always invoked as `npx friction-cli@latest` (no install, no
update step, always the newest release), and the skill refreshes its own
marketplace clone once per session so skill updates arrive on their own.

## friction-replies 0.1.0

A second plugin in the marketplace: a Claude Code mod that pipes each
text block of Claude's reply through `friction fix` before the reply is
stored. `/friction-replies` shows the last change as a word diff and
switches between `fix`, `check`, and `off`. Written against friction
0.6.17 and Claude Code 2.1.288's function-hooks API.

## friction-replies 0.1.1

Each reply friction changed gets one faint line under it, `friction · 5
edits · show changes`, and pressing it opens the reply's word diff in
place. The status line, which Claude Code draws as a pinned warning, now
appears only when friction fails or is missing.

## friction-replies 0.1.2

friction edits prose only. Code written without backticks (identifiers,
paths, URLs, flags, command lines) reaches friction as inline code, which
it never edits, and every piece of code in a reply, fenced or inline, must
come back byte for byte or the block is stored as Claude wrote it. Reply
blocks that are all code no longer reach friction. Before this,
`utilize_cache` in prose came back as `use _cache`, and paths and bare
URLs lost words to substitutions.
