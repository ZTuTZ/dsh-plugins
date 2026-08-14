/**
 * Build the pet sprite sheet from the six pose frames.
 *
 * Each pose JPEG (green background) is chroma-keyed at high resolution, then
 * expanded into a smooth per-pose animation (breathing, bounce, sway, jump…)
 * so every cell in the row is filled. Outputs:
 *   素材/spidey/spritesheet.png / .webp
 *   素材/spidey/pet.json
 *   packages/dsh-spider-pet/src/assets/spritesheet.ts
 *
 * Usage: node scripts/build-spritesheet.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const POSES = ['idle', 'waiting', 'thinking', 'jumping', 'pet', 'failed']
const FRAMES = [8, 6, 6, 6, 5, 5]
const CELL = 256
const COLS = 8
const ROOT = process.cwd()
const SRC_DIR = join(ROOT, '素材/spidey/pet-poses')
const OUT_DIR = join(ROOT, '素材/spidey')
const KEY_SIZE = 1024

/** Chroma-key the green background (key approx #3fd771) with despill. */
function keyGreen(input, w, h) {
  const out = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    const o3 = i * 3
    let r = input[o3]
    let g = input[o3 + 1]
    const b = input[o3 + 2]
    const greenness = g - Math.max(r, b)
    let alpha = 255
    if (greenness > 40) {
      alpha = 0
    } else if (greenness > 10) {
      alpha = Math.round(255 * (1 - (greenness - 10) / 30))
      g = Math.min(r, b) + Math.round((g - Math.min(r, b)) * 0.35)
    }
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = alpha
  }
  return out
}

/** Per-pose animation transforms (frame index -> {dx, dy, scaleX, scaleY, angle}). */
function frameTransform(pose, index, count) {
  const t = index / Math.max(1, count - 1)
  const phase = (index / count) * Math.PI * 2
  switch (pose) {
    case 'idle': // breathing: gentle vertical bob + chest swell
      return { dx: 0, dy: Math.round(Math.sin(phase) * 2.5), scaleX: 1, scaleY: 1 + Math.sin(phase) * 0.02 }
    case 'waiting': // light foot-tap bounce
      return { dx: 0, dy: Math.round(Math.sin(phase) * 4), scaleX: 1, scaleY: 1 + Math.sin(phase) * 0.015 }
    case 'thinking': // slow head sway
      return { dx: 0, dy: 0, angle: Math.sin(phase) * 2.2 }
    case 'jumping': // jump arc: squash at takeoff/land, rise mid-air
      return {
        dx: 0,
        dy: Math.round(-Math.sin(t * Math.PI) * 42),
        scaleX: 1 + Math.sin(t * Math.PI) * 0.05,
        scaleY: 1 - Math.sin(t * Math.PI) * 0.06,
      }
    case 'pet': // happy squash & stretch bounce
      return {
        dx: 0,
        dy: Math.round(-Math.abs(Math.sin(phase)) * 9),
        scaleX: 1 - Math.sin(phase) * 0.05,
        scaleY: 1 + Math.sin(phase) * 0.09,
      }
    case 'failed': // slow side-to-side wiggle
      return { dx: 0, dy: 0, angle: Math.sin(phase) * 3.5 }
    default:
      return { dx: 0, dy: 0, scaleX: 1, scaleY: 1 }
  }
}

