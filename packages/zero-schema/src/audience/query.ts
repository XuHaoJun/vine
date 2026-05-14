export type AudienceQueryJson = Record<string, unknown>

export type AudienceContact = {
  friendship: { status: string }
  providerUserId: string
  displayName: string
  tags: { ids: string[]; names: string[] }
  lastInteractionAt: string | null
  chat: { status: 'active' | 'no_chat'; unread: boolean }
  note: { exists: boolean }
}

export type AudienceValidationResult = { ok: true } | { ok: false; error: string }

type AudienceField = keyof typeof allowedFieldOperators
type FieldOperator = (typeof allowedFieldOperators)[AudienceField][number]
type FieldValueKind = (typeof fieldValueKinds)[AudienceField]

const maxQueryDepth = 4
const maxBranchListLength = 20

const allowedFieldOperators = {
  'friendship.status': ['$eq', '$ne', '$in', '$nin'],
  providerUserId: ['$eq', '$ne', '$in', '$nin'],
  displayName: ['$eq', '$ne', '$in', '$nin'],
  'tags.ids': ['$eq', '$ne', '$in', '$nin', '$all', '$exists'],
  'tags.names': ['$eq', '$ne', '$in', '$nin', '$all', '$exists'],
  lastInteractionAt: ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$exists'],
  'chat.status': ['$eq', '$ne', '$in', '$nin'],
  'chat.unread': ['$eq', '$ne'],
  'note.exists': ['$eq', '$ne'],
} as const

const fieldValueKinds = {
  'friendship.status': 'string',
  providerUserId: 'string',
  displayName: 'string',
  'tags.ids': 'stringArray',
  'tags.names': 'stringArray',
  lastInteractionAt: 'nullableString',
  'chat.status': 'string',
  'chat.unread': 'boolean',
  'note.exists': 'boolean',
} as const

const logicalOperators = new Set(['$and', '$or', '$not'])

export function validateAudienceQuery(
  query: AudienceQueryJson,
): AudienceValidationResult {
  return validateNode(query, 1)
}

export function evaluateAudienceQuery(
  query: AudienceQueryJson,
  contact: AudienceContact,
): boolean {
  if (!validateAudienceQuery(query).ok) {
    return false
  }

  return evaluateNode(query, contact)
}

function validateNode(value: unknown, depth: number): AudienceValidationResult {
  if (depth > maxQueryDepth) {
    return { ok: false, error: 'Audience query is too deep' }
  }

  if (!isPlainObject(value)) {
    return { ok: false, error: 'Audience query must be an object' }
  }

  for (const [key, condition] of Object.entries(value)) {
    if (key.startsWith('$')) {
      const logicalResult = validateLogicalCondition(key, condition, depth)
      if (!logicalResult.ok) {
        return logicalResult
      }
      continue
    }

    if (!isAudienceField(key)) {
      return { ok: false, error: `Unsupported audience field: ${key}` }
    }

    const fieldResult = validateFieldCondition(key, condition)
    if (!fieldResult.ok) {
      return fieldResult
    }
  }

  return { ok: true }
}

function validateLogicalCondition(
  operator: string,
  condition: unknown,
  depth: number,
): AudienceValidationResult {
  if (!logicalOperators.has(operator)) {
    return { ok: false, error: `Unsupported audience logical operator: ${operator}` }
  }

  if (operator === '$not') {
    return validateNode(condition, depth + 1)
  }

  if (!Array.isArray(condition)) {
    return { ok: false, error: `${operator} must be an array` }
  }

  if (condition.length === 0) {
    return { ok: false, error: `${operator} must be a non-empty array` }
  }

  if (condition.length > maxBranchListLength) {
    return { ok: false, error: `${operator} has too many branches` }
  }

  for (const branch of condition) {
    const result = validateNode(branch, depth + 1)
    if (!result.ok) {
      return result
    }
  }

  return { ok: true }
}

function validateFieldCondition(
  field: AudienceField,
  condition: unknown,
): AudienceValidationResult {
  if (!isOperatorObject(condition)) {
    return isValidEqualityOperand(field, condition)
      ? { ok: true }
      : { ok: false, error: `Unsupported value for ${field}` }
  }

  for (const [operator, operand] of Object.entries(condition)) {
    if (!isAllowedFieldOperator(field, operator)) {
      return {
        ok: false,
        error: `Unsupported operator for ${field}: ${operator}`,
      }
    }

    if (!isValidOperatorOperand(field, operator, operand)) {
      return {
        ok: false,
        error: `Unsupported operand for ${field}.${operator}`,
      }
    }
  }

  return { ok: true }
}

