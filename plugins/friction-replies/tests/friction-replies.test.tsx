import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Args, CommandRunResult, On, ProcessRunResult } from 'claude-code'

import { protect, restore } from '../hooks/code'
import { wordDiff } from '../hooks/diff'

type Append = Args<'session.append'>
type Block = Append['message']['content'][number]

const RULES: [RegExp, string, string][] = [
  [/\bin order to\b/g, 'to', 'sub.apply'],
  [/\bleverages\b/g, 'uses', 'sub.apply'],
]

const result = (exitCode: number, stdout: string, stderr = ''): { value: ProcessRunResult } => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

// Fenced blocks and inline code, which friction never edits.
const CODE = /(```[\s\S]*?```|`[^`]*`)/

// Stands in for the friction binary: a couple of its substitutions, made
// outside code as friction makes them (or everywhere, `mangles`), its JSON
// summary on stderr, and (like npx) a notice around it. Trims its output so
// the tests see the mod put the block's own edges back.
function fakeFriction(on: On, { fails = false, missing = false, mangles = false } = {}) {
  const calls: string[][] = []
  on('process.run', async ($, e) => {
    calls.push([...e.argv])
    if (missing) throw new Error(`spawn ${e.argv[0]} ENOENT`)
    if (e.argv.includes('--version')) return result(0, 'friction 0.6.18\n')
    if (fails) return result(2, '', 'error: the input failed to parse as markdown\n')
    const byRule: Record<string, number> = {}
    let patches = 0
    const fix = (part: string) =>
      RULES.reduce(
        (done, [pattern, to, rule]) =>
          done.replace(pattern, () => {
            patches++
            byRule[rule] = (byRule[rule] ?? 0) + 1

            return to
          }),
        part,
      )
    const stdin = e.init?.stdin ?? ''
    const text = mangles
      ? fix(stdin)
      : stdin
          .split(CODE)
          .map((part, i) => (i % 2 === 1 ? part : fix(part)))
          .join('')
    const summary = { passes: 1, patches_applied: patches, patches_by_rule: byRule, suggest_count: 0, paraphrase_count: 0 }

    return result(0, text.trim(), `npm warn exec notice\n${JSON.stringify(summary, null, 2)}\n`)
  })

  return calls
}

// Nothing in the kit stores a row beneath the plugins, so this records each
// row as the mod hands it on (its own `next` then rejects, which the test
// swallows) and answers the status line.
function harness(on: On) {
  const stored: Block[][] = []
  const status: (string | undefined)[] = []
  on('session.append', ($, e, next) => {
    stored.push([...e.message.content])

    return next(e)
  })
  on('ui.status', ($, e) => {
    status.push(e.text)

    return { value: undefined }
  })

  return { stored, status }
}

const reply = (text: string, extra: Partial<Append> = {}): Append => ({
  message: {
    type: 'assistant',
    role: 'assistant',
    content: [
      { type: 'text', text },
      { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls' } },
    ],
  },
  door: 'response',
  origin: { kind: 'model', model: 'claude-test' },
  uuid: 'row-1',
  ...extra,
})

async function append($: Engine, stored: Block[][], input: Append): Promise<Block[]> {
  const before = stored.length
  await $.session.append(input).catch(() => undefined)
  const row = stored[before]
  if (row === undefined) throw new Error('the row was never handed on')

  return row
}

const friction = ($: Engine, args = ''): Promise<CommandRunResult> =>
  $.command.run({
    command: 'friction-replies',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })

describe('fix mode', () => {
  test('rewrites the reply text and leaves the tool call alone', async ($, on) => {
    fakeFriction(on)
    const { stored, status } = harness(on)

    const content = await append($, stored, reply('The agent leverages the cache in order to go fast.'))

    expect(content).toEqual([
      { type: 'text', text: 'The agent uses the cache to go fast.' },
      { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls' } },
    ])
    expect(status.at(-1)).toBeUndefined()
  })

  test("keeps the block's leading and trailing whitespace", async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)

    const content = await append($, stored, reply('\nThe agent leverages the cache.\n\n'))

    expect(content[0]).toEqual({ type: 'text', text: '\nThe agent uses the cache.\n\n' })
  })

  test('finds friction once, then only fixes', async ($, on) => {
    const calls = fakeFriction(on)
    const { stored } = harness(on)

    await append($, stored, reply('It leverages one.'))
    await append($, stored, reply('It leverages two.', { uuid: 'row-2' }))

    expect(calls).toEqual([
      ['friction', '--version'],
      ['friction', 'fix', '--format', 'json', '-'],
      ['friction', 'fix', '--format', 'json', '-'],
    ])
  })

  test('runs the configured command', { options: { command: 'npx -y friction-cli@0.6.18' } }, async ($, on) => {
    const calls = fakeFriction(on)
    const { stored } = harness(on)

    await append($, stored, reply('It leverages one.'))

    expect(calls[1]).toEqual(['npx', '-y', 'friction-cli@0.6.18', 'fix', '--format', 'json', '-'])
  })

  test('/friction shows what the last reply lost', async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)
    await append($, stored, reply('The agent leverages the cache in order to go fast.'))

    const { text } = await friction($)

    expect(text).toContain('friction: fix')
    expect(text).toContain('runs: friction (friction 0.6.18)')
    expect(text).toContain('replies: 1 read, 1 changed, 2 edits')
    expect(text).toContain('last change: 2 edits (sub.apply ×2)')
    expect(text).toContain('The agent [-leverages-]{+uses+} the cache [-in order-] to go fast.')
  })
})

describe('leaving replies as written', () => {
  test('check mode counts the edits and changes nothing', { options: { mode: 'check' } }, async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)

    const content = await append($, stored, reply('It leverages the cache.'))
    const { text } = await friction($)

    expect(content[0]).toEqual({ type: 'text', text: 'It leverages the cache.' })
    expect(text).toContain('replies: 1 read, 1 would change, 1 edits')
    expect(text).toContain('last possible change')
  })

  test('/friction off stops it for the session', async ($, on) => {
    const calls = fakeFriction(on)
    const { stored } = harness(on)

    const { text } = await friction($, 'off')
    const content = await append($, stored, reply('It leverages the cache.'))

    expect(text).toBe('friction is off for this session.')
    expect(content[0]).toEqual({ type: 'text', text: 'It leverages the cache.' })
    expect(calls).toEqual([])
  })

  test("subagents' replies pass through unless asked for", async ($, on) => {
    const calls = fakeFriction(on)
    const { stored } = harness(on)

    const content = await append($, stored, reply('It leverages the cache.', { agentId: 'agent-1' }))

    expect(content[0]).toEqual({ type: 'text', text: 'It leverages the cache.' })
    expect(calls).toEqual([])
  })

  test('a failing run keeps the reply and is counted', async ($, on) => {
    fakeFriction(on, { fails: true })
    const { stored, status } = harness(on)

    const content = await append($, stored, reply('It leverages the cache.'))
    const { text } = await friction($)

    expect(content[0]).toEqual({ type: 'text', text: 'It leverages the cache.' })
    expect(text).toContain('1 failed')
    expect(status.at(-1)).toBe('friction failed on 1 reply, see /friction-replies')
  })

  test('with no friction installed the reply passes through', async ($, on) => {
    fakeFriction(on, { missing: true })
    const { stored, status } = harness(on)

    const content = await append($, stored, reply('It leverages the cache.'))
    const { text } = await friction($)

    expect(content[0]).toEqual({ type: 'text', text: 'It leverages the cache.' })
    expect(text).toContain('runs: nothing found')
    expect(status.at(-1)).toBe('friction not found, see /friction-replies')
  })
})

// Stands in for the engine's own drawing of a reply.
function engineDraws(on: On) {
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.text}</Text>
  })
}

const SURFACES = ['terminal', 'desktop'] as const

const mountReply = ($: Engine, surface: (typeof SURFACES)[number], text: string) =>
  $.ui.mount({ plugin: 'friction-replies', surface, component: 'AssistantMessage', props: { text, isFirstOfReply: true } })

describe('the line under a changed reply', () => {
  test('draws the fixed text and a faint count', async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)
    engineDraws(on)
    await append($, stored, reply('The agent leverages the cache in order to go fast.'))

    for (const surface of SURFACES) {
      // The screen may hold the reply as it streamed, or as stored.
      for (const text of ['The agent leverages the cache in order to go fast.', 'The agent uses the cache to go fast.']) {
        const ui = await mountReply($, surface, text)
        expect((await ui.find({ type: 'Text', text: 'The agent uses the cache to go fast.' }))?.text).toBe(
          'The agent uses the cache to go fast.',
        )
        expect((await ui.find({ type: 'Text', text: /^friction · / }))?.text).toBe('friction · 2 edits · ')
        expect((await ui.find({ key: 'changes' }))?.text).toBe('show changes')
        await ui.unmount()
      }
    }
  })

  test('show changes opens the word diff and hide changes closes it', async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)
    engineDraws(on)
    await append($, stored, reply('The agent leverages the cache.'))

    for (const surface of SURFACES) {
      const ui = await mountReply($, surface, 'The agent uses the cache.')
      expect(await ui.find({ type: 'Text', text: '[-leverages-]' })).toBeUndefined()

      await ui.press({ key: 'changes' })
      expect((await ui.find({ type: 'Text', text: '[-leverages-]' }))?.text).toBe('The agent [-leverages-]{+uses+} the cache.')
      expect((await ui.find({ key: 'changes' }))?.text).toBe('hide changes')

      await ui.press({ key: 'changes' })
      expect(await ui.find({ type: 'Text', text: '[-leverages-]' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('check mode counts possible edits under the reply as written', { options: { mode: 'check' } }, async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)
    engineDraws(on)
    await append($, stored, reply('It leverages the cache.'))

    for (const surface of SURFACES) {
      const ui = await mountReply($, surface, 'It leverages the cache.')
      expect(await ui.find({ type: 'Text', text: 'It leverages the cache.' })).toBeDefined()
      expect((await ui.find({ type: 'Text', text: /^friction · / }))?.text).toBe('friction · 1 possible edit · ')
      await ui.unmount()
    }
  })

  test('a reply friction left alone draws as the engine draws it', async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)
    engineDraws(on)
    await append($, stored, reply('Nothing here needs fixing.'))

    for (const surface of SURFACES) {
      const ui = await mountReply($, surface, 'Nothing here needs fixing.')
      expect(await ui.drawn()).toEqual({ type: 'Text', children: ['Nothing here needs fixing.'] })
      await ui.unmount()
    }
  })
})

describe('code stays as written', () => {
  test('code-like words in prose are left alone and the prose around them is fixed', async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)

    const content = await append(
      $,
      stored,
      reply('It leverages utilize_cache in order to warm src/leverages/x.rs and https://x.dev/leverages.'),
    )

    expect(content[0]).toEqual({
      type: 'text',
      text: 'It uses utilize_cache to warm src/leverages/x.rs and https://x.dev/leverages.',
    })
  })

  test('fenced and inline code come back byte for byte', async ($, on) => {
    fakeFriction(on)
    const { stored } = harness(on)
    const fence = '```python\n# it leverages the cache in order to skip reads\nx = 1\n```'

    const content = await append($, stored, reply(`It leverages \`leverages()\` in order to skip reads:\n\n${fence}\n`))

    expect(content[0]).toEqual({ type: 'text', text: `It uses \`leverages()\` to skip reads:\n\n${fence}\n` })
  })

  test('an edit that reaches code keeps the whole block as written', async ($, on) => {
    fakeFriction(on, { mangles: true })
    const { stored } = harness(on)
    const text = 'It leverages the cache:\n\n```js\nconst leverages = 1\n```\n'

    const content = await append($, stored, reply(text))
    const report = await friction($)

    expect(content[0]).toEqual({ type: 'text', text })
    expect(report.text).toContain('1 kept as written because an edit reached code')
  })

  test('a reply that is all code never reaches friction', async ($, on) => {
    const calls = fakeFriction(on)
    const { stored } = harness(on)

    const content = await append($, stored, reply('```ts\nconst leverages = 1\n```'))

    expect(content[0]).toEqual({ type: 'text', text: '```ts\nconst leverages = 1\n```' })
    expect(calls).toEqual([])
  })
})

