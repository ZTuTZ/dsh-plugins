import type { PetController } from '../core/controller.ts'
import css from './pet.module.css'

export interface PetPanelProps {
  controller: PetController
  onClose: () => void
}

export function PetPanel(props: PetPanelProps): JSX.Element {
  return (
    <div className={css.panel} data-dsh-spider-pet-panel="">
      <div className={css.panelHeader}>
        <span>宠物</span>
        <button type="button" onClick={props.onClose}>x</button>
      </div>
      <div className={css.panelRow}>
        <button type="button" onClick={() => { props.controller.setDisplay({ visible: false }); props.onClose() }}>隐藏</button>
      </div>
    </div>
  )
}
