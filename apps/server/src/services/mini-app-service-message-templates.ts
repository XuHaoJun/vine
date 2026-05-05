import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@vine/db'
import { miniAppServiceMessageTemplate } from '@vine/db/schema-login'

export const BUILTIN_TEMPLATE_KINDS = [
  'reservation_confirmation',
  'queue_position',
  'delivery_update',
  'generic_notification',
  'custom_flex',
] as const

export type TemplateKind = (typeof BUILTIN_TEMPLATE_KINDS)[number]

type Deps = { db: NodePgDatabase<typeof schema> }

export type ParamSpec = {
  name: string
  required: boolean
  kind: 'text' | 'uri'
  recommended?: number
  soft?: number
  hard?: number
}

export const BUILTIN_DEFAULTS: Record<
  TemplateKind,
  { flexJson: unknown; paramsSchema: ParamSpec[] }
> = {
  reservation_confirmation: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'title', required: true, kind: 'text', recommended: 10, soft: 36, hard: 50 },
      { name: 'date', required: true, kind: 'text' },
      { name: 'button_uri_1', required: true, kind: 'uri' },
    ],
  },
  queue_position: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'position', required: true, kind: 'text' },
      { name: 'button_uri_1', required: true, kind: 'uri' },
    ],
  },
  delivery_update: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'status', required: true, kind: 'text' },
      { name: 'button_uri_1', required: true, kind: 'uri' },
    ],
  },
  generic_notification: {
    flexJson: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    paramsSchema: [
      { name: 'title', required: true, kind: 'text' },
      { name: 'body', required: true, kind: 'text' },
      { name: 'button_uri_1', required: false, kind: 'uri' },
    ],
  },
  custom_flex: {
    flexJson: { type: 'bubble' },
    paramsSchema: [],
  },
}

export function createMiniAppTemplateService(deps: Deps) {
  const { db } = deps

  async function listTemplates(miniAppId: string) {
    return db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.miniAppId, miniAppId))
  }

  async function createTemplate(input: {
    miniAppId: string
    kind: string
    name: string
    languageTag: string
    flexJson: unknown
    paramsSchema: ParamSpec[]
    useCase: string
  }) {
    if (!BUILTIN_TEMPLATE_KINDS.includes(input.kind as TemplateKind)) {
      throw new Error(`Unknown template kind: ${input.kind}`)
    }
    const existing = await db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.miniAppId, input.miniAppId))
    if (existing.length >= 20) {
      throw new Error('A Mini App can have a maximum 20 templates')
    }
    const [row] = await db
      .insert(miniAppServiceMessageTemplate)
      .values({
        miniAppId: input.miniAppId,
        kind: input.kind,
        name: input.name,
        languageTag: input.languageTag,
        flexJson: input.flexJson,
        paramsSchema: input.paramsSchema,
        useCase: input.useCase,
      })
      .returning()
    return row
  }

  async function getTemplate(id: string) {
    const [row] = await db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.id, id))
      .limit(1)
    return row ?? null
  }

  async function getTemplateByName(miniAppId: string, name: string) {
    const [row] = await db
      .select()
      .from(miniAppServiceMessageTemplate)
      .where(
        and(
          eq(miniAppServiceMessageTemplate.miniAppId, miniAppId),
          eq(miniAppServiceMessageTemplate.name, name),
        ),
      )
      .limit(1)
    return row ?? null
  }

  async function updateTemplate(
    id: string,
    input: {
      languageTag?: string
      flexJson?: unknown
      paramsSchema?: ParamSpec[]
      useCase?: string
    },
  ) {
    const [row] = await db
      .update(miniAppServiceMessageTemplate)
      .set({
        ...(input.languageTag !== undefined && { languageTag: input.languageTag }),
        ...(input.flexJson !== undefined && { flexJson: input.flexJson }),
        ...(input.paramsSchema !== undefined && { paramsSchema: input.paramsSchema }),
        ...(input.useCase !== undefined && { useCase: input.useCase }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(miniAppServiceMessageTemplate.id, id))
      .returning()
    return row ?? null
  }

  async function deleteTemplate(id: string) {
    await db
      .delete(miniAppServiceMessageTemplate)
      .where(eq(miniAppServiceMessageTemplate.id, id))
  }

  return {
    listTemplates,
    createTemplate,
    getTemplate,
    getTemplateByName,
    updateTemplate,
    deleteTemplate,
  }
}
