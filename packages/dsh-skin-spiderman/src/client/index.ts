import type { Context } from '@deepseek-ai/cordis'
import { PETER_URL, SUIT_URL } from '../assets/reveal.ts'
import { SPIDER_MARK_URL } from '../assets/mark.ts'
import { SUIT_TEXTURE_URL } from '../assets/texture.ts'
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

/** Stable layout hooks used by the sidebar chrome (same convention as the
 *  fluid reveal's `[class*="centerCol"]`). */
const SIDEBAR_SELECTOR = '[class*="sidebarCol"]'
const REGION_SELECTOR = '[class*="_regionArea"]'
const FOOT_SELECTOR = '[class*="_footArea"]'

/** Suit-texture backdrop for the workspace column: texture on the bottom,
 *  dark scrim for text readability, red/blue ambient glows on top. */
const SIDEBAR_BACKDROP = [
  'radial-gradient(120% 70% at 50% 0%, rgba(217, 43, 58, 0.18), transparent 62%)',
  'radial-gradient(90% 50% at 100% 100%, rgba(59, 111, 212, 0.12), transparent 60%)',
  'linear-gradient(rgba(10, 6, 14, 0.8), rgba(10, 6, 14, 0.9))',
  `url(${SUIT_TEXTURE_URL})`,
].join(', ')

/**
 * Workspace chrome for the skin: suit-texture backdrop plus a comic kicker
 * ("SPIDER-MAN / WORKSPACE" with the spider emblem) above the session list
 * and a "Peter Parker · 在线" status row above the sidebar footer. Every
 * write is retracted on dispose.
 */
function mountSidebarChrome(): () => void {
  let mounted = false
  let cleanup: (() => void) | undefined
  const tryMount = (): void => {
    if (mounted) return
    const sidebar = document.querySelector<HTMLElement>(SIDEBAR_SELECTOR)
    const region = document.querySelector<HTMLElement>(REGION_SELECTOR)
    const foot = document.querySelector<HTMLElement>(FOOT_SELECTOR)
    if (sidebar === null || region === null || foot === null) return

    const previous = new Map<string, string>()
    for (const prop of ['background-image', 'background-size', 'background-repeat'] as const) {
      previous.set(prop, sidebar.style.getPropertyValue(prop))
    }
    sidebar.style.setProperty('background-image', SIDEBAR_BACKDROP)
    sidebar.style.setProperty('background-size', 'cover, cover, cover, cover')
    sidebar.style.setProperty('background-repeat', 'no-repeat, no-repeat, repeat, no-repeat')

    const kicker = document.createElement('div')
    kicker.className = cls('sidebarKicker')
    kicker.dataset.dshSidebarKicker = ''
    const mark = document.createElement('span')
    mark.className = cls('sidebarKickerMark')
    mark.style.backgroundImage = `url(${SPIDER_MARK_URL})`
    mark.setAttribute('aria-hidden', 'true')
    kicker.appendChild(mark)
    kicker.appendChild(document.createTextNode('Spider-Man / Workspace'))
    region.before(kicker)

    const status = document.createElement('div')
    status.className = cls('sidebarStatus')
    status.dataset.dshSidebarStatus = ''
    const dot = document.createElement('span')
    dot.className = cls('sidebarStatusDot')
    dot.setAttribute('aria-hidden', 'true')
    status.appendChild(dot)
    status.appendChild(document.createTextNode('Peter Parker · 在线'))
    foot.before(status)

    mounted = true
    cleanup = () => {
      kicker.remove()
      status.remove()
      for (const [prop, value] of previous) {
        if (value === '') sidebar.style.removeProperty(prop)
        else sidebar.style.setProperty(prop, value)
      }
    }
  }
  const observer = new MutationObserver(() => tryMount())
  observer.observe(document.body, { childList: true, subtree: true })
  tryMount()
  return () => {
    mounted = true
    observer.disconnect()
    cleanup?.()
  }
}

/** Spider-mark preview inside the spider-app settings card (the card mounts
 *  lazily when the settings dialog opens, so watch for it). */
const SETTINGS_ROW_SELECTOR = '[data-dsh-spider-pet-settings]'

function mountSettingsMark(): () => void {
  const marks = new Map<Element, HTMLElement>()
  const tryMount = (): void => {
    for (const row of document.querySelectorAll<HTMLElement>(SETTINGS_ROW_SELECTOR)) {
      if (marks.has(row)) continue
      const mark = document.createElement('span')
      mark.className = cls('settingsMark')
      mark.style.backgroundImage = `url(${SPIDER_MARK_URL})`
      mark.setAttribute('aria-hidden', 'true')
      row.prepend(mark)
      marks.set(row, mark)
    }
  }
  const observer = new MutationObserver(() => tryMount())
  observer.observe(document.body, { childList: true, subtree: true })
  tryMount()
  return () => {
    observer.disconnect()
    for (const mark of marks.values()) mark.remove()
    marks.clear()
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

        const web = document.createElement('div')
        web.dataset.dshSpidermanWeb = ''
        web.className = cls('web')
        const mark = document.createElement('div')
        mark.className = cls('webMark')
        mark.style.backgroundImage = `url(${SPIDER_MARK_URL})`
        web.appendChild(mark)
        document.body.appendChild(web)

        const disposers: Array<() => void> = []
        disposers.push(mountReveal({ peter: PETER_URL, suit: SUIT_URL }))
        disposers.push(mountSidebarChrome())
        disposers.push(mountSettingsMark())

        return () => {
          chrome.remove()
          web.remove()
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
