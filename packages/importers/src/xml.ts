// Minimal XML 1.0 reader for workbook parts (https://www.w3.org/TR/xml/, section numbers below
// refer to it): one left-to-right pass, no document type declarations, so no entity can be
// declared, expanded or fetched.
import { refuseFile } from './diagnostics.ts'

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

/** The text of the entity or character reference `&name;`. */
function replacementOf(name: string): string {
  const known = Object.hasOwn(predefined, name) ? predefined[name] : undefined
  if (known !== undefined) return known
  const m = /^#(?:x([0-9a-fA-F]+)|([0-9]+))$/.exec(name)
  if (!m) refuseFile('unknownEntity', { name })
  const code = m[1] ? Number.parseInt(m[1], 16) : Number(m[2])
  if (!isXmlChar(code)) refuseFile('notXmlChar', { name })
  return String.fromCodePoint(code)
}

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
    if (semi <= amp + 1 || (next >= 0 && next < semi)) refuseFile('bareAmpersand')
    const name = text.slice(amp + 1, semi)
    pieces.push(replacementOf(name))
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

function match(re: RegExp, text: string, at: number): RegExpExecArray | null {
  re.lastIndex = at
  return re.exec(text)
}

const space = /\s/

/** The position of the first character from `at` that is not white space. */
function skipSpace(text: string, at: number): number {
  let i = at
  while (i < text.length && space.test(text.charAt(i))) i++
  return i
}

/** One attribute (white space, name, `=`, a quoted value without `<`) at `at`, else null. */
function attributeAt(
  text: string,
  at: number,
): { name: string; value: string; length: number } | null {
  const start = skipSpace(text, at)
  const n = start > at ? match(nameAt, text, start) : null
  if (!n) return null
  const eq = skipSpace(text, start + n[0].length)
  if (text.charAt(eq) !== '=') return null
  const open = skipSpace(text, eq + 1)
  const quote = text.charAt(open)
  if (quote !== '"' && quote !== "'") return null
  const close = text.indexOf(quote, open + 1)
  const value = close < 0 ? '' : text.slice(open + 1, close)
  if (close < 0 || value.includes('<')) return null
  return { name: n[0], value, length: close + 1 - at }
}

/** The end of a start tag at `at` (`>` or `/>` after white space), else null. */
function tagEndAt(text: string, at: number): { empty: boolean; length: number } | null {
  const i = skipSpace(text, at)
  const empty = text.charAt(i) === '/'
  return text.charAt(i + (empty ? 1 : 0)) === '>'
    ? { empty, length: i + (empty ? 2 : 1) - at }
    : null
}

/** The name and length of an end tag body (`name`, white space, `>`) at `at`, else null. */
function endTagBodyAt(text: string, at: number): { name: string; length: number } | null {
  const n = match(nameAt, text, at)
  if (!n) return null
  const i = skipSpace(text, at + n[0].length)
  return text.charAt(i) === '>' ? { name: n[0], length: i + 1 - at } : null
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
  if (remaining[key] < 0) refuseFile('xmlBudgetSpent', { key })
}

