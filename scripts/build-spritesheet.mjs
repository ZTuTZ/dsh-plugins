/**
 * Build the pet sprite sheet from the six pose frames.
 *
 * Each pose JPEG (green background) is resized to a 256x256 cell, chroma-key
 * cut to transparent, and placed on its row of an 8-column sheet. Outputs:
 *   素材/spidey/spritesheet.png / .webp
 *   素材/spidey/pet.json
 *   packages/dsh-spider-pet/src/assets/spritesheet.ts  (WebP base64 data URL)
 *
 * Usage: node scripts/build-spritesheet.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const POSES = ['idle', 'waiting', 'thinking', 'jumping', 'pet', 'failed']
const FRAMES = [6, 6, 6, 5, 4, 4]
const CELL = 256
const COLS = 8
const ROOT = process.cwd()
const SRC_DIR = join(ROOT, '素材/spidey/pet-poses')
const OUT_DIR = join(ROOT, '素材/spidey')

/** Chroma-key the green background to transparent (key approx #3fd771). */
function cutGreen(input, width, height) {
  const out = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const r = input[o]
    const g = input[o + 1]
    const b = input[o + 2]
    const greenness = g - Math.max(r, b)
    let alpha = 255
    if (greenness > 42) {
      alpha = 0
    } else if (greenness > 12) {
      alpha = Math.round(255 * (1 - (greenness - 12) / 30))
    }
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = alpha
  }
  return out
}

const rows = {}
const composites = []
for (let r = 0; r < POSES.length; r++) {
  const name = POSES[r]
  rows[name] = r
  const file = join(SRC_DIR, `${name}.jpeg`)
  const resized = await sharp(readFileSync(file))
    .resize(CELL, CELL, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = cutGreen(resized.data, resized.info.width, resized.info.height)
  composites.push({
    input: await sharp(rgba, { raw: { width: CELL, height: CELL, channels: 4 } }).png().toBuffer(),
    left: 0,
    top: r * CELL,
  })
}

const canvas = sharp({
  create: { width: COLS * CELL, height: POSES.length * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
const png = await canvas.composite(composites).png().toBuffer()
const webp = await canvas.composite(composites).webp({ quality: 80 }).toBuffer()

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'spritesheet.png'), png)
writeFileSync(join(OUT_DIR, 'spritesheet.webp'), webp)
writeFileSync(join(OUT_DIR, 'pet.json'), JSON.stringify({
  rows,
  frames: FRAMES,
  cell: { width: CELL, height: CELL },
}, null, 2) + '\n')
writeFileSync(
  join(ROOT, 'packages/dsh-spider-pet/src/assets/spritesheet.ts'),
  '/** Sprite sheet as WebP base64 data URL (no static file shipped). */\n' +
    `export const SPRITE_SHEET_URL = 'data:image/webp;base64,${webp.toString('base64')}'\n`,
)
console.log('wrote spritesheet.png, spritesheet.webp, pet.json and spritesheet.ts')
