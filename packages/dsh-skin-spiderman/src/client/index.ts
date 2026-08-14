import type { Context } from '@deepseek-ai/cordis'
import { mountFluid } from './fluid.ts'
import css from './spiderman.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

export function apply(ctx: Context): void {
  ctx.effect(() => {
    document.body.dataset.dshSpiderman = ''

    const chrome = document.createElement('div')
    chrome.dataset.dshSpidermanChrome = ''
    chrome.className = cls('chrome')
    document.body.appendChild(chrome)

    const disposers: Array<() => void> = []
    disposers.push(mountFluid(document.body))

    return () => {
      chrome.remove()
      delete document.body.dataset.dshSpiderman
      for (const dispose of disposers.splice(0)) dispose()
    }
  }, 'ui-skin-spiderman: theme')
}
