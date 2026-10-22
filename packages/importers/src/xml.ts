// Minimal XML 1.0 reader for workbook parts (https://www.w3.org/TR/xml/, section numbers below
// refer to it): one left-to-right pass, no document type declarations, so no entity can be
// declared, expanded or fetched.

export interface XmlElement {
  /** Name without its namespace prefix. */
  name: string
  /** Attributes by name without prefix; `xmlns` declarations left out. */
  attributes: Record<string, string>
  children: (XmlElement | string)[]
}

// assumed bound, not a cited one: worksheet XML nests 5 deep
const maxDepth = 32
// assumed bound, not a cited one: workbook elements carry fewer than 20 attributes
const maxAttributes = 256

const predefined: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

/** Section 2.2 `Char`. */
const isXmlChar = (c: number) =>
  c === 0x9 ||
  c === 0xa ||
  c === 0xd ||
  (c >= 0x20 && c <= 0xd7ff) ||
  (c >= 0xe000 && c <= 0xfffd) ||
  (c >= 0x10000 && c <= 0x10ffff)

/**
 * Text with the five predefined entities (4.6) and character references (4.1) replaced. Pieces
 * are joined in batches, so memory stays near the size of the text for any number of references.
 */
function references(text: string): string {
  let amp = text.indexOf('&')
  if (amp < 0) return text
  let out = ''
  const pieces: string[] = []
  let from = 0
  while (amp >= 0) {
    pieces.push(text.slice(from, amp))
    const semi = text.indexOf(';', amp + 1)
    const next = text.indexOf('&', amp + 1)
    if (semi <= amp + 1 || (next >= 0 && next < semi)) throw new Error('bare & in text')
    const name = text.slice(amp + 1, semi)
    let replacement = Object.hasOwn(predefined, name) ? predefined[name] : undefined
    if (replacement === undefined) {
      const m = /^#(?:x([0-9a-fA-F]+)|([0-9]+))$/.exec(name)
      if (!m) throw new Error(`unknown entity &${name};`)
      const code = m[1] ? Number.parseInt(m[1], 16) : Number(m[2])
      if (!isXmlChar(code)) throw new Error(`character reference &${name}; is not an XML character`)
      replacement = String.fromCodePoint(code)
    }
    pieces.push(replacement)
    if (pieces.length >= 8192) {
      out += pieces.join('')
      pieces.length = 0
    }
    from = semi + 1
    amp = next
  }
  pieces.push(text.slice(from))
  return out + pieces.join('')
}

