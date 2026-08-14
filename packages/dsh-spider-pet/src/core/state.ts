/**
 * DSH `activity/status` phase vocabulary consumed by the pet (the host
 * maps `tool` onto `thinking` before this point).
 */
export type PetActivity = 'idle' | 'waiting' | 'thinking' | 'done'

/** Sprite-sheet animation tracks (rows of the atlas). */
export type PetAnimation = 'idle' | 'waiting' | 'thinking' | 'jumping' | 'pet'

const MAP: Record<PetActivity, PetAnimation> = {
  idle: 'idle',
  waiting: 'waiting',
  thinking: 'thinking',
  done: 'jumping',
}

export function animationFor(activity: PetActivity | undefined, petTriggered: boolean): PetAnimation {
  if (petTriggered) return 'pet'
  return activity === undefined ? 'idle' : MAP[activity]
}
