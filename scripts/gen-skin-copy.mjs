/**
 * Copy the proven large-figure composition from the current Peter render:
 * reference #1 is the existing peter.png (big centered portrait), reference
 * #2 is the site's cover suit (style). Ask seedream to fill Peter's framing
 * with the Spider-Man suit.
 *
 * Usage:
 *   SPIDEY_KEY=<key> node scripts/gen-skin-copy.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const ENDPOINT = 'https://www.geeknow.top/v1/chat/completions'
const MODEL = 'doubao-seedream-5-0-260128'
const OUT_DIR = join(process.cwd(), '素材/spidey/skin-hero')
const REF_DIR = '/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public'

const key = process.env.SPIDEY_KEY
if (!key) {
  console.error('SPIDEY_KEY env var is required')
  process.exit(1)
}

const peterRef = `data:image/png;base64,${readFileSync(join(OUT_DIR, 'peter.png')).toString('base64')}`
const coverCrop = await sharp(join(REF_DIR, 'home-cover-suit.jpg'))
  .extract({ left: 900, top: 0, width: 1669, height: 1440 })
  .resize(1024, 884)
  .jpeg({ quality: 88 })
  .toBuffer()
const coverRef = `data:image/jpeg;base64,${coverCrop.toString('base64')}`

const body = {
  model: MODEL,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: '第一张参考图是一张居中的竖版全身人物立绘，请严格保持它的构图、人物姿势、位置和大小比例（人物占画面高度90%左右，头顶留空不超过5%，脚下留空不超过5%，左右留空不超过8%，纯色亮红背景）。把第一张参考图里的人物换成蜘蛛侠：采用第二张参考图蜘蛛侠的经典红蓝战衣造型（白色大眼、蛛网纹路、真实电影质感）。生成与第一张参考图同构图、同大小的蜘蛛侠竖版全身立绘，纯色亮红背景(#E0182B)，清晰锐利，无文字无水印',
      },
      { type: 'image_url', image_url: { url: peterRef } },
      { type: 'image_url', image_url: { url: coverRef } },
    ],
  }],
}

for (let attempt = 1; attempt <= 3; attempt++) {
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
      writeFileSync(join(OUT_DIR, 'suit-copy.png'), buffer)
      console.log(`ok suit-copy: ${buffer.length} bytes (attempt ${attempt})`)
      process.exit(0)
    }
    console.log(`attempt ${attempt}: empty/odd response: ${contentStr.slice(0, 200)}`)
  }
  await new Promise((r) => setTimeout(r, 8000))
}
console.error('failed after 3 attempts')
process.exit(1)