const local = (name: string) => name.slice(name.indexOf(':') + 1)
const nameAt = /[^\s/>=<"']+/y
const attributeAt = /\s+([^\s/>=<"']+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/y
const tagEnd = /\s*(\/?)>/y
const endTagAt = /([^\s/>=<"']+)\s*>/y

function match(re: RegExp, text: string, at: number): RegExpExecArray | null {
  re.lastIndex = at
  return re.exec(text)
}

/** Elements and characters (text and attribute markup) `scanXml` may still read. */
export interface XmlBudget {
  elements: number
  characters: number
}

/** Callbacks of `scanXml`; names and `path` entries are local names (without prefix). */
interface XmlEvents {
  /** A start tag that passed its checks; `path` holds the enclosing elements, root first. */
  open(name: string, attributes: Record<string, string>, path: readonly string[]): void
  /** Text or CDATA inside an element, references replaced; `path` ends with that element. */
  text(text: string, path: readonly string[]): void
  /** An end tag, or the end of an empty-element tag; `path` holds the enclosing elements. */
  close(name: string, path: readonly string[]): void
}

/** Counts `n` down from `remaining[key]`; throws once the budget is used up. */
function spend(remaining: XmlBudget | undefined, key: keyof XmlBudget, n: number): void {
  if (!remaining) return
  remaining[key] -= n
  if (remaining[key] < 0) throw new Error(`more ${key} than allowed`)
}

/** Position of `marker` from `from`; throws naming the unclosed `what` when it is absent. */
function closing(text: string, marker: string, from: number, what: string): number {
  const e = text.indexOf(marker, from)
  if (e < 0) throw new Error(`unclosed ${what}`)
  return e
}

/** Attributes of the start tag `qname` from `at`, and the position after the last one. */
function readAttributes(
  text: string,
  at: number,
  qname: string,
  remaining: XmlBudget | undefined,
): { attributes: Record<string, string>; end: number } {
  const attributes: Record<string, string> = {}
  const seen = new Set<string>()
  let end = at
  for (let a = match(attributeAt, text, end); a; a = match(attributeAt, text, end)) {
    if (seen.has(a[1])) throw new Error(`duplicate attribute ${a[1]} in <${qname}>`)
    seen.add(a[1])
    if (seen.size > maxAttributes) {
      throw new Error(`more than ${maxAttributes} attributes in <${qname}>`)
    }
    spend(remaining, 'characters', a[0].length)
    if (a[1] !== 'xmlns' && !a[1].startsWith('xmlns:')) {
      attributes[local(a[1])] = references(a[2] ?? a[3])
    }
    end += a[0].length
  }
  return { attributes, end }
}

/** The start tag at `lt`: its qualified name, attributes, whether it is empty, and its end. */
function readStartTag(
  text: string,
  lt: number,
  remaining: XmlBudget | undefined,
): { qname: string; attributes: Record<string, string>; empty: boolean; end: number } {
  const n = match(nameAt, text, lt + 1)
  if (!n) throw new Error('malformed tag')
  const qname = n[0]
  spend(remaining, 'elements', 1)
  const { attributes, end } = readAttributes(text, lt + 1 + qname.length, qname, remaining)
  const close = match(tagEnd, text, end)
  if (!close) throw new Error(`malformed tag <${qname}>`)
  return { qname, attributes, empty: close[1] !== '', end: end + close[0].length }
}

/**
 * Reads `text` left to right and reports its elements and text to `events`; throws on markup
 * this reader does not accept. `remaining` is counted down before each element or text is
 * reported, so several parts can share one budget. Errors thrown by `events` are not caught.
 */
export function scanXml(text: string, events: XmlEvents, remaining?: XmlBudget): void {
  const qnames: string[] = []
  const path: string[] = []
  let rooted = false
  const addText = (t: string) => {
    if (path.length > 0) events.text(t, path)
    else if (t.trim()) throw new Error('text outside the root element')
  }
  let i = 0
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) {
      spend(remaining, 'characters', text.length - i)
      addText(references(text.slice(i)))
      break
    }
    if (lt > i) {
      spend(remaining, 'characters', lt - i)
      addText(references(text.slice(i, lt)))
    }
    if (text.startsWith('<?', lt)) {
      const e = closing(text, '?>', lt + 2, 'processing instruction')
      const pi = text.slice(lt + 2, e)
      const encoding = /^xml\s[\s\S]*?encoding\s*=\s*["']([^"']*)["']/.exec(pi)?.[1]
      if (encoding !== undefined && encoding.toLowerCase() !== 'utf-8') {
        throw new Error(`encoding "${encoding}" is not read; only UTF-8`)
      }
      i = e + 2
    } else if (text.startsWith('<!--', lt)) {
      i = closing(text, '-->', lt + 4, 'comment') + 3
    } else if (text.startsWith('<![CDATA[', lt)) {
      const e = closing(text, ']]>', lt + 9, 'CDATA section')
      spend(remaining, 'characters', e - lt - 9)
      addText(text.slice(lt + 9, e))
      i = e + 3
    } else if (text.startsWith('<!DOCTYPE', lt)) {
      throw new Error('DOCTYPE is not allowed')
    } else if (text[lt + 1] === '!') {
      throw new Error('markup declarations are not allowed')
    } else if (text[lt + 1] === '/') {
      const m = match(endTagAt, text, lt + 2)
      const top = qnames.pop()
      if (!m || top === undefined || m[1] !== top) {
        throw new Error(`end tag </${m?.[1] ?? ''}> does not match <${top ?? ''}>`)
      }
      const name = path.pop() as string
      events.close(name, path)
      i = lt + 2 + m[0].length
    } else {
      const tag = readStartTag(text, lt, remaining)
      if (qnames.length >= maxDepth) throw new Error(`elements nest deeper than ${maxDepth}`)
      if (qnames.length === 0) {
        if (rooted) throw new Error('more than one root element')
        rooted = true
      }
      const name = local(tag.qname)
      events.open(name, tag.attributes, path)
      if (tag.empty) events.close(name, path)
      else {
        qnames.push(tag.qname)
        path.push(name)
      }
      i = tag.end
    }
  }
  if (qnames.length > 0) throw new Error(`unclosed element <${qnames.at(-1)}>`)
  if (!rooted) throw new Error('no root element')
}

/** The root element of `text` as a tree, read with `scanXml` (same checks and budget). */
export function parseXml(text: string, remaining?: XmlBudget): XmlElement {
  const stack: XmlElement[] = []
  let root: XmlElement | undefined
  scanXml(
    text,
    {
      open(name, attributes) {
        const element: XmlElement = { name, attributes, children: [] }
        const top = stack.at(-1)
        if (top) top.children.push(element)
        else root = element
        stack.push(element)
      },
      text(t) {
        stack.at(-1)?.children.push(t)
      },
      close() {
        stack.pop()
      },
    },
    remaining,
  )
  return root as XmlElement
}
