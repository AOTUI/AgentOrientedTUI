import { describe, expect, it, vi } from 'vitest'
import { createFeishuTypingController } from '../../../../src/im/channels/feishu/typing.js'

describe('feishu typing controller', () => {
  it('starts typing once when repeated start calls happen', async () => {
    const sendReaction = vi.fn(async () => undefined)
    const controller = createFeishuTypingController({
      sendReaction,
      chatId: 'oc_1',
      messageId: 'om_1',
      emojiType: 'hourglass',
    })

    await controller.start()
    await controller.start()

    expect(sendReaction).toHaveBeenCalledTimes(1)
    expect(sendReaction).toHaveBeenCalledWith({
      chatId: 'oc_1',
      messageId: 'om_1',
      action: 'add',
      emojiType: 'hourglass',
    })
  })

  it('stops typing only after started', async () => {
    const sendReaction = vi.fn(async () => undefined)
    const controller = createFeishuTypingController({
      sendReaction,
      chatId: 'oc_1',
      messageId: 'om_1',
      emojiType: 'hourglass',
    })

    await controller.start()
    await controller.stop()

    expect(sendReaction).toHaveBeenCalledTimes(2)
    expect(sendReaction).toHaveBeenLastCalledWith({
      chatId: 'oc_1',
      messageId: 'om_1',
      action: 'remove',
      emojiType: 'hourglass',
    })
  })

  it('ignores stop when never started', async () => {
    const sendReaction = vi.fn(async () => undefined)
    const controller = createFeishuTypingController({
      sendReaction,
      chatId: 'oc_1',
      messageId: 'om_1',
      emojiType: 'hourglass',
    })

    await controller.stop()
    expect(sendReaction).not.toHaveBeenCalled()
  })

  it('cleanup delegates to stop', async () => {
    const sendReaction = vi.fn(async () => undefined)
    const controller = createFeishuTypingController({
      sendReaction,
      chatId: 'oc_1',
      messageId: 'om_1',
      emojiType: 'hourglass',
    })

    await controller.start()
    await controller.cleanup()

    expect(sendReaction).toHaveBeenCalledTimes(2)
  })

  it('propagates reaction errors', async () => {
    const sendReaction = vi.fn(async () => {
      throw new Error('reaction failed')
    })
    const controller = createFeishuTypingController({
      sendReaction,
      chatId: 'oc_1',
      messageId: 'om_1',
      emojiType: 'hourglass',
    })

    await expect(controller.start()).rejects.toThrow(/reaction failed/i)
  })

  it('supports custom emoji type', async () => {
    const sendReaction = vi.fn(async () => undefined)
    const controller = createFeishuTypingController({
      sendReaction,
      chatId: 'oc_1',
      messageId: 'om_1',
      emojiType: 'typing',
    })

    await controller.start()

    expect(sendReaction).toHaveBeenCalledWith({
      chatId: 'oc_1',
      messageId: 'om_1',
      action: 'add',
      emojiType: 'typing',
    })
  })
})
