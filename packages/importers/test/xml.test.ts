import { describe, expect, it } from 'vitest'
import { parseXml } from '../src/xml.ts'

describe('parseXml', () => {
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
    expect(parseXml('<t a="&#x1F600;"/>').attributes.a).toBe('\u{1F600}')
  })

  it('refuses a document type declaration, unknown entities and a bare &', () => {
    expect(() => parseXml('<!DOCTYPE sst [<!ENTITY a "aaaa">]><sst/>')).toThrow(
      'DOCTYPE is not allowed',
    )
    expect(() => parseXml('<t>&ext;</t>')).toThrow('unknown entity &ext;')
    expect(() => parseXml('<t>a & b</t>')).toThrow('bare & in text')
    expect(() => parseXml('<t a="&x"/>')).toThrow('bare & in text')
  })

  it('refuses character references that are not XML characters', () => {
    for (const ref of ['&#0;', '&#xD800;', '&#x110000;', '&#99999999999;']) {
      expect(() => parseXml(`<t>${ref}</t>`)).toThrow(`character reference ${ref}`)
    }
  })

  it('accepts nesting of 32 and refuses 33', () => {
    const nest = (n: number) => `${'<e>'.repeat(n - 1)}<e/>${'</e>'.repeat(n - 1)}`
    expect(parseXml(nest(32)).name).toBe('e')
    expect(() => parseXml(nest(33))).toThrow('elements nest deeper than 32')
  })

  it('refuses malformed markup', () => {
    expect(() => parseXml('<a><b></a>')).toThrow('end tag </a> does not match <b>')
    expect(() => parseXml('<worksheet><row>')).toThrow('unclosed element <row>')
    expect(() => parseXml('<a k="1" k="2"/>')).toThrow('duplicate attribute k in <a>')
    expect(() => parseXml('<a/><b/>')).toThrow('more than one root element')
    expect(() => parseXml('x<a/>')).toThrow('text outside the root element')
    expect(() => parseXml('<a k=1/>')).toThrow('malformed tag <a>')
    expect(() => parseXml('')).toThrow('no root element')
    expect(() => parseXml('<a><!-- x</a>')).toThrow('unclosed comment')
    const many = Array.from({ length: 257 }, (_, k) => `a${k}="1"`).join(' ')
    expect(() => parseXml(`<a ${many}/>`)).toThrow('more than 256 attributes in <a>')
    expect(parseXml(`<a ${many.slice(0, many.lastIndexOf(' '))}/>`).name).toBe('a')
  })

  it('stops at the element and character limits it is given', () => {
    const left = { elements: 10, characters: 1e9 }
    expect(() => parseXml(`<r>${'<a/>'.repeat(100_000)}</r>`, left)).toThrow(
      'more elements than allowed',
    )
    expect(left.elements).toBe(-1)
    const text = { elements: 1e9, characters: 5 }
    expect(() => parseXml('<r>ab<![CDATA[cd]]><a k="v"/>ef</r>', text)).toThrow(
      'more characters than allowed',
    )
    const ok = { elements: 3, characters: 100 }
    parseXml('<r>ab<a k="v"/><b/></r>', ok)
    expect(ok.elements).toBe(0)
  })

  it('refuses an encoding other than UTF-8', () => {
    expect(() => parseXml('<?xml version="1.0" encoding="UTF-16"?><a/>')).toThrow(
      'encoding "UTF-16" is not read; only UTF-8',
    )
    expect(parseXml('<?xml version="1.0" encoding="utf-8"?><a/>').name).toBe('a')
  })
})
