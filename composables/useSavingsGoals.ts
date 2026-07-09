// Savings goals (ROADMAP §4, Retention).
//
// Positive framing: targets to fill rather than ceilings to fear. Goals are
// a purely client-side feature — the API is locked — so the store lives in
// localStorage behind a shared useState. Amounts are BASE USD, the same
// convention as expense entry: they render through formatMoney, so they
// convert with the display currency like every other figure.

export interface SavingsGoal {
  id: string
  name: string
  /** Target amount, base USD. Always > 0. */
  target: number
  /** Amount put aside so far, base USD. Never negative. */
  saved: number
  createdAt: string
}

const STORAGE_KEY = 'vaulted-savings-goals'

/** Shape-check untrusted storage rows so a corrupt cache can't crash the card. */
function isGoal(v: unknown): v is SavingsGoal {
  if (!v || typeof v !== 'object') return false
  const g = v as Record<string, unknown>
  return (
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    typeof g.target === 'number' &&
    Number.isFinite(g.target) &&
    g.target > 0 &&
    typeof g.saved === 'number' &&
    Number.isFinite(g.saved) &&
    g.saved >= 0 &&
    typeof g.createdAt === 'string'
  )
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function useSavingsGoals() {
  const goals = useState<SavingsGoal[]>('savings-goals', () => [])
  const loaded = useState<boolean>('savings-goals-loaded', () => false)

  /** Restore from localStorage. Idempotent; call from any consumer. */
  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) goals.value = parsed.filter(isGoal)
    } catch {
      // Corrupt or blocked storage: start empty.
    }
  }

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(goals.value))
    } catch {
      // Storage blocked: goals last for the session only.
    }
  }

  /** Create a goal. Returns false (and changes nothing) on bad input. */
  function addGoal(name: string, target: number): boolean {
    const clean = name.trim()
    if (!clean || !Number.isFinite(target) || target <= 0) return false
    goals.value = [
      ...goals.value,
      {
        id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: clean.slice(0, 60),
        target: round2(target),
        saved: 0,
        createdAt: new Date().toISOString()
      }
    ]
    persist()
    return true
  }

  /** Put money toward a goal (positive amounts only, from the card's form). */
  function contribute(id: string, amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) return false
    let hit = false
    goals.value = goals.value.map((g) => {
      if (g.id !== id) return g
      hit = true
      return { ...g, saved: round2(g.saved + amount) }
    })
    if (hit) persist()
    return hit
  }

  function removeGoal(id: string) {
    goals.value = goals.value.filter((g) => g.id !== id)
    persist()
  }

  /** Put a just-removed goal back — powers the delete toast's Undo. */
  function restoreGoal(goal: SavingsGoal) {
    if (goals.value.some((g) => g.id === goal.id)) return
    goals.value = [...goals.value, goal]
    persist()
  }

  return { goals, loaded, load, addGoal, contribute, removeGoal, restoreGoal }
}
