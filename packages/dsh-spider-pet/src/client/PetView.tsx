import { useEffect, useRef, useState } from 'react'
import type { PetController, PetPersist } from '../core/controller.ts'
import type { FrameTable, SpriteSheetMeta } from '../core/spritesheet.ts'
import type { PetAnimation } from '../core/state.ts'
import { framePosition, totalFrames } from '../core/spritesheet.ts'
import { PetPanel } from './PetPanel.tsx'
import css from './pet.module.css'

/** Per-animation frame pacing (ms) — slower for pensive poses, snappier for
 *  jumps/petting so every pose reads naturally instead of a uniform stutter. */
const FRAME_DURATION_MS: Record<PetAnimation, number> = {
  idle: 55,
  waiting: 65,
  thinking: 75,
  jumping: 40,
}

export interface PetViewProps {
  controller: PetController
  meta: SpriteSheetMeta
  table: FrameTable
  sheetUrl: string
  onInteract: () => void
  onPanel: () => void
  panelOpen: boolean
  onDrag: (event: React.PointerEvent) => void
}

export function PetView(props: PetViewProps): JSX.Element | null {
  const snapshot = props.controller.getSnapshot()
  const animation: PetAnimation = snapshot.animation

  // Master switch off: render nothing — the app-restore button lives at the
  // plugin level, and the hidden-state summon must not survive an app close.
  // Must sit before any hooks so the hook order stays stable across toggles.
  if (!snapshot.appEnabled) return null

  const [frame, setFrame] = useState(0)
  const frameRef = useRef(0)
  const [showBubble, setShowBubble] = useState(false)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [sheetImage, setSheetImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    // Restart the track from its first frame whenever the animation changes,
    // so state switches never resume mid-pose (which read as jumps).
    frameRef.current = 0
    let raf = 0
    let last = performance.now()
    let elapsed = 0
    const tick = (ts: number): void => {
      const delta = ts - last
      last = ts
      elapsed += delta
      const duration = FRAME_DURATION_MS[animation] ?? 100
      while (elapsed >= duration) {
        elapsed -= duration
        const total = totalFrames(props.table)
        frameRef.current = (frameRef.current + 1) % total
      }
      setFrame(frameRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animation, props.table])

  // Decode the sprite sheet once, then blit the current cell into a canvas on
  // every frame. Animating a giant CSS background (4096x1024 WebP) via
  // background-position is composited by the GPU and shows clipping/tearing
  // artifacts on some devices even though the sheet itself has clean margins.
  useEffect(() => {
    const image = new Image()
    image.onload = () => setSheetImage(image)
    image.src = props.sheetUrl
    return () => { image.onload = null }
  }, [props.sheetUrl])

  const persist: PetPersist = snapshot.persist
  const row = props.table.rows[animation] ?? props.table.rows.idle ?? 0
  const index = frame % (props.table.frames[row] ?? 1)
  const pos = framePosition(props.meta, row, index)
  const size = persist.display.size

  // Redraw whenever the frame advances, the decoded sheet arrives, or the
  // pet size changes. The canvas is sized in device pixels so the sprite
  // stays crisp on Retina displays; CSS keeps it at `size` CSS pixels.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !sheetImage) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const pixelWidth = Math.max(1, Math.round(size * dpr))
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelWidth) canvas.height = pixelWidth
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(
      sheetImage,
      pos.x, pos.y, props.meta.cellWidth, props.meta.cellHeight,
      0, 0, size, size,
    )
  }, [frame, sheetImage, props.meta, props.table, size, pos.x, pos.y])

  const handleClick = (): void => {
    props.onInteract()
    setShowBubble(true)
    if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setShowBubble(false), 1200)
  }

  // Status bubble (host activity phrase) takes priority over the happy
  // feedback bubble shown right after a pet interaction.
  const bubbleText = snapshot.bubble ?? (showBubble ? '嗷呜～' : undefined)

  // Hidden: render a summon button at the pet's last position so the pet can
  // always be brought back (the dock row of the reference plugin does the
  // same; here the pet is an independent floating layer).
  if (!persist.display.visible) {
    return (
      <button
        className={css.summon}
        data-dsh-spider-pet-summon=""
        style={{ right: persist.display.right, bottom: persist.display.bottom }}
        onClick={() => { props.controller.setDisplay({ visible: true }) }}
        type="button"
      >
        召唤{persist.display.name}
      </button>
    )
  }

  return (
    <div
      className={css.petView}
      data-dsh-spider-pet=""
      style={{ right: persist.display.right, bottom: persist.display.bottom, width: persist.display.size, height: persist.display.size }}
      onContextMenu={(e) => { e.preventDefault(); props.onPanel() }}
      role="button"
      aria-label={persist.display.name}
    >
      {bubbleText !== undefined ? (
        <span className={css.bubble} data-show="true">{bubbleText}</span>
      ) : null}
      <canvas
        className={css.petSprite}
        onClick={handleClick}
        onPointerDown={props.onDrag}
        ref={canvasRef}
      />
      {props.panelOpen ? <PetPanel controller={props.controller} onClose={props.onPanel} /> : null}
    </div>
  )
}
