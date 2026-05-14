/**
 * Route guard globale: se non sei loggato, ti mando a /dev-login.
 * Le pagine `/dev-login` e quelle di errore restano accessibili.
 *
 * Dopo lo switch a Microsoft SSO, l'eccezione `/dev-login` diventa
 * `/auth/microsoft/start` — il resto del middleware non cambia.
 */

const PUBLIC_ROUTES = new Set(['/dev-login'])

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_ROUTES.has(to.path)) return

  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo({ path: '/dev-login', query: { next: to.fullPath } })
  }
})
