import { useEffect, useRef, useState } from 'react'
import type { PetController, PetPersist } from '../core/controller.ts'
import type { FrameTable, SpriteSheetMeta } from '../core/spritesheet.ts'
import type { PetAnimation } from '../core/state.ts'
import { framePosition, totalFrames } from '../core/spritesheet.ts'
import css from './pet.module.css'

export interface PetViewProps {
  controller: PetController
  meta: SpriteSheetMeta
  table: FrameTable
  sheetUrl: string
  onInteract: () => void
}

export function PetView(props: PetViewProps): JSX.Element {
  const [frame, setFrame] = useState(0)
  const frameRef = useRef(0)
  const [showBubble, setShowBubble] = useState(false)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const timer = setInterval(() => {
      const total = totalFrames(props.table)
      frameRef.current = (frameRef.current + 1) % total
      setFrame(frameRef.current)
    }, 120)
    return () => clearInterval(timer)
  }, [props.table])

  const snapshot = props.controller.getSnapshot()
  const persist: PetPersist = snapshot.persist
  const animation: PetAnimation = snapshot.animation
  const row = props.table.rows[animation] ?? props.table.rows.idle ?? 0
  const index = frame % (props.table.frames[row] ?? 1)
  const pos = framePosition(props.meta, row, index)

  const handleClick = (): void => {
    props.onInteract()
    setShowBubble(true)
    if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setShowBubble(false), 1200)
  }

  return (
    <div
      className={css.petView}
      data-dsh-spider-pet=""
      style={{ right: persist.display.right, bottom: persist.display.bottom, width: persist.display.size, height: persist.display.size }}
      onClick={handleClick}
      role="button"
      aria-label={persist.display.name}
    >
      <span className={css.bubble} data-show={showBubble}>{persist.display.name}</span>
      <div
        className={css.petSprite}
        style={{
          backgroundImage: `url(${props.sheetUrl})`,
          backgroundSize: `${props.meta.framesPerRow * props.meta.cellWidth}px ${props.meta.cellHeight}px`,
          backgroundPosition: `-${pos.x}px -${pos.y}px`,
        }}
      />
    </div>
  )
}
