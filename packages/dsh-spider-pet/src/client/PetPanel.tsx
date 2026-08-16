import { useState } from 'react'
import type { PetController } from '../core/controller.ts'
import css from './pet.module.css'

export interface PetPanelProps {
  controller: PetController
  onClose: () => void
}

/** Default screen offset used by the panel's reset action. */
export const DEFAULT_POSITION = { right: 24, bottom: 20 }

const STATUS_LABEL: Record<string, string> = {
  idle: '待机',
  waiting: '等待回复',
  thinking: '思考中',
  done: '欢呼',
  pet: '被摸头',
  failed: '沮丧',
}

export function PetPanel(props: PetPanelProps): JSX.Element {
  const snapshot = props.controller.getSnapshot()
  const display = snapshot.persist.display

  return (
    <div
      className={css.panel}
      data-dsh-spider-pet-panel=""
      // The panel lives inside .petView, whose onContextMenu toggles the
      // panel closed; right-clicking inside the panel itself must not.
      onContextMenu={(e) => { e.stopPropagation() }}
    >
      <div className={css.panelHeader}>
        <span>宠物面板 · {display.name}</span>
        <button type="button" onClick={props.onClose}>x</button>
      </div>

      <div className={css.panelRow}>
        <span className={css.panelLabel}>状态</span>
        <span className={css.panelStatus}>{STATUS_LABEL[snapshot.activity] ?? '待机'}</span>
      </div>

      <div className={css.panelRow}>
        <span className={css.panelLabel}>名字</span>
        <RenameInput controller={props.controller} initial={display.name} />
      </div>

      <div className={css.panelRow}>
        <span className={css.panelLabel}>大小</span>
        <input
          type="range"
          min={80}
          max={320}
          step={4}
          value={display.size}
          onChange={(e) => { props.controller.setDisplay({ size: Number(e.target.value) }) }}
        />
        <span className={css.panelValue}>{display.size}px</span>
      </div>

      <div className={css.panelRow}>
        <button type="button" onClick={() => { props.controller.setDisplay(DEFAULT_POSITION) }}>重置位置</button>
        <button type="button" onClick={() => { props.controller.setDisplay({ visible: false }); props.onClose() }}>隐藏</button>
      </div>
    </div>
  )
}

/** Inline name editor: commits on blur, Enter, or the save button. */
function RenameInput(props: { controller: PetController; initial: string }): JSX.Element {
  const [draft, setDraft] = useState(props.initial)
  const commit = (): void => {
    const next = draft.trim()
    if (next === '') return
    if (next !== props.initial) props.controller.setDisplay({ name: next })
  }
  return (
    <>
      <input
        className={css.panelInput}
        value={draft}
        maxLength={12}
        placeholder="宠物名字"
        onChange={(e) => { setDraft(e.target.value) }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      />
      <button type="button" onClick={commit}>保存</button>
    </>
  )
}
