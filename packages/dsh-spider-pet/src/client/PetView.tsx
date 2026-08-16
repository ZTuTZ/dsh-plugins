import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PetController, PetPersist } from '../core/controller.ts'
import type { FrameTable, SpriteSheetMeta } from '../core/spritesheet.ts'
import type { PetAnimation } from '../core/state.ts'
import { framePosition } from '../core/spritesheet.ts'
import { PetPanel } from './PetPanel.tsx'
import css from './pet.module.css'

/** Per-animation frame pacing (ms) — slower for pensive poses, snappier for
 *  jumps/petting so every pose reads naturally instead of a uniform stutter. */
const FRAME_DURATION_MS: Record<PetAnimation, number> = {
  idle: 55,
  waiting: 65,
  thinking: 75,
  jumping: 40,
  pet: 55,
  failed: 90,
}

/** Click-vs-double-click detection window (ms): a single click waits this
 *  long before firing the jump so a double-click never plays two jumps. */
const CLICK_DELAY_MS = 280
/** Pointer movement before a press counts as a drag instead of a click (px). */
const DRAG_THRESHOLD_PX = 5
/** Feedback bubble display duration after an interaction (ms). */
const BUBBLE_MS = 1200

export interface PetViewProps {
  controller: PetController
  meta: SpriteSheetMeta
  table: FrameTable
  sheetUrl: string
  onInteract: () => void
  onPetInteract: () => void
  onPanel: () => void
  panelOpen: boolean
}

export function PetView(props: PetViewProps): JSX.Element | null {
  const snapshot = props.controller.getSnapshot()
  // Master switch off: render nothing — the app-restore button lives at the
  // plugin level. Kept as an outer shell so the interactive half's hooks
  // mount/unmount atomically with the switch (React hook rules).
  if (!snapshot.appEnabled) return null
  return <PetContent {...props} />
}

