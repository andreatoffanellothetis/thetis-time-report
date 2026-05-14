/**
 * Tutto sotto `/api/admin/*` richiede ruolo `admin`. Centralizziamo qui
 * il check così non lo dobbiamo ripetere in ogni endpoint (e non si dimentica).
 */

import { requireRole } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''
  if (path.startsWith('/api/admin/')) {
    await requireRole(event, 'admin')
  }
})
