/**
 * DSH `activity/status` phase vocabulary consumed by the pet (the host
 * maps `tool` onto `thinking` before this point).
 */
export type PetActivity = 'idle' | 'waiting' | 'thinking' | 'done' | 'pet' | 'failed'

/** Sprite-sheet animation tracks (rows of the atlas). */
export type PetAnimation = 'idle' | 'waiting' | 'thinking' | 'jumping' | 'pet' | 'failed'

const MAP: Record<PetActivity, PetAnimation> = {
  idle: 'idle',
  waiting: 'waiting',
  thinking: 'thinking',
  done: 'jumping',
  pet: 'pet',
  failed: 'failed',
}

export function animationFor(
  activity: PetActivity | undefined,
  jumpTriggered: boolean,
  petTriggered: boolean,
): PetAnimation {
  // A petting interaction (double-click) plays the dedicated happy pet pose.
  if (petTriggered) return 'pet'
  // A click plays the happy jump.
  if (jumpTriggered) return 'jumping'
  return activity === undefined ? 'idle' : MAP[activity]
}
