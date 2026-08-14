/**
 * Regenerate the skin heroes from the reference site's cover art. The cover
 * figure crop is used as the style/pose reference; the prompt demands a
 * full-bleed vertical character so the figure is large and crisp.
 *
 * Usage:
 *   SPIDEY_KEY=<key> node scripts/gen-skin-cover.mjs
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

async function cropToBase64(file, x0, y0, x1, y1, width) {
  const height = Math.round(width * (y1 - y0) / (x1 - x0))
  const buffer = await sharp(join(REF_DIR, file))
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .resize(width, height)
    .jpeg({ quality: 88 })
    .toBuffer()
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

async function generate(label, text, references) {
  const content = [{ type: 'text', text }]
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
  if (!match) {
    console.error(`${label} response:`, contentStr.slice(0, 400))
    throw new Error(`${label}: no image URL in response`)
  }
  const image = await fetch(match[0])
  if (!image.ok) throw new Error(`${label}: image download ${image.status}`)
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(join(OUT_DIR, `${label}.png`), buffer)
  console.log(`ok ${label}: ${buffer.length} bytes`)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

const TIGHT = '人物占满画面高度，头顶留空不超过3%，脚下留空不超过3%，左右各留空不超过6%，纯色亮红背景(#E0182B)，人物完整清晰锐利，真实电影质感，无文字无水印'

const coverSuit = await cropToBase64('home-cover-suit.jpg', 900, 0, 2569, 1440, 900)
const coverPeter = await cropToBase64('home-cover-peter.jpg', 900, 0, 2569, 1440, 900)

const suitRef = await generate(
  'suit-cover',
  `把参考图中的人物完整提取出来，保持他完全相同的角色造型、姿势和风格（经典红蓝蜘蛛战衣、白色大眼、蛛网纹路、真实电影质感）。生成竖版全身立绘：${TIGHT}`,
  [coverSuit],
)
await generate(
  'peter-cover',
  `第一张参考图提供姿势和构图，第二张参考图提供人物形象。把第二张参考图中的彼得·帕克提取出来，保持他的形象（年轻白人男性、休闲便装、真实照片质感），换成第一张参考图完全相同的全身姿势和构图。生成竖版全身立绘：${TIGHT}`,
  [suitRef, coverPeter],
)
console.log('cover-based heroes generated')
