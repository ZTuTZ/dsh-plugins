/**
 * Generate the six pet pose frames via the relay image endpoint
 * (doubao-seedream-5-0-260128, chat/completions). The confirmed transparent
 * reference image is sent as an image_url edit reference; each response
 * content URL is downloaded into 素材/spidey/pet-poses/.
 *
 * Usage:
 *   SPIDEY_KEY=<key> node scripts/gen-pet-poses.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENDPOINT = 'https://www.geeknow.top/v1/chat/completions'
const MODEL = 'doubao-seedream-5-0-260128'
const ROOT = process.cwd()
const REF = join(ROOT, '素材/spidey/spidey-v1-white-eyes.png')
const OUT_DIR = join(ROOT, '素材/spidey/pet-poses')

const POSES = {
  idle: '让角色处于站立待机姿态，轻轻呼吸浮动',
  waiting: '让角色低头等待的姿态，有点无聊地踢脚',
  thinking: '让角色单手托腮思考的姿态',
  jumping: '让角色跳跃庆祝的姿态，单手高举',
  pet: '让角色享受摸头的眯眼满足姿态',
  failed: '让角色趴在地上沮丧的姿态',
}

const key = process.env.SPIDEY_KEY
if (!key) {
  console.error('SPIDEY_KEY env var is required')
  process.exit(1)
}

const reference = `data:image/png;base64,${readFileSync(REF).toString('base64')}`
mkdirSync(OUT_DIR, { recursive: true })

async function generate(pose, instruction) {
  const body = {
    model: MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `保持角色完全不变，${instruction}，纯色绿色背景，无文字无水印` },
        { type: 'image_url', image_url: { url: reference } },
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
    throw new Error(`${pose}: HTTP ${response.status} ${JSON.stringify(data.error ?? '').slice(0, 200)}`)
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  const match = content.match(/https:\/\/[^\s)\"]+/)
  if (!match) throw new Error(`${pose}: no image URL in response`)
  const image = await fetch(match[0])
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(join(OUT_DIR, `${pose}.jpeg`), buffer)
  console.log(`ok ${pose}: ${buffer.length} bytes`)
}

for (const [pose, instruction] of Object.entries(POSES)) {
  await generate(pose, instruction)
}
console.log('all poses generated')
