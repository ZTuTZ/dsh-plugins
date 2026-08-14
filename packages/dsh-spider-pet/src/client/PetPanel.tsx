import type { PetController } from '../core/controller.ts'
import css from './pet.module.css'

export interface PetPanelProps {
  controller: PetController
  onClose: () => void
}

export function PetPanel(props: PetPanelProps): JSX.Element {
  const snapshot = props.controller.getSnapshot()
  const { persist } = snapshot

  return (
    <div className={css.panel} data-dsh-spider-pet-panel="">
      <div className={css.panelHeader}>
        <b>{persist.display.name}</b>
        <button type="button" onClick={props.onClose}>x</button>
      </div>
      <div className={css.panelRow}>
        <button type="button" onClick={() => { props.controller.setDisplay({ visible: false }); props.onClose() }}>隐藏</button>
        <button type="button" onClick={() => { props.controller.setDisplay({ size: Math.max(80, persist.display.size - 20) }); props.onClose() }}>-</button>
        <button type="button" onClick={() => { props.controller.setDisplay({ size: Math.min(320, persist.display.size + 20) }); props.onClose() }}>+</button>
      </div>
    </div>
  )
}
