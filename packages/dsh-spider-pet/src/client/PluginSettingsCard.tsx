import type { PetController } from '../core/controller.ts'

export interface PluginSettingsCardProps {
  controller: PetController
}

export function PluginSettingsCard(_props: PluginSettingsCardProps): JSX.Element {
  const snapshot = _props.controller.getSnapshot()
  return (
    <div data-dsh-spider-pet-settings="">
      <div>宠物：{snapshot.persist.display.name}</div>
      <button type="button" onClick={() => _props.controller.setDisplay({ visible: !snapshot.persist.display.visible })}>
        {snapshot.persist.display.visible ? '隐藏' : '显示'}
      </button>
    </div>
  )
}
