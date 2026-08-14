import type { Context } from '@deepseek-ai/cordis'
import { PETER_URL, SUIT_URL } from '../assets/reveal.ts'
import { mountFluid } from './fluid.ts'
import { mountReveal } from './reveal.ts'
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
    disposers.push(mountReveal({ peter: PETER_URL, suit: SUIT_URL }))

    return () => {
      chrome.remove()
      delete document.body.dataset.dshSpiderman
      for (const dispose of disposers.splice(0)) dispose()
    }
  }, 'ui-skin-spiderman: theme')
}
