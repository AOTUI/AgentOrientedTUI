/**
 * IM Router - Unit Tests
 *
 * Verifies the tRPC imRouter for reading/writing IM config
 * and retrieving agent list for the IM settings UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Config before importing router
const mockGetGlobalIm = vi.fn()
const mockReplaceGlobalIm = vi.fn()
const mockGetGlobal = vi.fn()

vi.mock('../../src/config/config.js', () => ({
  Config: {
    getGlobalIm: (...args: unknown[]) => mockGetGlobalIm(...args),
    replaceGlobalIm: (...args: unknown[]) => mockReplaceGlobalIm(...args),
    getGlobal: (...args: unknown[]) => mockGetGlobal(...args),
    get: () => mockGetGlobal(),
  },
}))

// Mock electron dialog (needed by router.ts imports)
vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() },
}))

// Mock db
vi.mock('../../src/db/index.js', () => ({}))
vi.mock('../../src/core/project-service.js', () => ({ projectService: {} }))
vi.mock('../../src/core/message-service-v2.js', () => ({ MessageServiceV2: class {} }))
vi.mock('../../src/skills/skill-catalog-service.js', () => ({ SkillCatalogService: class {} }))
vi.mock('../../src/skills/skill-config.js', () => ({
  getGlobalSkillsDir: () => '/tmp/skills',
  getProjectSkillsDir: () => '/tmp/project-skills',
}))
vi.mock('../../src/skills/skill-importer.js', () => ({
  importSkillZipToDirectory: vi.fn(),
}))
vi.mock('../../src/core/source-control-keys.js', () => ({
  buildMcpServerItemKey: vi.fn(),
  buildMcpToolItemKey: vi.fn(),
}))

describe('imRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getImConfig', () => {
    it('should return IM config from Config.getGlobalIm()', async () => {
      const imConfig = {
        channels: {
          feishu: {
            enabled: true,
            appId: 'cli_test123',
            botAgentId: 'agent_1',
          },
        },
      }
      mockGetGlobalIm.mockResolvedValue(imConfig)

      // Dynamically import router after mocks
      const { appRouter } = await import('../../src/trpc/router.js')
      const caller = appRouter.createCaller({
        hostManager: {} as any,
        llmConfigService: {} as any,
        modelRegistry: {} as any,
        messageService: {} as any,
      })

      const result = await caller.im.getImConfig()
      expect(result).toEqual(imConfig)
      expect(mockGetGlobalIm).toHaveBeenCalledOnce()
    })

    it('should return empty object when no IM config exists', async () => {
      mockGetGlobalIm.mockResolvedValue(undefined)

      const { appRouter } = await import('../../src/trpc/router.js')
      const caller = appRouter.createCaller({
        hostManager: {} as any,
        llmConfigService: {} as any,
        modelRegistry: {} as any,
        messageService: {} as any,
      })

      const result = await caller.im.getImConfig()
      expect(result).toEqual({})
    })
  })

  describe('saveImConfig', () => {
    it('should persist feishu channel config with botAgentId', async () => {
      mockReplaceGlobalIm.mockResolvedValue({})

      const { appRouter } = await import('../../src/trpc/router.js')
      const caller = appRouter.createCaller({
        hostManager: {} as any,
        llmConfigService: {} as any,
        modelRegistry: {} as any,
        messageService: {} as any,
      })

      const input = {
        channels: {
          feishu: {
            enabled: true,
            appId: 'cli_abc',
            appSecret: 'secret',
            botToken: 't-xxx',
            botAgentId: 'agent_42',
            connectionMode: 'websocket' as const,
            dmPolicy: 'open' as const,
            groupPolicy: 'open' as const,
            requireMention: true,
          },
        },
      }

      const result = await caller.im.saveImConfig(input)
      expect(result).toEqual({ success: true })
      expect(mockReplaceGlobalIm).toHaveBeenCalledWith(input)
    })
  })

  describe('getAgents', () => {
    it('should return agent list for IM to bind', async () => {
      mockGetGlobal.mockResolvedValue({
        agents: {
          list: [
            { id: 'agent_1', name: 'Default Agent' },
            { id: 'agent_2', name: 'Coding Bot' },
          ],
          activeAgentId: 'agent_1',
        },
      })

      const { appRouter } = await import('../../src/trpc/router.js')
      const caller = appRouter.createCaller({
        hostManager: {} as any,
        llmConfigService: {} as any,
        modelRegistry: {} as any,
        messageService: {} as any,
      })

      const result = await caller.im.getAgents()
      expect(result.list).toHaveLength(2)
      expect(result.activeAgentId).toBe('agent_1')
    })
  })
})