describe('protect and restore', () => {
  test('wrap code-like words, keep code spans, and leave links and abbreviations alone', () => {
    const { masked, segments, hasProse } = protect(
      'Run `x` and npm install --save left-pad, e.g. v0.6.18, with leverageCache() on std::fs; see [docs](https://x.dev/a_b).',
    )

    expect(hasProse).toBe(true)
    expect(segments).toEqual(['`x`', '`\u2060npm install --save left-pad`', '`\u2060leverageCache()`', '`\u2060std::fs`'])
    expect(masked).toBe(
      'Run `x` and `\u2060npm install --save left-pad`, e.g. v0.6.18, with `\u2060leverageCache()` on `\u2060std::fs`; see [docs](https://x.dev/a_b).',
    )
    expect(restore(masked, segments)).toBe(
      'Run `x` and npm install --save left-pad, e.g. v0.6.18, with leverageCache() on std::fs; see [docs](https://x.dev/a_b).',
    )
  })

  test('a fence left open runs to the end, and prose outside it still counts', () => {
    const { segments, hasProse } = protect('Here it is:\n\n```js\nconst a_b = 1\n')

    expect(segments).toEqual(['```js\nconst a_b = 1\n'])
    expect(hasProse).toBe(true)
    expect(protect('```js\nconst a_b = 1\n```\n').hasProse).toBe(false)
  })

  test('a piece of code that did not come back fails the restore', () => {
    const { masked, segments } = protect('Use `load()` in order to read it.')

    expect(restore(masked.replace('load', 'read'), segments)).toBeNull()
  })
})

describe('wordDiff', () => {
  test('marks the changed words of the changed lines only', () => {
    expect(wordDiff('a line kept\nWe leverage it in order to win.\n', 'a line kept\nWe use it to win.\n')).toBe(
      'We [-leverage-]{+use+} it [-in order-] to win.',
    )
  })
})
