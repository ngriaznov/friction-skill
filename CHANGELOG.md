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
