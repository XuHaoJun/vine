import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'crypto'
import type { schema } from '@vine/db'
import { message, chat, chatMember } from '@vine/db/schema-public'
import { oaFriendship } from '@vine/db/schema-oa'
import type { ParamSpec } from './mini-app-service-message-templates'

export class TemplateValidationError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'TemplateValidationError'
  }
}

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super('rate limit exceeded')
    this.name = 'RateLimitError'
  }
}

export class MiniAppNotPublishedError extends Error {
  constructor() {
    super('Mini App is not published')
    this.name = 'MiniAppNotPublishedError'
  }
}

export function validateParams(
  schemaList: ParamSpec[],
  params: Record<string, unknown>,
): void {
  for (const spec of schemaList) {
    const v = params[spec.name]
    if (spec.required && (v == null || v === '')) {
      throw new TemplateValidationError(`Missing required param: ${spec.name}`)
    }
    if (v != null) {
      if (spec.kind === 'text') {
        if (typeof v !== 'string') {
          throw new TemplateValidationError(`Param ${spec.name} must be text`)
        }
        if (spec.hard && v.length > spec.hard) {
          throw new TemplateValidationError(
            `Param ${spec.name} exceeds hard limit (${spec.hard})`,
          )
        }
      } else if (spec.kind === 'uri') {
        if (typeof v !== 'string') {
          throw new TemplateValidationError(`Param ${spec.name} must be a uri string`)
        }
        if (!/^https:\/\//.test(v)) {
          throw new TemplateValidationError(
            `Param ${spec.name} must be an https URI`,
          )
        }
      }
    }
  }
}

function deepReplace(node: unknown, params: Record<string, unknown>): unknown {
  if (typeof node === 'string') {
    return node.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      const v = params[key]
      return v == null ? '' : String(v)
    })
  }
  if (Array.isArray(node)) return node.map((n) => deepReplace(n, params))
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) out[k] = deepReplace(v, params)
    return out
  }
  return node
}

export function renderTemplate(flexJson: unknown, params: Record<string, unknown>): unknown {
  return deepReplace(flexJson, params)
}

export const SYSTEM_OA_ID = '00000000-0000-0000-0000-000000001001'

type Deps = { db: NodePgDatabase<typeof schema> }

export function createMiniAppServiceMessageService(deps: Deps) {
  const { db } = deps

  async function ensureFriendshipAndChat(userId: string): Promise<{ chatId: string }> {
    // Auto-friend the user with the system OA if not already
    const [friend] = await db
      .select()
      .from(oaFriendship)
      .where(and(eq(oaFriendship.oaId, SYSTEM_OA_ID), eq(oaFriendship.userId, userId)))
      .limit(1)
    if (!friend) {
      await db.insert(oaFriendship).values({
        oaId: SYSTEM_OA_ID,
        userId,
        status: 'friend',
      })
    }
    // Resolve or create the OA→user chat
    const userChatSubquery = db
      .select({ chatId: chatMember.chatId })
      .from(chatMember)
      .where(eq(chatMember.userId, userId))

    const [existing] = await db
      .select({ id: chat.id })
      .from(chat)
      .innerJoin(chatMember, eq(chatMember.chatId, chat.id))
      .where(
        and(
          eq(chat.type, 'oa'),
          inArray(chat.id, userChatSubquery),
          eq(chatMember.oaId, SYSTEM_OA_ID),
        ),
      )
      .limit(1)
    if (existing?.id) return { chatId: existing.id }

    const newChatId = randomUUID()
    const now = new Date().toISOString()
    await db.insert(chat).values({
      id: newChatId,
      type: 'oa',
      createdAt: now,
    })
    await db.insert(chatMember).values([
      { id: randomUUID(), chatId: newChatId, userId, joinedAt: now },
      { id: randomUUID(), chatId: newChatId, oaId: SYSTEM_OA_ID, joinedAt: now },
    ])
    return { chatId: newChatId }
  }

  async function checkRateLimit(input: {
    miniAppId: string
    userId: string
  }): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(message)
      .innerJoin(chatMember, eq(chatMember.chatId, message.chatId))
      .where(
        and(
          eq(message.miniAppId, input.miniAppId),
          eq(chatMember.userId, input.userId),
          gt(message.createdAt, since),
        ),
      )
    if (count >= 5) {
      throw new RateLimitError(86400)
    }
  }

  async function sendServiceMessage(input: {
    miniAppId: string
    userId: string
    flexJson: unknown
    isTest?: boolean
  }) {
    if (!input.isTest) {
      await checkRateLimit({ miniAppId: input.miniAppId, userId: input.userId })
    }
    const { chatId } = await ensureFriendshipAndChat(input.userId)
    const messageId = randomUUID()
    const now = new Date().toISOString()
    await db.insert(message).values({
      id: messageId,
      chatId,
      senderType: 'oa',
      type: 'flex',
      metadata: JSON.stringify({ flex: input.flexJson }),
      createdAt: now,
      oaId: SYSTEM_OA_ID,
      miniAppId: input.miniAppId,
    })
    return { messageId, chatId }
  }

  return { ensureFriendshipAndChat, checkRateLimit, sendServiceMessage }
}