/** Position of `marker` from `from`; refuses with `unclosed` when it is absent. */
function closing(
  text: string,
  marker: string,
  from: number,
  unclosed: 'unclosedProcessingInstruction' | 'unclosedComment' | 'unclosedCdata',
): number {
  const e = text.indexOf(marker, from)
  return e < 0 ? refuseFile(unclosed) : e
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
  for (let a = attributeAt(text, end); a; a = attributeAt(text, end)) {
    const name = a.name
    if (seen.has(name)) refuseFile('duplicateAttribute', { name, tag: qname })
    seen.add(name)
    if (seen.size > maxAttributes) refuseFile('tooManyAttributes', { max: maxAttributes, tag: qname })
    spend(remaining, 'characters', a.length)
    if (name !== 'xmlns' && !name.startsWith('xmlns:')) {
      attributes[local(name)] = references(a.value)
    }
    end += a.length
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
  if (!n) refuseFile('malformedTag')
  const qname = n[0]
  spend(remaining, 'elements', 1)
  const { attributes, end } = readAttributes(text, lt + 1 + qname.length, qname, remaining)
  const close = tagEndAt(text, end)
  if (!close) refuseFile('malformedTagNamed', { tag: qname })
  return { qname, attributes, empty: close.empty, end: end + close.length }
}

/** What `scanXml` keeps while it reads. */
interface ScanState {
  events: XmlEvents
  remaining: XmlBudget | undefined
  /** Qualified names of the open elements. */
  qnames: string[]
  /** Local names of the open elements. */
  path: string[]
  rooted: boolean
}

function addText(st: ScanState, t: string): void {
  if (st.path.length > 0) st.events.text(t, st.path)
  else if (t.trim()) refuseFile('textOutsideRoot')
}

/** Refuses an XML declaration that names an encoding other than UTF-8. */
function checkEncoding(pi: string): void {
  const encoding = /^xml\s[\s\S]*?encoding\s*=\s*["']([^"']*)["']/.exec(pi)?.[1]
  if (encoding !== undefined && encoding.toLowerCase() !== 'utf-8')
    refuseFile('encodingNotRead', { encoding })
}

/** Closes the element named by the end tag at `lt`; returns the position after the tag. */
function readEndTag(text: string, lt: number, st: ScanState): number {
  const m = endTagBodyAt(text, lt + 2)
  const top = st.qnames.pop()
  if (!m || top === undefined || m.name !== top)
    refuseFile('endTagMismatch', { end: m?.name ?? '', start: top ?? '' })
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the path grows with qnames, so it holds the element closed here
  const name = st.path.pop() as string
  st.events.close(name, st.path)
  return lt + 2 + m.length
}

/** Opens the element of the start tag at `lt`; returns the position after the tag. */
function readElement(text: string, lt: number, st: ScanState): number {
  const tag = readStartTag(text, lt, st.remaining)
  if (st.qnames.length >= maxDepth) refuseFile('nestTooDeep', { max: maxDepth })
  if (st.qnames.length === 0) {
    if (st.rooted) refuseFile('secondRoot')
    st.rooted = true
  }
  const name = local(tag.qname)
  st.events.open(name, tag.attributes, st.path)
  if (tag.empty) st.events.close(name, st.path)
  else {
    st.qnames.push(tag.qname)
    st.path.push(name)
  }
  return tag.end
}

/** Reads the markup at `lt` (a `<`); returns the position after it. */
function readMarkup(text: string, lt: number, st: ScanState): number {
  if (text.startsWith('<?', lt)) {
    const e = closing(text, '?>', lt + 2, 'unclosedProcessingInstruction')
    checkEncoding(text.slice(lt + 2, e))
    return e + 2
  }
  if (text.startsWith('<!--', lt)) return closing(text, '-->', lt + 4, 'unclosedComment') + 3
  if (text.startsWith('<![CDATA[', lt)) {
    const e = closing(text, ']]>', lt + 9, 'unclosedCdata')
    spend(st.remaining, 'characters', e - lt - 9)
    addText(st, text.slice(lt + 9, e))
    return e + 3
  }
  if (text.startsWith('<!DOCTYPE', lt)) refuseFile('doctype')
  if (text[lt + 1] === '!') refuseFile('markupDeclaration')
  if (text[lt + 1] === '/') return readEndTag(text, lt, st)
  return readElement(text, lt, st)
}

/**
 * Reads `text` left to right and reports its elements and text to `events`; throws on markup
 * this reader does not accept. `remaining` is counted down before each element or text is
 * reported, so several parts can share one budget. Errors thrown by `events` are not caught.
 */
export function scanXml(text: string, events: XmlEvents, remaining?: XmlBudget): void {
  const st: ScanState = { events, remaining, qnames: [], path: [], rooted: false }
  let i = 0
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) {
      spend(remaining, 'characters', text.length - i)
      addText(st, references(text.slice(i)))
      break
    }
    if (lt > i) {
      spend(remaining, 'characters', lt - i)
      addText(st, references(text.slice(i, lt)))
    }
    i = readMarkup(text, lt, st)
  }
  if (st.qnames.length > 0) refuseFile('unclosedElement', { tag: st.qnames.at(-1) ?? '' })
  if (!st.rooted) refuseFile('noRoot')
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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- scanXml refuses a text without a root element, so `open` set it
  return root as XmlElement
}
