import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'

export interface PluginSettingsCardProps {
  /** The shared spider-app settings scope (enabled controls pet + skin). */
  scope: SettingsScope<{ enabled?: boolean }>
}

export function PluginSettingsCard(props: PluginSettingsCardProps): JSX.Element {
  const snapshot = props.scope.getSnapshot()
  const enabled = snapshot.status === 'ready' ? (snapshot.value?.enabled ?? true) : true
  return (
    <div data-dsh-spider-pet-settings="">
      <div>蜘蛛侠应用（宠物 + 皮肤）</div>
      <button type="button" onClick={() => { void props.scope.set('enabled', !enabled) }}>
        {enabled ? '关闭' : '打开'}
      </button>
      <div>{enabled ? '已开启' : '已关闭'}</div>
    </div>
  )
}
