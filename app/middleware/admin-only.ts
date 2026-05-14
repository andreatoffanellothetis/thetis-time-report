/**
 * Page middleware: blocca chi non è admin (lato client).
 * Il vero check di autorizzazione resta lato server in `admin-guard.ts`.
 */

export default defineNuxtRouteMiddleware(() => {
  const { isAdmin, loggedIn } = useAuth()
  if (!loggedIn.value) {
    return navigateTo({ path: '/dev-login', query: { next: '/admin' } })
  }
  if (!isAdmin.value) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accesso riservato agli admin',
      fatal: true,
    })
  }
})
