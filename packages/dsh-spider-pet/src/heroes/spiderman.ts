import { SPRITE_SHEET_URL } from '../assets/spritesheet.ts'
import type { HeroPetContent } from '../core/content.ts'

/** Spider-Man pet content: the original v0.1 sprite sheet and frame table. */
export const spidermanPet: HeroPetContent = {
  id: 'spiderman',
  label: '蜘蛛侠',
  name: 'Peter Parker',
  spriteUrl: SPRITE_SHEET_URL,
  meta: { framesPerRow: 16, cellWidth: 256, cellHeight: 256 },
  table: {
    rows: { idle: 0, waiting: 1, thinking: 2, jumping: 3, pet: 4, failed: 5 },
    frames: [16, 12, 12, 12, 12, 12],
  },
}

export const HERO_PETS: Record<string, HeroPetContent> = {
  spiderman: spidermanPet,
}
