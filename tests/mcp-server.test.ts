import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpServer, type ServerContext } from '@modelcontextprotocol/server'
import * as retrieval from '../src/worker/mcp/retrieval'
import { writeFileSync } from 'node:fs'
import { createInkstoneMcpServer, type InkstoneMcpServerOptions } from '../src/worker/mcp/server'
import { countText, deriveExcerpt, extractTags, extractWikiLinks } from '../src/shared/markdown-utils'

const options = {
  env: {}, auth: { userId: 'profile-user', role: 'owner', scopes: ['notes:read'] },
  origin: 'https://example.invalid', ftsEnabled: false, executionCtx: {},
} as InkstoneMcpServerOptions

describe('MCP request setup', () => {
  afterEach(() => vi.restoreAllMocks())
  it('creates independent servers for independent requests', () => {
    const first = createInkstoneMcpServer(options)
    const second = createInkstoneMcpServer(options)
    expect(first).not.toBe(second)
  })

  it('keeps each callback bound to its own user and checks scopes on every call', async () => {
    const registered = vi.spyOn(McpServer.prototype, 'registerTool')
    const read = vi.spyOn(retrieval, 'listMcpFolders').mockResolvedValue({ folders: [] })
    const handler = (userId: string, scopes: string[]) => {
      registered.mockClear()
      createInkstoneMcpServer({ ...options, auth: { ...options.auth, userId, scopes } })
      return registered.mock.calls.find((args) => args[0] === 'list_folders')![2] as
        (input: Record<string, unknown>, ctx: ServerContext) => Promise<{ isError?: boolean }>
    }
    const alice = handler('alice', ['notes:read'])
    const bob = handler('bob', ['notes:read'])
    const denied = handler('charlie', [])
    await bob({}, {} as ServerContext)
    await alice({}, {} as ServerContext)
    expect(read.mock.calls.map((args) => args[1])).toEqual(['bob', 'alice'])
    expect((await denied({}, {} as ServerContext)).isError).toBe(true)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('profiles setup and large-note analysis when requested', () => {
    if (!process.env.INKSTONE_PROFILE) return
    const measurements: Record<string, number> = {}
    const measure = (name: string, action: () => unknown) => {
      action()
      const samples: number[] = []
      for (let i = 0; i < 10; i++) {
        const started = performance.now()
        action()
        samples.push(performance.now() - started)
      }
      samples.sort((a, b) => a - b)
      measurements[name] = +samples[5]!.toFixed(2)
    }
    const content = '#prompts #image\n\n' + 'portrait, lighting, cinematic, detailed\n'.repeat(16_000)
    measure('createMcpServer', () => createInkstoneMcpServer(options))
    measure('deriveExcerpt', () => deriveExcerpt(content))
    measure('countText', () => countText(content))
    measure('extractTags', () => extractTags(content))
    measure('extractWikiLinks', () => extractWikiLinks(content))
    writeFileSync(process.env.INKSTONE_PROFILE, JSON.stringify(measurements, null, 2))
  })
})
