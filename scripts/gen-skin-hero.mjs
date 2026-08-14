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

const ENDPOINT = 'https://www.geeknow.top/v1/chat/completions'
const MODEL = 'doubao-seedream-5-0-260128'
const OUT_DIR = join(process.cwd(), '素材/spidey/skin-hero')
mkdirSync(OUT_DIR, { recursive: true })

const key = process.env.SPIDEY_KEY
if (!key) {
  console.error('SPIDEY_KEY env var is required')
  process.exit(1)
}

const BASE_STYLE = '竖版全身像，角色完整出现在画面正中央，头顶留空约15%，脚下留空约10%，左右各留空约12%，纯色亮红背景(#E0182B)，影棚布光，电影感，无文字无水印'

async function generate(label, text, reference) {
  const content = [
    { type: 'text', text },
  ]
  if (reference) {
    content.push({ type: 'image_url', image_url: { url: reference } })
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

const suitRef = await generate(
  'suit',
  `生成一张蜘蛛侠主题的英雄形象：穿红蓝经典蜘蛛战衣的蜘蛛侠，全身像，正面站立英雄姿态，双臂自然微张，${BASE_STYLE}`,
)
await generate(
  'peter',
  `保持这张参考图的构图、姿势、角度和红色背景完全一致，只把蜘蛛侠战衣换成彼得·帕克本人的日常便装：白色圆领T恤、深蓝色牛仔裤、白色运动鞋，腰间随意系一件红色连帽卫衣，彼得·帕克是年轻白人男性，真实照片风格，${BASE_STYLE}`,
  suitRef,
)
console.log('all skin hero images generated')