function evaluateNode(query: AudienceQueryJson, contact: AudienceContact): boolean {
  for (const [key, condition] of Object.entries(query)) {
    if (key === '$and') {
      if (!(condition as AudienceQueryJson[]).every((branch) => evaluateNode(branch, contact))) {
        return false
      }
      continue
    }

    if (key === '$or') {
      if (!(condition as AudienceQueryJson[]).some((branch) => evaluateNode(branch, contact))) {
        return false
      }
      continue
    }

    if (key === '$not') {
      if (evaluateNode(condition as AudienceQueryJson, contact)) {
        return false
      }
      continue
    }

    if (!evaluateFieldCondition(key as AudienceField, condition, contact)) {
      return false
    }
  }

  return true
}

function evaluateFieldCondition(
  field: AudienceField,
  condition: unknown,
  contact: AudienceContact,
): boolean {
  const value = getContactValue(field, contact)
  if (!isOperatorObject(condition)) {
    return evaluateOperator('$eq', value, condition)
  }

  return Object.entries(condition).every(([operator, expected]) =>
    evaluateOperator(operator as FieldOperator, value, expected),
  )
}

function evaluateOperator(
  operator: FieldOperator,
  value: string | string[] | boolean | null,
  expected: unknown,
): boolean {
  switch (operator) {
    case '$eq':
      return isEqualValue(value, expected)
    case '$ne':
      return !isEqualValue(value, expected)
    case '$in':
      return isInValue(value, expected)
    case '$nin':
      return !isInValue(value, expected)
    case '$all':
      return Array.isArray(value) && Array.isArray(expected)
        ? expected.every((item) => value.includes(item))
        : false
    case '$exists':
      return valueExists(value) === expected
    case '$gt':
      return typeof value === 'string' && typeof expected === 'string'
        ? value > expected
        : false
    case '$gte':
      return typeof value === 'string' && typeof expected === 'string'
        ? value >= expected
        : false
    case '$lt':
      return typeof value === 'string' && typeof expected === 'string'
        ? value < expected
        : false
    case '$lte':
      return typeof value === 'string' && typeof expected === 'string'
        ? value <= expected
        : false
  }
}

function isEqualValue(
  value: string | string[] | boolean | null,
  expected: unknown,
): boolean {
  if (Array.isArray(value)) {
    return typeof expected === 'string' && value.includes(expected)
  }

  return value === expected
}

function isInValue(
  value: string | string[] | boolean | null,
  expected: unknown,
): boolean {
  if (!Array.isArray(expected)) {
    return false
  }

  if (Array.isArray(value)) {
    return value.some((item) => expected.includes(item))
  }

  return expected.includes(value)
}

function isValidOperatorOperand(
  field: AudienceField,
  operator: FieldOperator,
  operand: unknown,
): boolean {
  switch (operator) {
    case '$eq':
    case '$ne':
      return isValidEqualityOperand(field, operand)
    case '$in':
    case '$nin':
      return isValidListOperand(field, operand)
    case '$all':
      return fieldValueKinds[field] === 'stringArray' && isStringArray(operand)
    case '$exists':
      return typeof operand === 'boolean'
    case '$gt':
    case '$gte':
    case '$lt':
    case '$lte':
      return typeof operand === 'string'
  }
}

function isValidEqualityOperand(field: AudienceField, operand: unknown): boolean {
  switch (fieldValueKinds[field]) {
    case 'string':
    case 'stringArray':
      return typeof operand === 'string'
    case 'nullableString':
      return typeof operand === 'string' || operand === null
    case 'boolean':
      return typeof operand === 'boolean'
  }
}

function isValidListOperand(field: AudienceField, operand: unknown): boolean {
  switch (fieldValueKinds[field]) {
    case 'string':
    case 'stringArray':
    case 'nullableString':
      return isStringArray(operand)
    case 'boolean':
      return isBooleanArray(operand)
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isBooleanArray(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'boolean')
}

function valueExists(value: string | string[] | boolean | null): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined
}

function isAudienceField(field: string): field is AudienceField {
  return field in allowedFieldOperators
}

function isAllowedFieldOperator(
  field: AudienceField,
  operator: string,
): operator is FieldOperator {
  return allowedFieldOperators[field].includes(operator as never)
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && Object.keys(value).some((key) => key.startsWith('$'))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getContactValue(
  field: AudienceField,
  contact: AudienceContact,
): string | string[] | boolean | null {
  switch (field) {
    case 'friendship.status':
      return contact.friendship.status
    case 'providerUserId':
      return contact.providerUserId
    case 'displayName':
      return contact.displayName
    case 'tags.ids':
      return contact.tags.ids
    case 'tags.names':
      return contact.tags.names
    case 'lastInteractionAt':
      return contact.lastInteractionAt
    case 'chat.status':
      return contact.chat.status
    case 'chat.unread':
      return contact.chat.unread
    case 'note.exists':
      return contact.note.exists
  }
}
