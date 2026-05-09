import { describe, expect, it } from 'vitest'
import { getBusinessProfileSaveStatus } from '~/features/oa-manager/profile/saveStatus'

describe('getBusinessProfileSaveStatus', () => {
  it('shows published state when there are no draft changes', () => {
    expect(
      getBusinessProfileSaveStatus({
        isSaving: false,
        isError: false,
        isDirty: false,
      }),
    ).toEqual({ label: 'All changes have been published.', tone: 'success' })
  })

  it('prioritizes saving and error states', () => {
    expect(
      getBusinessProfileSaveStatus({
        isSaving: true,
        isError: false,
        isDirty: true,
      }).label,
    ).toBe('Saving changes...')
    expect(
      getBusinessProfileSaveStatus({
        isSaving: false,
        isError: true,
        isDirty: true,
      }).label,
    ).toBe('Save failed')
  })
})
