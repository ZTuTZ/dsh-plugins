import type { FrameTable, SpriteSheetMeta } from './spritesheet.ts'

/** Everything a pet hero contributes beyond the generic pet runtime. */
export interface HeroPetContent {
  id: string
  label: string
  /** Pet display name (the rename feature is removed; name is fixed per hero). */
  name: string
  spriteUrl: string
  meta: SpriteSheetMeta
  table: FrameTable
}
