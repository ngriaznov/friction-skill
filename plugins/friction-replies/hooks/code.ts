// Keeps friction's edits on prose: everything that reads as code goes to
// friction as inline code, which it never edits, and must come back intact.

// Marks the inline code spans `protect` adds, so `restore` can take them off.
const MARK = '\u2060'

// A fence line: up to any indentation (fences nest in list items), then a
// run of three or more backticks or tildes.
const FENCE = /^[ \t]*(`{3,}|~{3,})/

// A command line written as prose: a CLI, then a subcommand it is known by or
// one followed by arguments, then each argument that has a symbol in it
// (`npm install --save left-pad`). It stops at the first plain word, so the
// sentence around it stays prose.
const ARG = String.raw`(?:\s+(?:--?[A-Za-z][\w-]*(?:=[^\s,;!?'"()\x60]+)?|[^\s,;!?'"()\x60]*[\/@=_.:-][^\s,;!?'"()\x60]*[^\s.,;:!?'"()\x60]))`
const COMMAND =
  String.raw`\b(?:npm|npx|pnpm|yarn|pipx?|pip3|uv|cargo|rustup|brew|apt-get|apt|git|gh|docker|kubectl|helm|curl|wget|composer|dotnet|mvn|gradle|deno|bun|terraform)` +
  String.raw`\s+(?:(?:install|i|add|remove|rm|run|exec|build|test|clone|push|pull|fetch|commit|checkout|switch|init|update|upgrade|publish|create|apply|get|set|start|stop|login|plan)\b${ARG}*|[a-z][\w-]*${ARG}+)`

// In prose, in this order: what is left as it is (inline code, a link's
// destination, an autolink, an HTML tag), then what reads as code.
const PROSE_TOKEN = new RegExp(
  [
    /(?<code>(`+)(?!`)[\s\S]*?[^`]\2(?!`))/.source,
    /(?<keep>\]\([^)\s]*(?:\s+"[^"]*")?\)|<[a-z][a-z0-9+.-]*:[^\s<>]*>|<\/?[A-Za-z][^<>]*>)/.source,
    '(?<bare>' +
      [
        COMMAND,
        /(?:https?|ftp|file):\/\/[^\s<>()`]*[^\s<>()`.,;:!?'"]/.source,
        /www\.[^\s<>()`]*[^\s<>()`.,;:!?'"]/.source,
        // a path: word characters on both sides of a slash
        /(?:~|\.{1,2})?\/?[\w.@-]*\w\/[\w.@/-]*\w\/?/.source,
        // a call, whole: leverageCache(), obj.load(path)
        /\b[\w.:]+\([^()\s]*\)/.source,
        // an identifier: snake_case, camelCase, PascalCase with an inner capital, a::b, $VAR
        /\$?\b\w*_\w+\b|\b[a-z]+[A-Z]\w*\b|\b[A-Z][a-z0-9]+[A-Z]\w*\b|\b\w+(?:::\w+)+\b|\$[A-Za-z_]\w*/.source,
        // a dotted name (file.rs, obj.method), a flag
        /\b\w+(?:\.\w+)+\b|(?<![\w-])--?[A-Za-z][\w-]*/.source,
      ].join('|') +
      ')',
  ].join('|'),
  'g',
)

export type Protected = {
  /** The text friction reads: code-like words in prose wrapped as inline code. */
  masked: string
  /** Every piece of code, as `masked` spells it, in order. */
  segments: string[]
  /** Whether anything outside code has letters in it. */
  hasProse: boolean
}

function protectProse(prose: string, segments: string[]): { text: string; hasProse: boolean } {
  let hasProse = false
  let last = 0
  let text = ''
  for (const m of prose.matchAll(PROSE_TOKEN)) {
    const between = prose.slice(last, m.index)
    if (/[A-Za-z]{2}/.test(between)) hasProse = true
    text += between
    const token = m[0]
    if (m.groups?.code !== undefined) {
      segments.push(token)
      text += token
    } else if (m.groups?.keep !== undefined) {
      text += token
    } else if (/[A-Za-z]{2}/.test(token)) {
      const wrapped = `\`${MARK}${token}\``
      segments.push(wrapped)
      text += wrapped
    } else {
      // e.g, 0.6.18: nothing friction would edit
      text += token
    }
    last = m.index + token.length
  }
  const tail = prose.slice(last)
  if (/[A-Za-z]{2}/.test(tail)) hasProse = true

  return { text: text + tail, hasProse }
}

export function protect(text: string): Protected {
  const segments: string[] = []
  const lines = text.split(/(?<=\n)/)
  let masked = ''
  let hasProse = false
  let prose = ''
  const flushProse = () => {
    const done = protectProse(prose, segments)
    masked += done.text
    hasProse ||= done.hasProse
    prose = ''
  }
  for (let i = 0; i < lines.length; i++) {
    const open = (lines[i] ?? '').match(FENCE)?.[1]
    if (open === undefined) {
      prose += lines[i]
      continue
    }
    flushProse()
    // The block runs to a fence of the same character at least as long, or to
    // the end of the text when none closes it.
    const close = new RegExp(`^[ \\t]*${open[0] === '`' ? '`' : '~'}{${open.length},}[ \\t]*\\r?\\n?$`)
    let block = lines[i] ?? ''
    while (i + 1 < lines.length) {
      i++
      block += lines[i]
      if (close.test(lines[i] ?? '')) break
    }
    segments.push(block)
    masked += block
  }
  flushProse()

  return { masked, segments, hasProse }
}

// friction's output with the wrapping taken off, or `null` when any piece of
// code did not come back as it went in.
export function restore(output: string, segments: readonly string[]): string | null {
  let from = 0
  for (const segment of segments) {
    const at = output.indexOf(segment, from)
    if (at < 0) return null
    from = at + segment.length
  }

  return output.replace(new RegExp(`\`${MARK}([^\`]*)\``, 'g'), '$1')
}
