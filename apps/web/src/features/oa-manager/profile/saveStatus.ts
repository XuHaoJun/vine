export type BusinessProfileSaveStatusInput = {
  isSaving: boolean
  isError: boolean
  isDirty: boolean
}

export function getBusinessProfileSaveStatus(input: BusinessProfileSaveStatusInput) {
  if (input.isSaving) return { label: 'Saving changes...', tone: 'muted' as const }
  if (input.isError) return { label: 'Save failed', tone: 'danger' as const }
  if (input.isDirty) return { label: 'Changes saved', tone: 'success' as const }
  return { label: 'All changes have been published.', tone: 'success' as const }
}
