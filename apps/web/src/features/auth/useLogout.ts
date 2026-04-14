import { authClient, clearAuthClientToken } from '~/features/auth/client/authClient'
import { dialogConfirm, showError } from '~/interface/dialogs/actions'
import { queryClient } from '~/query'
import { logger } from '~/lib/logger'

export const useLogout = () => {
  const logout = async (options?: { skipConfirm?: boolean }) => {
    if (!options?.skipConfirm) {
      const confirmed = await dialogConfirm({
        title: 'Log Out',
        description: 'Are you sure you want to log out?',
      })

      if (!confirmed) return false
    }

    try {
      await authClient.signOut()
      clearAuthClientToken()
      queryClient.clear()
      // don't manually navigate - let AppLayout handle redirect when state changes to 'logged-out'
      // manual navigation causes double navigation on native
      return true
    } catch (error) {
      logger.error({ err: error }, 'logout error')
      showError(error, 'Logout')
      return false
    }
  }

  return { logout }
}
