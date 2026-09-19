import { describe, expect, it } from 'vitest'
import { countText, stripCodeRegions, extractAttachmentIds, extractTags } from './markdown-utils'

describe('large-text analysis', () => {
  it('preserves plain text and masks comments while retaining line endings', () => {
    expect(stripCodeRegions('hello\r\n世界😀')).toBe('hello\r\n世界😀')
    expect(stripCodeRegions('a %%秘密\r\n隐藏%% b')).toBe('a     \r\n     b')
    expect(stripCodeRegions('a \\%% visible')).toBe('a \\%% visible')
    expect(stripCodeRegions('a %% hidden')).toBe('a          ')
  })
  it('counts Unicode characters, lone surrogates, Latin words and CJK consistently', () => {
    const text = '你好 hello-world 42 😀𠀀\uD800'
    expect(countText(text)).toEqual({ words: 4, chars: [...text].length })
    expect(countText('```\n你好 hidden\n```\nvisible')).toEqual({ words: 1, chars: 25 })
    expect(countText('one')).toEqual({ words: 1, chars: 3 })
  })
})

describe('extractTags', () => {
  it('finds prose tags while excluding URL fragments and protected regions', () => {
    expect(extractTags('#visible plain text')).toEqual(['visible'])
    expect(extractTags('#visible https://example.invalid/#hidden mailto:a#hidden www.example.invalid/#hidden')).toEqual(['visible'])
    expect(extractTags('#visible %% #hidden %% $x #math$ <!-- #comment -->')).toEqual(['visible'])
  })
  it('handles an unterminated inline-code marker with a mismatched trailing marker', () => {
    expect(extractTags('` #visible ``')).toEqual(['visible'])
  })

  it('does not treat tags in complete inline code or fenced blocks as tags', () => {
    expect(extractTags('`#inline`\n```\n#fenced\n```\n#visible')).toEqual(['visible'])
  })
})

describe('extractAttachmentIds', () => {
  const idA = '01m1r8923zajxnw9y0dhs6sy8j'
  const idB = '01m1r9qq6zb99ef3cqkjrzrn89'

  it('collects plain and angle-bracket references outside code regions', () => {
    expect(extractAttachmentIds(
      `![a](/api/files/${idA})\n\n![b](</api/files/${idB} "t">)`,
    )).toEqual([idA, idB])
  })

  it('ignores references inside ordinary fenced code', () => {
    expect(extractAttachmentIds(
      '```\n![a](/api/files/' + idA + ')\n```\n![b](/api/files/' + idB + ')',
    )).toEqual([idB])
  })

  it('collects references inside md-example fences, which render as live markdown', () => {
    expect(extractAttachmentIds(
      `~~~~md-example title="Image"\n![a](</api/files/${idA} "a">)\n~~~~`,
    )).toEqual([idA])
  })

  it('keeps stripping nested ordinary code inside an md-example fence', () => {
    expect(extractAttachmentIds(
      `~~~~md-example\n\`\`\`\n![a](/api/files/${idA})\n\`\`\`\n![b](/api/files/${idB})\n~~~~`,
    )).toEqual([idB])
  })

  it('accepts the markdown-example alias', () => {
    expect(extractAttachmentIds(
      `~~~markdown-example\n![a](/api/files/${idA})\n~~~`,
    )).toEqual([idA])
  })

  it('does not close an md-example fence on a marker followed by text', () => {
    expect(extractAttachmentIds(
      `~~~~md-example\n![a](/api/files/${idA})\n~~~~ trailing\n![b](/api/files/${idB})`,
    )).toEqual([idB, idA])
  })
})
