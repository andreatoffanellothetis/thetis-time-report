/**
 * Ritorna la sessione corrente o `null` se anonimo.
 * Il client la usa per popolare `useAuth().user`.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return session.user ? session : null
})
