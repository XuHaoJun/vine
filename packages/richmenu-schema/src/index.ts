import * as v from 'valibot'

export {
  RichMenuPostbackActionSchema,
  RichMenuMessageActionSchema,
  RichMenuUriActionSchema,
  RichMenuDatetimepickerActionSchema,
  RichMenuRichmenuswitchActionSchema,
  RichMenuCameraActionSchema,
  RichMenuCameraRollActionSchema,
  RichMenuLocationActionSchema,
  RichMenuActionSchema,
} from './actions'
export type { RichMenuAction } from './actions'

export {
  RichMenuSizeSchema,
  RichMenuBoundsSchema,
  RichMenuAreaSchema,
  RichMenuObjectSchema,
} from './richmenu'
export type { RichMenuObject, RichMenuArea, RichMenuBounds } from './richmenu'

export type RichMenuValidationSuccess = {
  success: true
  data: v.InferOutput<typeof RichMenuObjectSchema>
}

export type RichMenuValidationFailure = {
  success: false
  errors: Array<{ path: string; message: string }>
}

export type RichMenuValidationResult =
  | RichMenuValidationSuccess
  | RichMenuValidationFailure

import { RichMenuObjectSchema } from './richmenu'

export function validateRichMenu(input: unknown): RichMenuValidationResult {
  const result = v.safeParse(RichMenuObjectSchema, input)
  if (result.success) {
    return { success: true, data: result.output }
  }
  return {
    success: false,
    errors: result.issues.map((issue) => ({
      path: issue.path?.map((p: v.IssuePathItem) => String(p.key)).join('.') ?? '',
      message: issue.message,
    })),
  }
}
