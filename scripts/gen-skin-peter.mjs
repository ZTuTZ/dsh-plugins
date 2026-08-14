/**
 * Generate the Peter Parker variant matching the site's classic suit pose.
 * The transparent suit render (suit-06) is used as the pose/framing reference.
 *
 * Usage:
 *   SPIDEY_KEY=<key> node scripts/gen-skin-peter.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENDPOINT = 'https://www.geeknow.top/v1/chat/completions'
const MODEL = 'doubao-seedream-5-0-260128'
const OUT_DIR = join(process.cwd(), '素材/spidey/skin-hero')

const key = process.env.SPIDEY_KEY
if (!key) {
  console.error('SPIDEY_KEY env var is required')
  process.exit(1)
}

const suitRef = `data:image/png;base64,${readFileSync(join('/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public/suits-normalized/suit-06.png')).toString('base64')}`

const body = {
  model: MODEL,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: '保持参考图完全相同的全身姿势、角度和构图，把蜘蛛侠战衣换成彼得·帕克本人：年轻白人男性，日常休闲便装（白色圆领T恤、深蓝色牛仔裤、白色运动鞋），真实照片风格。竖版全身像，人物居中，人物占画面高度90%左右，头顶留空不超过5%，脚下留空不超过5%，左右各留空不超过8%，纯色亮红背景(#E0182B)，明亮清晰，无文字无水印',
      },
      { type: 'image_url', image_url: { url: suitRef } },
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
  throw new Error(`HTTP ${response.status} ${JSON.stringify(data.error ?? '').slice(0, 300)}`)
}
const content = data.choices?.[0]?.message?.content ?? ''
const match = content.match(/https:\/\/[^\s)\"]+/)
if (!match) {
  console.error('response content:', content.slice(0, 500))
  throw new Error('no image URL in response')
}
const image = await fetch(match[0])
if (!image.ok) throw new Error(`image download ${image.status}`)
const buffer = Buffer.from(await image.arrayBuffer())
writeFileSync(join(OUT_DIR, 'peter.png'), buffer)
console.log('ok peter:', buffer.length, 'bytes')
