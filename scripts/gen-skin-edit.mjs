/**
 * Ask seedream to EDIT the cover figure crops: keep the character exactly as
 * in the reference, complete the frame-cropped edges, and replace the
 * background with solid red — a background-cleanup edit instead of a fresh
 * full-body render. Runs a single request per process with retries.
 *
 * Usage:
 *   SPIDEY_KEY=<key> node scripts/gen-skin-edit.mjs suit|peter
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ENDPOINT = 'https://www.geeknow.top/v1/chat/completions'
const MODEL = 'doubao-seedream-5-0-260128'
const OUT_DIR = join(process.cwd(), '素材/spidey/skin-hero')
const REF_DIR = '/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public'
mkdirSync(OUT_DIR, { recursive: true })

const which = process.argv[2]
if (!['suit', 'peter'].includes(which)) {
  console.error('usage: node gen-skin-edit.mjs suit|peter')
  process.exit(1)
}
const key = process.env.SPIDEY_KEY
if (!key) {
  console.error('SPIDEY_KEY env var is required')
  process.exit(1)
}

const file = which === 'suit' ? 'home-cover-suit.jpg' : 'home-cover-peter.jpg'
const height = Math.round(1024 * 1440 / 1669)
const crop = await sharp(join(REF_DIR, file))
  .extract({ left: 900, top: 0, width: 1669, height: 1440 })
  .resize(1024, height)
  .png()
  .toBuffer()
const ref = `data:image/png;base64,${crop.toString('base64')}`

const prompt = which === 'suit'
  ? '参考图是一张蜘蛛侠的照片。请保持图中人物完全不变（姿势、造型、大小、比例、风格都原样保留），把人物被画面边缘裁掉的部分自然完整地补全（包括头顶上方和右侧被切掉的部分），让整个人物完整可见，然后把背景替换成纯色亮红(#E0182B)。人物是经典红蓝蜘蛛战衣、白色大眼，真实电影质感，清晰锐利，无文字无水印'
  : '参考图是一张彼得·帕克（年轻白人男性）的照片。请保持图中人物完全不变（姿势、造型、大小、比例、风格都原样保留），把人物被画面边缘裁掉的部分自然完整地补全（包括头顶上方和右侧被切掉的部分），让整个人物完整可见，然后把背景替换成纯色亮红(#E0182B)。真实照片质感，清晰锐利，无文字无水印'

for (let attempt = 1; attempt <= 3; attempt++) {
  const body = {
    model: MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: ref } },
      ],
    }],
  }
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    console.log(`attempt ${attempt}: HTTP ${response.status} ${JSON.stringify(data.error ?? '').slice(0, 200)}`)
  } else {
    const contentStr = data.choices?.[0]?.message?.content ?? ''
    const match = contentStr.match(/https:\/\/[^\s)\"]+/)
    if (match) {
      const image = await fetch(match[0])
      const buffer = Buffer.from(await image.arrayBuffer())
      writeFileSync(join(OUT_DIR, `${which}-edited.png`), buffer)
      console.log(`ok ${which}-edited: ${buffer.length} bytes (attempt ${attempt})`)
      process.exit(0)
    }
    console.log(`attempt ${attempt}: empty/odd response: ${contentStr.slice(0, 200)}`)
  }
  await new Promise((r) => setTimeout(r, 8000))
}
console.error(`failed after 3 attempts`)
process.exit(1)