function PetContent(props: PetViewProps): JSX.Element | null {
  const snapshot = props.controller.getSnapshot()
  const animation: PetAnimation = snapshot.animation
  const persist: PetPersist = snapshot.persist

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const frameRef = useRef(0)
  const animationRef = useRef<PetAnimation>(animation)
  const sizeRef = useRef(persist.display.size)
  const sheetImageRef = useRef<HTMLImageElement | null>(null)
  /** Set when a drag consumed the pointer sequence; the trailing click must
   *  not also trigger a jump. */
  const suppressClickRef = useRef(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastClickAt = useRef(0)
  const [sheetImage, setSheetImage] = useState<HTMLImageElement | null>(null)
  const [showBubble, setShowBubble] = useState(false)
  /** Ticked to force a re-render when a jump/pet window expires. */
  const [, forceRender] = useState(0)

  // Keep refs in sync without restarting the frame loop.
  animationRef.current = animation
  sizeRef.current = persist.display.size
  if (sheetImage !== null) sheetImageRef.current = sheetImage

  // Decode the sprite sheet once, then blit the current cell into a canvas.
  // Animating a giant CSS background (4096x1024 WebP) via background-position
  // shows clipping/tearing artifacts on some GPUs, so we draw manually.
  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      sheetImageRef.current = image
      setSheetImage(image)
    }
    image.src = props.sheetUrl
    return () => {
      image.onload = null
      sheetImageRef.current = null
    }
  }, [props.sheetUrl])

  const drawFrame = (): void => {
    const canvas = canvasRef.current
    const image = sheetImageRef.current
    if (!canvas || !image) return
    const size = sizeRef.current
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const pixelWidth = Math.max(1, Math.round(size * dpr))
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelWidth) canvas.height = pixelWidth
    let ctx = ctxRef.current
    if (!ctx) {
      ctx = canvas.getContext('2d')
      if (!ctx) return
      ctxRef.current = ctx
    }
    const row = props.table.rows[animationRef.current] ?? props.table.rows.idle ?? 0
    const total = props.table.frames[row] ?? 1
    const pos = framePosition(props.meta, row, frameRef.current % total)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(
      image,
      pos.x, pos.y, props.meta.cellWidth, props.meta.cellHeight,
      0, 0, size, size,
    )
  }

  // Frame loop: advance the track and blit straight to the canvas — no React
  // state per frame, so animation runs at full rate with zero re-renders.
  // Restarts (and resets to frame 0) whenever the animation row or the
  // decoded sheet changes, so state switches never resume mid-pose.
  useEffect(() => {
    frameRef.current = 0
    if (sheetImageRef.current === null) return
    let raf = 0
    let last = performance.now()
    let elapsed = 0
    const tick = (ts: number): void => {
      const delta = ts - last
      last = ts
      elapsed += delta
      const anim = animationRef.current
      const duration = FRAME_DURATION_MS[anim] ?? 100
      const row = props.table.rows[anim] ?? props.table.rows.idle ?? 0
      const total = props.table.frames[row] ?? 1
      while (elapsed >= duration) {
        elapsed -= duration
        frameRef.current = (frameRef.current + 1) % total
      }
      drawFrame()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animation, props.table, sheetImage])

  // The jump/pet windows live inside PetController.getSnapshot(), which only
  // recomputes on re-render. The poller dedupes stable activity, so nothing
  // would re-render when the window expires — the pet would stay frozen in
  // the happy pose. Force one re-render shortly after the window ends.
  useEffect(() => {
    if (animation !== 'jumping' && animation !== 'pet') return
    const t = window.setTimeout(() => forceRender((x) => x + 1), 1900)
    return () => window.clearTimeout(t)
  }, [animation])

  // Clear interaction timers on unmount.
  useEffect(() => () => {
    if (clickTimer.current !== undefined) clearTimeout(clickTimer.current)
    if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current)
  }, [])

  const showFeedback = (): void => {
    setShowBubble(true)
    if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setShowBubble(false), BUBBLE_MS)
  }

  // Single click plays a jump after the delay window; a second click within
  // the window cancels it and the dblclick handler plays the pet pose.
  const handleClick = (): void => {
    const now = Date.now()
    if (now - lastClickAt.current < CLICK_DELAY_MS) {
      // Second click of a double-click sequence.
      lastClickAt.current = now
      if (clickTimer.current !== undefined) clearTimeout(clickTimer.current)
      return
    }
    lastClickAt.current = now
    // The browser fires a click right after a drag's pointerup — drop it.
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (clickTimer.current !== undefined) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      props.onInteract()
      showFeedback()
    }, CLICK_DELAY_MS)
  }

  // Double-click = petting: dedicated happy pet pose + feedback bubble.
  const handlePet = (): void => {
    lastClickAt.current = Date.now()
    if (clickTimer.current !== undefined) clearTimeout(clickTimer.current)
    props.onPetInteract()
    showFeedback()
  }

  // Drag the pet around. Only pointer movement beyond the threshold counts
  // as a drag; a real drag suppresses the trailing click so it does not
  // trigger a jump, and the root carries data-dragging for the cursor style.
  const handlePointerDown = (event: ReactPointerEvent): void => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startDisplay = props.controller.getSnapshot().persist.display
    let moved = false
    rootRef.current?.setAttribute('data-dragging', 'true')
    const move = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        moved = true
        suppressClickRef.current = true
      }
      if (moved) {
        props.controller.setDisplay({
          right: Math.max(0, startDisplay.right - dx),
          bottom: Math.max(0, startDisplay.bottom - dy),
        })
      }
    }
    const up = (): void => {
      rootRef.current?.removeAttribute('data-dragging')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Status bubble (host activity phrase) takes priority over the happy
  // feedback bubble shown right after a pet interaction.
  const bubbleText = snapshot.bubble ?? (showBubble ? '嗷呜～' : undefined)

  // Hidden: render a summon button at the pet's last position so the pet can
  // always be brought back.
  if (!persist.display.visible) {
    return (
      <button
        className={css.summon}
        data-dsh-spider-pet-summon=""
        style={{
          right: persist.display.right,
          bottom: persist.display.bottom,
        }}
        onClick={() => { props.controller.setDisplay({ visible: true }) }}
        type="button"
      >
        召唤{persist.display.name}
      </button>
    )
  }

  return (
    <div
      ref={rootRef}
      className={css.petView}
      data-dsh-spider-pet=""
      style={{
        right: persist.display.right,
        bottom: persist.display.bottom,
        width: persist.display.size,
        height: persist.display.size,
      }}
      onContextMenu={(e) => { e.preventDefault(); props.onPanel() }}
      role="button"
      aria-label={persist.display.name}
    >
      {bubbleText !== undefined ? (
        <span className={css.bubble} data-show="true">{bubbleText}</span>
      ) : null}
      <button
        type="button"
        className={css.petGear}
        aria-label="宠物面板"
        onClick={(e) => { e.stopPropagation(); props.onPanel() }}
      >
        ⚙
      </button>
      <canvas
        className={css.petSprite}
        onClick={handleClick}
        onDoubleClick={handlePet}
        onPointerDown={handlePointerDown}
        ref={canvasRef}
      />
      {props.panelOpen ? <PetPanel controller={props.controller} onClose={props.onPanel} /> : null}
    </div>
  )
}
