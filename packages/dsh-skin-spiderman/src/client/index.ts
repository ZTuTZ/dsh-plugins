import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PETER_URL, SUIT_URL } from '../assets/reveal.ts'
import { mountReveal } from './reveal.ts'
import css from './spiderman.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

/** The skin obeys the spider-app master switch owned by dsh-spider-pet.
 *  settingsScope rides on the connection/remote services, so declare them. */
export const inject = ['connection', 'remote', 'settingsScope']

export function apply(ctx: Context): void {
  const settingsScope = ctx.settingsScope.bind<{ enabled?: boolean }>({ namespace: 'spider-pet' })
  let disposer: (() => void) | undefined
  const sync = (): void => {
    const scope = settingsScope.getSnapshot()
    const enabled = scope.status === 'ready' ? (scope.value?.enabled ?? true) : true
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
  settingsScope.subscribe(sync)
  sync()
}
