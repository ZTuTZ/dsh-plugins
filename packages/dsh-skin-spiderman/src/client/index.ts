import type { Context } from '@deepseek-ai/cordis'
import { PETER_URL, SUIT_URL } from '../assets/reveal.ts'
import { mountReveal } from './reveal.ts'
import css from './spiderman.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

/** Shared spider-app master switch (mirrors dsh-spider-pet's constants;
 *  cross-plugin value imports are forbidden by the client purity gate). */
const APP_STORAGE_KEY = 'dsh.spiderApp.v1'
const APP_TOGGLE_EVENT = 'dsh:spider-app-toggle'

function readAppEnabled(): boolean {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY)
    if (!raw) return true
    const parsed = JSON.parse(raw) as { enabled?: unknown }
    return parsed.enabled !== false
  } catch {
    return true
  }
}

export function apply(ctx: Context): void {
  let disposer: (() => void) | undefined
  const sync = (): void => {
    const enabled = readAppEnabled()
    if (enabled) {
      if (disposer !== undefined) return
      disposer = ctx.effect(() => {
        document.body.dataset.dshSpiderman = ''

        const chrome = document.createElement('div')
        chrome.dataset.dshSpidermanChrome = ''
        chrome.className = cls('chrome')
        document.body.appendChild(chrome)

        const disposers: Array<() => void> = []
        disposers.push(mountReveal({ peter: PETER_URL, suit: SUIT_URL }))

        return () => {
          chrome.remove()
          delete document.body.dataset.dshSpiderman
          for (const dispose of disposers.splice(0)) dispose()
        }
      }, 'ui-skin-spiderman: theme')
    } else {
      disposer?.()
      disposer = undefined
    }
  }
  const onToggle = (event: Event): void => {
    const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
    if (typeof enabled === 'boolean') sync()
  }
  window.addEventListener(APP_TOGGLE_EVENT, onToggle)
  window.addEventListener('storage', (event) => {
    if (event.key === APP_STORAGE_KEY) sync()
  })
  sync()
}
