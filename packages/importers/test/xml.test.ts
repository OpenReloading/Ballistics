import { describe, expect, it } from 'vitest'
import { parseXml } from '../src/xml.ts'
import { refusal } from './refusal.ts'

/** `n` elements nested in one another. */
const nest = (n: number) => `${'<e>'.repeat(n - 1)}<e/>${'</e>'.repeat(n - 1)}`

describe('parseXml: markup and references', () => {
  it('reads elements, attributes, text, CDATA and prefixed names', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<!-- c --><x:a xmlns:x="urn:x" k=\'1\' x:id="r"><?pi?><b>t &lt;&gt;&amp;&quot;&apos;</b><![CDATA[<raw>&]]><c/></x:a>'
    expect(parseXml(xml)).toEqual({
      name: 'a',
      attributes: { k: '1', id: 'r' },
      children: [
        { name: 'b', attributes: {}, children: [`t <>&"'`] },
        '<raw>&',
        { name: 'c', attributes: {}, children: [] },
      ],
    })
  })

  it('replaces character references to XML characters', () => {
    expect(parseXml('<t>A&#66;&#x43;&amp;D</t>').children).toEqual(['ABC&D'])
    expect(parseXml('<t a="&#x1F600;"/>').attributes['a']).toBe('\u{1F600}')
  })

  it('refuses a document type declaration, unknown entities and a bare &', () => {
    expect(refusal(() => parseXml('<!DOCTYPE sst [<!ENTITY a "aaaa">]><sst/>'))).toEqual({
      code: 'doctype',
      params: {},
    })
    expect(refusal(() => parseXml('<t>&ext;</t>'))).toEqual({
      code: 'unknownEntity',
      params: { name: 'ext' },
    })
    const bare = { code: 'bareAmpersand', params: {} }
    expect(refusal(() => parseXml('<t>a & b</t>'))).toEqual(bare)
    expect(refusal(() => parseXml('<t a="&x"/>'))).toEqual(bare)
  })

  it('refuses character references that are not XML characters', () => {
    for (const name of ['#0', '#xD800', '#x110000', '#99999999999']) {
      expect(refusal(() => parseXml(`<t>&${name};</t>`))).toEqual({
        code: 'notXmlChar',
        params: { name },
      })
    }
  })
})

describe('parseXml: nesting, malformed markup, limits and encodings', () => {
  it('accepts nesting of 32 and refuses 33', () => {
    expect(parseXml(nest(32)).name).toBe('e')
    expect(refusal(() => parseXml(nest(33)))).toEqual({ code: 'nestTooDeep', params: { max: 32 } })
  })

  it('refuses malformed markup', () => {
    const refused: [string, object][] = [
      ['<a><b></a>', { code: 'endTagMismatch', params: { end: 'a', start: 'b' } }],
      ['<worksheet><row>', { code: 'unclosedElement', params: { tag: 'row' } }],
      ['<a k="1" k="2"/>', { code: 'duplicateAttribute', params: { name: 'k', tag: 'a' } }],
      ['<a/><b/>', { code: 'secondRoot', params: {} }],
      ['x<a/>', { code: 'textOutsideRoot', params: {} }],
      ['<a k=1/>', { code: 'malformedTagNamed', params: { tag: 'a' } }],
      ['', { code: 'noRoot', params: {} }],
      ['<a><!-- x</a>', { code: 'unclosedComment', params: {} }],
    ]
    for (const [xml, diagnostic] of refused)
      expect(refusal(() => parseXml(xml))).toEqual(diagnostic)
    const many = Array.from({ length: 257 }, (_, k) => `a${k}="1"`).join(' ')
    expect(refusal(() => parseXml(`<a ${many}/>`))).toEqual({
      code: 'tooManyAttributes',
      params: { max: 256, tag: 'a' },
    })
    expect(parseXml(`<a ${many.slice(0, many.lastIndexOf(' '))}/>`).name).toBe('a')
  })

  it('stops at the element and character limits it is given', () => {
    const left = { elements: 10, characters: 1e9 }
    expect(refusal(() => parseXml(`<r>${'<a/>'.repeat(100_000)}</r>`, left))).toEqual({
      code: 'xmlBudgetSpent',
      params: { key: 'elements' },
    })
    expect(left.elements).toBe(-1)
    const text = { elements: 1e9, characters: 5 }
    expect(refusal(() => parseXml('<r>ab<![CDATA[cd]]><a k="v"/>ef</r>', text))).toEqual({
      code: 'xmlBudgetSpent',
      params: { key: 'characters' },
    })
    const ok = { elements: 3, characters: 100 }
    parseXml('<r>ab<a k="v"/><b/></r>', ok)
    expect(ok.elements).toBe(0)
  })

  it('refuses an encoding other than UTF-8', () => {
    expect(refusal(() => parseXml('<?xml version="1.0" encoding="UTF-16"?><a/>'))).toEqual({
      code: 'encodingNotRead',
      params: { encoding: 'UTF-16' },
    })
    expect(parseXml('<?xml version="1.0" encoding="utf-8"?><a/>').name).toBe('a')
  })
})
