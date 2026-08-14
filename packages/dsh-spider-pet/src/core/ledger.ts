export type PetInteraction = 'pet' | 'feed'

export interface AffinityState {
  points: number
  pets: number
  feeds: number
  lastPetAt: number
  lastFeedAt: number
}

export interface LedgerConfig {
  petPoints: number
  feedPoints: number
  petCooldownMs: number
  feedCooldownMs: number
  maxPoints: number
}

export const defaultLedgerConfig: LedgerConfig = {
  petPoints: 1,
  feedPoints: 5,
  petCooldownMs: 10_000,
  feedCooldownMs: 30_000,
  maxPoints: 100,
}

export const PET_RANKS = [
  { min: 0, name: '幼蛛' },
  { min: 30, name: '伙伴' },
  { min: 60, name: '挚友' },
  { min: 100, name: '羁绊' },
] as const

export function rankOf(points: number): string {
  let name = PET_RANKS[0].name
  for (const rank of PET_RANKS) {
    if (points >= rank.min) name = rank.name
  }
  return name
}

export function applyInteraction(
  state: AffinityState,
  kind: PetInteraction,
  now: number,
  config: Partial<LedgerConfig> = {},
): { state: AffinityState; granted: boolean; reason?: string } {
  const cfg = { ...defaultLedgerConfig, ...config }
  const last = kind === 'pet' ? state.lastPetAt : state.lastFeedAt
  const cooldown = kind === 'pet' ? cfg.petCooldownMs : cfg.feedCooldownMs
  if (now - last < cooldown) {
    return { state, granted: false, reason: '冷却中，等一会儿再来' }
  }
  const gain = kind === 'pet' ? cfg.petPoints : cfg.feedPoints
  const next: AffinityState = {
    ...state,
    points: Math.min(cfg.maxPoints, state.points + gain),
    pets: state.pets + (kind === 'pet' ? 1 : 0),
    feeds: state.feeds + (kind === 'feed' ? 1 : 0),
    lastPetAt: kind === 'pet' ? now : state.lastPetAt,
    lastFeedAt: kind === 'feed' ? now : state.lastFeedAt,
  }
  return { state: next, granted: true }
}
