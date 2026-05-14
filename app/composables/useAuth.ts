/**
 * Wrapper attorno a `useUserSession` di nuxt-auth-utils con utilità ruolo.
 *
 * Quando arriverà Microsoft SSO, l'API client-side non cambia: la sessione
 * viene popolata in modo trasparente dal callback OAuth invece che dal
 * dev-login.
 */

import type { UserRole } from '../../server/db/schema'

export function useAuth() {
  const { loggedIn, user, session, fetch: refresh, clear } = useUserSession()

  const roles = computed<UserRole[]>(() => (user.value?.roles ?? []) as UserRole[])
  const hasRole = (role: UserRole) => roles.value.includes(role)
  const isAdmin = computed(() => hasRole('admin'))
  const isManager = computed(() => hasRole('manager') || isAdmin.value)

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    await navigateTo('/dev-login')
  }

  return {
    loggedIn,
    user,
    session,
    roles,
    hasRole,
    isAdmin,
    isManager,
    refresh,
    logout,
  }
}