async function keyedPose(name) {
  const file = join(SRC_DIR, `${name}.jpeg`)
  const resized = await sharp(readFileSync(file))
    .resize(KEY_SIZE, KEY_SIZE, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = keyGreen(resized.data, resized.info.width, resized.info.height)
  return await sharp(rgba, { raw: { width: KEY_SIZE, height: KEY_SIZE, channels: 4 } }).png().toBuffer()
}

async function spriteCells(name, count) {
  const png = await keyedPose(name)
  const img = sharp(png).ensureAlpha()
  // Each pose JPEG contains TWO sprites side by side (a seedream quirk).
  // Split it: find the vertical gap in the opaque column profile and keep the
  // left sprite so every cell holds exactly one character.
  const raw = await img.raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: CH } = raw.info
  const profile = new Int32Array(W)
  // use the central vertical band so corner vignette noise never seeds a run
  const y0 = Math.floor(H * 0.2)
  const y1 = Math.floor(H * 0.8)
  for (let y = y0; y < y1; y += 2) {
    for (let x = 0; x < W; x++) {
      if (raw.data[(y * W + x) * CH + 3] > 120) profile[x]++
    }
  }
  const contentMin = Math.max(3, Math.floor((y1 - y0) / 2 * 0.04))
  const runs = []
  let runStart = -1
  for (let x = 0; x < W; x++) {
    if (profile[x] > contentMin && runStart < 0) runStart = x
    if (profile[x] <= contentMin && runStart >= 0) {
      runs.push([runStart, x - 1])
      runStart = -1
    }
  }
  if (runStart >= 0) runs.push([runStart, W - 1])
  // the widest run contains both sprites; split it at the deepest valley
  let run = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0]
  if (!run) run = [0, W - 1]
  const [start, end] = run
  let gap = Math.floor((start + end) / 2)
  let best = Infinity
  for (let x = start + Math.floor((end - start) * 0.25); x <= end - Math.floor((end - start) * 0.25); x++) {
    if (profile[x] < best) {
      best = profile[x]
      gap = x
    }
  }
  gap = Math.max(start + 1, Math.min(end - 1, gap))
  console.log(`  ${name}: W=${W} H=${H} run=${start}..${end} gap=${gap} width=${Math.max(2, gap - start + 1)}`)
  // sharp 0.35 misbehaves when extract() is chained straight into trim();
  // run them as separate pipelines.
  const extracted = await sharp(png)
    .extract({ left: start, top: 0, width: Math.max(2, gap - start + 1), height: H })
    .png()
    .toBuffer()
  const info = await sharp(extracted)
    .trim({ threshold: 120 })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const trimmed = sharp(info.data, { raw: { width: info.info.width, height: info.info.height, channels: info.info.channels } })
  console.log(`  ${name}: run ${start}..${end}, left sprite ${start}..${gap}`)
  // normalize sprite to a comfortable height inside the cell
  const BASE_H = 196
  const norm = await trimmed.resize({ height: BASE_H, withoutEnlargement: false }).png().toBuffer()
  const nm = await sharp(norm).metadata()
  const cells = []
  for (let f = 0; f < count; f++) {
    const tr = frameTransform(name, f, count)
    let layer = sharp(norm)
    if (tr.angle) {
      layer = layer.rotate(tr.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    }
    const w = Math.max(1, Math.round(nm.width * (tr.scaleX ?? 1)))
    const h = Math.max(1, Math.round(BASE_H * (tr.scaleY ?? 1)))
    const buf = await layer.resize(w, h).png().toBuffer()
    const m = await sharp(buf).metadata()
    const cell = sharp({
      create: { width: CELL, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
    cells.push({
      input: buf,
      left: Math.round((CELL - m.width) / 2 + (tr.dx ?? 0)),
      top: Math.round((CELL - m.height) / 2 + (tr.dy ?? 0)),
      w: m.width,
      h: m.height,
    })
  }
  return { cells }
}

const composites = []
for (let r = 0; r < POSES.length; r++) {
  const name = POSES[r]
  const count = FRAMES[r]
  const { cells } = await spriteCells(name, count)
  for (let f = 0; f < count; f++) {
    composites.push({
      input: cells[f].input,
      left: f * CELL + cells[f].left,
      top: r * CELL + cells[f].top,
    })
  }
  console.log(`ok ${name}: ${count} frames`)
}

const SHEET_W = COLS * CELL
const SHEET_H = POSES.length * CELL
const canvas = sharp({
  create: { width: SHEET_W, height: SHEET_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
const png = await canvas.composite(composites).png().toBuffer()
const webp = await canvas.composite(composites).webp({ quality: 82 }).toBuffer()

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'spritesheet.png'), png)
writeFileSync(join(OUT_DIR, 'spritesheet.webp'), webp)
writeFileSync(join(OUT_DIR, 'pet.json'), JSON.stringify({
  rows: Object.fromEntries(POSES.map((p, i) => [p, i])),
  frames: FRAMES,
  cell: { width: CELL, height: CELL },
}, null, 2) + '\n')
writeFileSync(
  join(ROOT, 'packages/dsh-spider-pet/src/assets/spritesheet.ts'),
  '/** Sprite sheet as WebP base64 data URL (no static file shipped). */\n' +
    `export const SPRITE_SHEET_URL = 'data:image/webp;base64,${webp.toString('base64')}'\n`,
)
console.log(`wrote spritesheet ${SHEET_W}x${SHEET_H}, pet.json, spritesheet.ts`)
