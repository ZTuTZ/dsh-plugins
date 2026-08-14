export type PetActivity = 'idle' | 'waiting' | 'thinking' | 'done' | 'failed'
export type PetAnimation = 'idle' | 'waiting' | 'thinking' | 'jumping' | 'pet' | 'failed'

const MAP: Record<PetActivity, PetAnimation> = {
  idle: 'idle',
  waiting: 'waiting',
  thinking: 'thinking',
  done: 'jumping',
  failed: 'failed',
}

export function animationFor(activity: PetActivity | undefined, petTriggered: boolean): PetAnimation {
  if (petTriggered) return 'pet'
  return activity === undefined ? 'idle' : MAP[activity]
}
