import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { APP_STORAGE_KEY, APP_TOGGLE_EVENT, readAppEnabled } from '../core/controller.ts'

/** Props the official Plugins settings section binds for its tabs. */
export type SpiderAppTabProps = PropsRuntime<'settings.plugins.tab'>

/**
 * One tab inside the official Plugins settings page: the spider-app master
 * switch. Writes the shared localStorage flag and broadcasts the toggle event
 * so the pet and the skin (which listen to the same key/event) mount or
 * unmount together.
 */
export function SpiderAppTab(_props: SpiderAppTabProps): JSX.Element {
  const [enabled, setEnabled] = useState(() => readAppEnabled(localStorage))

  useEffect(() => {
    const refresh = (): void => setEnabled(readAppEnabled(localStorage))
    window.addEventListener(APP_TOGGLE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(APP_TOGGLE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const toggle = (): void => {
    const next = !enabled
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ enabled: next }))
    window.dispatchEvent(new CustomEvent(APP_TOGGLE_EVENT, { detail: { enabled: next } }))
    setEnabled(next)
  }

  return (
    <div data-dsh-spider-app-tab="">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>蜘蛛侠应用（宠物 + 皮肤）</div>
      <div style={{ color: '#9aa4b2', fontSize: 12, marginBottom: 8 }}>
        {enabled ? '已开启：右下角宠物和红蓝皮肤主题生效' : '已关闭：宠物和皮肤主题均不显示'}
      </div>
      <button type="button" onClick={toggle}>{enabled ? '关闭' : '打开'}</button>
    </div>
  )
}
