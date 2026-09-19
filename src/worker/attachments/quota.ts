import { LIMITS } from '@shared/constants'
import type { Env } from '../env'

/** Deployment override in bytes; absent or invalid values keep the default quota. */
export function attachmentQuotaBytes(env: Pick<Env, 'ATTACHMENT_QUOTA_BYTES'>): number {
  const value = env.ATTACHMENT_QUOTA_BYTES?.trim()
  if (!value || !/^\d+$/.test(value)) return LIMITS.attachmentQuotaBytes
  const bytes = Number(value)
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : LIMITS.attachmentQuotaBytes
}
