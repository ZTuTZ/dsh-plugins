export interface SpriteSheetMeta {
  framesPerRow: number
  cellWidth: number
  cellHeight: number
}

export interface FrameTable {
  rows: Record<string, number>
  frames: number[]
}

export function framePosition(
  meta: SpriteSheetMeta,
  row: number,
  index: number,
): { x: number; y: number } {
  return { x: index * meta.cellWidth, y: row * meta.cellHeight }
}

export function totalFrames(table: FrameTable): number {
  return table.frames.reduce((sum, count) => sum + count, 0)
}
