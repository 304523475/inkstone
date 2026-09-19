import { describe, expect, it } from 'vitest'
import { attachmentQuotaBytes } from './quota'

describe('attachment quota configuration', () => {
  it('retains the 1 GiB default for missing or invalid deployment values', () => {
    for (const value of [undefined, '', '-1', '0', 'Infinity', '1.5', '2GB', '9007199254740992']) {
      expect(attachmentQuotaBytes({ ATTACHMENT_QUOTA_BYTES: value })).toBe(1024 ** 3)
    }
  })
  it('accepts an explicit quota in bytes', () => {
    expect(attachmentQuotaBytes({ ATTACHMENT_QUOTA_BYTES: ' 2147483648 ' })).toBe(2 * 1024 ** 3)
  })
})
