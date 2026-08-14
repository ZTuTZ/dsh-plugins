/**
 * Try gpt-image-2 through the relay images endpoint: extract the cover
 * characters with a transparent background.
 *
 * Usage:
 *   SPIDEY_KEY=<key> node scripts/gen-skin-gptimage.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ENDPOINT = 'https://www.geeknow.top/v1/images/generations'
const MODEL = 'gpt-image-2'
const OUT_DIR = join(process.cwd(), '素材/spidey/skin-hero')
const REF_DIR = '/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public'
mkdirSync(OUT_DIR, { recursive: true })

const key = process.env.SPIDEY_KEY
if (!key) {
  console.error('SPIDEY_KEY env var is required')
  process.exit(1)
}

async function cropToB64(file, x0, y0, x1, y1, width) {
  const height = Math.round(width * (y1 - y0) / (x1 - x0))
  const buffer = await sharp(join(REF_DIR, file))
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .resize(width, height)
    .png()
    .toBuffer()
  return `data:image/png;base64,${buffer.toString('base64')}`
}

const suitRef = await cropToB64('home-cover-suit.jpg', 900, 0, 2569, 1440, 1024)
const peterRef = await cropToB64('home-cover-peter.jpg', 900, 0, 2569, 1440, 1024)

async function generate(label, prompt, image) {
  const body = {
    model: MODEL,
    prompt,
    n: 1,
    size: '1024x1536',
    image,
  }
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  console.log(label, 'HTTP', response.status, 'keys:', Object.keys(data).join(','))
  if (!response.ok) {
    console.error(label, 'error:', JSON.stringify(data).slice(0, 400))
    return null
  }
  const item = data.data?.[0]
  const b64 = item?.b64_json
  const url = item?.url
  if (b64) {
    writeFileSync(join(OUT_DIR, `${label}.png`), Buffer.from(b64, 'base64'))
    console.log(`ok ${label}: b64_json ${b64.length / 1024 | 0}KB`)
    return
  }
  if (url) {
    const img = await fetch(url)
    const buf = Buffer.from(await img.arrayBuffer())
    writeFileSync(join(OUT_DIR, `${label}.png`), buf)
    console.log(`ok ${label}: url ${buf.length} bytes`)
    return
  }
  console.error(label, 'no image in response', JSON.stringify(data).slice(0, 400))
}

await generate(
  'suit-gpt',
  'Extract the full-body Spider-Man character from the reference image. Remove the red background completely and output the whole character (head to feet, complete, nothing cut off) on a fully transparent background. Keep the classic red-blue suit with big white eyes and web pattern, sharp realistic render.',
  suitRef,
)
await generate(
  'peter-gpt',
  'Extract the full-body Peter Parker character from the reference image. Remove the red background completely and output the whole person (head to feet, complete) on a fully transparent background. Keep his casual outfit and realistic photo look.',
  peterRef,
)
console.log('gpt-image attempt finished')
