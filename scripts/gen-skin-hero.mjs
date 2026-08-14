/**
 * Generate the centered Spider-Man hero reveal images via the relay endpoint
 * (doubao-seedream-5-0-260128, chat/completions). Produces a suit image first,
 * then reuses it as a pose reference for the Peter Parker civilian variant.
 *
 * Usage:
 *   SPIDEY_KEY=<key> node scripts/gen-skin-hero.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const ENDPOINT = 'https://www.geeknow.top/v1/chat/completions'
const MODEL = 'doubao-seedream-5-0-260128'
const OUT_DIR = join(process.cwd(), '素材/spidey/skin-hero')
const REF_DIR = '/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public'
mkdirSync(OUT_DIR, { recursive: true })

const key = process.env.SPIDEY_KEY
if (!key) {
  console.error('SPIDEY_KEY env var is required')
  process.exit(1)
}

const BASE_STYLE = '竖版全身像，角色完整出现在画面正中央，人物占画面高度90%左右，头顶留空不超过5%，脚下留空不超过5%，左右各留空不超过8%，纯色亮红背景(#E0182B)，明亮清晰，无文字无水印'

async function generate(label, text, references) {
  const content = [
    { type: 'text', text },
  ]
  for (const ref of references ?? []) {
    content.push({ type: 'image_url', image_url: { url: ref } })
  }
  const body = { model: MODEL, messages: [{ role: 'user', content }] }
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${JSON.stringify(data.error ?? '').slice(0, 300)}`)
  }
  const contentStr = data.choices?.[0]?.message?.content ?? ''
  const match = contentStr.match(/https:\/\/[^\s)\"]+/)
  if (!match) throw new Error(`${label}: no image URL in response`)
  const image = await fetch(match[0])
  if (!image.ok) throw new Error(`${label}: image download ${image.status}`)
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(join(OUT_DIR, `${label}.png`), buffer)
  console.log(`ok ${label}: ${buffer.length} bytes`)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

// Crop the cover to the figure region so the character design is unmistakable.
async function cropToBase64(file, x0, y0, x1, y1, width) {
  const height = Math.round(width * (y1 - y0) / (x1 - x0))
  const buffer = await sharp(join(REF_DIR, file))
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .resize(width, height)
    .jpeg({ quality: 88 })
    .toBuffer()
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

const coverSuit = await cropToBase64('home-cover-suit.jpg', 900, 0, 2569, 1440, 900)
const coverPeter = await cropToBase64('home-cover-peter.jpg', 900, 0, 2569, 1440, 900)

const suitRef = await generate(
  'suit',
  `以参考图中这位蜘蛛侠为原型，严格保持他的角色设计（经典红蓝蜘蛛战衣、白色大眼、蛛网纹路、整体造型和气质），生成一张居中的竖版全身像：${BASE_STYLE}`,
  [coverSuit],
)
await generate(
  'peter',
  `保持第一张参考图的构图、姿势、角度和红色背景完全一致，把蜘蛛侠战衣换成彼得·帕克本人：以第二张参考图中彼得·帕克的形象为原型（年轻白人男性、休闲便装、真实照片风格），${BASE_STYLE}`,
  [suitRef, coverPeter],
)
console.log('all skin hero images generated')
