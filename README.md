# friction-skill

A Claude Code plugin that teaches Claude to run
[friction](https://friction-cli.dev) on the technical prose it produces
— apply the deterministic fixes, then revise the constructions friction
can only detect.

[friction](https://github.com/ngriaznov/friction) is a deterministic
engine that removes the machine layer from LLM-generated English
technical documentation: ritual closers, filler spans, hedge phrases,
register tells. It never invents content and reports instead of
rewriting when no gated edit exists. This skill closes the loop: the
report tier becomes Claude's revision checklist.

## Install

```
/plugin marketplace add ngriaznov/friction-skill
/plugin install friction-skill@friction-skill
```

The skill invokes the CLI as `npx friction-cli@latest`, so nothing is
installed and every session runs the newest published friction release.
It also refreshes its own marketplace clone once per session, so skill
updates arrive without a manual step.

## What Claude does with it

On every prose deliverable (README, docs, blog post, PR text) Claude:

1. runs `friction fix --in-place --suggest` on the file,
2. keeps every applied patch untouched (they are gated and
   deterministic),
3. revises the *constructions* behind held findings — restructuring an
   em-dash sentence rather than swapping punctuation, recasting a
   flagged verb's clause rather than synonym-swapping,
4. re-runs until the pass applies nothing and remaining findings are
   consciously accepted.

Reference sheets cover the rest of the surface: `friction check` with
genre envelopes and SARIF, `friction explain` provenance, `--residual`,
stdin snippets, and HTML input.

## Scope

English technical prose only: friction is inert on other languages and
miscalibrated on fiction or marketing copy, and the skill says so.

## License

MIT.
