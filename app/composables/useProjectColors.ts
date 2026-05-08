const PALETTE = [
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
  '#22c55e', // green
  '#eab308', // yellow
  '#3b82f6', // blue
  '#ef4444', // red
  '#d946ef', // fuchsia
]

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function useProjectColors() {
  const assigned = new Map<string, string>()
  let next = 0

  function colorFor(projectId: string): string {
    const cached = assigned.get(projectId)
    if (cached) return cached
    let color = PALETTE[next % PALETTE.length]!
    next++
    if (Array.from(assigned.values()).includes(color) && assigned.size < PALETTE.length) {
      color = PALETTE[hashString(projectId) % PALETTE.length]!
    }
    assigned.set(projectId, color)
    return color
  }

  function reset() {
    assigned.clear()
    next = 0
  }

  return { colorFor, reset }
}

export const STATUS_COLORS = {
  ok: '#10b981',
  under: '#ef4444',
  over: '#3b82f6',
  absent: '#9ca3af',
  weekend: '#e5e7eb',
  holiday: '#d4d4d8',
} as const
