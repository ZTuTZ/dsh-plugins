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

  const persist: PetPersist = snapshot.persist
  const row = props.table.rows[animation] ?? props.table.rows.idle ?? 0
  const index = frame % (props.table.frames[row] ?? 1)
  const pos = framePosition(props.meta, row, index)
  // The pet element may be resized; scale the sheet so one cell exactly fills
  // the element (whole sprite visible, no cropping by the window).
  const scale = persist.display.size / props.meta.cellWidth

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
      <div
        className={css.petSprite}
        onClick={handleClick}
        onPointerDown={props.onDrag}
        style={{
          backgroundImage: `url(${props.sheetUrl})`,
          backgroundSize: `${props.meta.framesPerRow * props.meta.cellWidth * scale}px ${Object.keys(props.table.rows).length * props.meta.cellHeight * scale}px`,
          backgroundPosition: `-${Math.round(pos.x * scale)}px -${Math.round(pos.y * scale)}px`,
        }}
      />
      {props.panelOpen ? <PetPanel controller={props.controller} onClose={props.onPanel} /> : null}
    </div>
  )
}
