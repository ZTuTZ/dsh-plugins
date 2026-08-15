import type { Context } from '@deepseek-ai/cordis'
import { MARVEL_SKIN_EVENT, MARVEL_STORAGE_KEY, readMarvelSelections } from '../core/marvel.ts'
import type { HeroSkinContent } from '../core/theme.ts'
import { HERO_SKINS } from '../themes/spiderman.ts'
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

/**
 * Workspace chrome for the active skin hero: suit-texture backdrop plus a
 * comic kicker (with the hero emblem) above the session list and a
 * "«name» · 在线" status row above the sidebar footer. Every write is
 * retracted on dispose.
 */
function mountSidebarChrome(theme: HeroSkinContent): () => void {
  let mounted = false
  let cleanup: (() => void) | undefined
  const backdrop = [
    'radial-gradient(120% 70% at 50% 0%, rgba(217, 43, 58, 0.18), transparent 62%)',
    'radial-gradient(90% 50% at 100% 100%, rgba(59, 111, 212, 0.12), transparent 60%)',
    'linear-gradient(rgba(10, 6, 14, 0.8), rgba(10, 6, 14, 0.9))',
    `url(${theme.textureUrl})`,
  ].join(', ')
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
    sidebar.style.setProperty('background-image', backdrop)
    sidebar.style.setProperty('background-size', 'cover, cover, cover, cover')
    sidebar.style.setProperty('background-repeat', 'no-repeat, no-repeat, repeat, no-repeat')

    const kicker = document.createElement('div')
    kicker.className = cls('sidebarKicker')
    kicker.dataset.dshSidebarKicker = ''
    const mark = document.createElement('span')
    mark.className = cls('sidebarKickerMark')
    mark.style.backgroundImage = `url(${theme.markUrl})`
    mark.setAttribute('aria-hidden', 'true')
    kicker.appendChild(mark)
    kicker.appendChild(document.createTextNode(theme.kicker))
    region.before(kicker)

    const status = document.createElement('div')
    status.className = cls('sidebarStatus')
    status.dataset.dshSidebarStatus = ''
    const dot = document.createElement('span')
    dot.className = cls('sidebarStatusDot')
    dot.setAttribute('aria-hidden', 'true')
    status.appendChild(dot)
    status.appendChild(document.createTextNode(`${theme.statusName} · 在线`))
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

/** Hero-emblem preview inside the spider-app settings card (the card mounts
 *  lazily when the settings dialog opens, so watch for it). */
const SETTINGS_ROW_SELECTOR = '[data-dsh-spider-pet-settings]'

function mountSettingsMark(markUrl: string): () => void {
  const marks = new Map<Element, HTMLElement>()
  const tryMount = (): void => {
    for (const row of document.querySelectorAll<HTMLElement>(SETTINGS_ROW_SELECTOR)) {
      if (marks.has(row)) continue
      const mark = document.createElement('span')
      mark.className = cls('settingsMark')
      mark.style.backgroundImage = `url(${markUrl})`
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
  let activeSkinId = ''

  const sync = (): void => {
    const enabled = readAppEnabled()
    const theme = HERO_SKINS[readMarvelSelections(localStorage).skin] ?? HERO_SKINS.spiderman
    if (!enabled) {
      disposer?.()
      disposer = undefined
      activeSkinId = ''
      return
    }
    if (disposer !== undefined && activeSkinId === theme.id) return
    disposer?.()
    disposer = ctx.effect(() => {
      document.body.dataset.dshMarvelSkin = theme.id

      const chrome = document.createElement('div')
      chrome.dataset.dshSpidermanChrome = ''
      chrome.className = cls('chrome')
      document.body.appendChild(chrome)

      const web = document.createElement('div')
      web.dataset.dshSpidermanWeb = ''
      web.className = cls('web')
      const mark = document.createElement('div')
      mark.className = cls('webMark')
      mark.style.backgroundImage = `url(${theme.markUrl})`
      web.appendChild(mark)
      document.body.appendChild(web)

      const disposers: Array<() => void> = []
      disposers.push(mountReveal({ peter: theme.figures.reveal, suit: theme.figures.base }))
      disposers.push(mountSidebarChrome(theme))
      disposers.push(mountSettingsMark(theme.markUrl))

      return () => {
        chrome.remove()
        web.remove()
        delete document.body.dataset.dshMarvelSkin
        for (const dispose of disposers.splice(0)) dispose()
      }
    }, 'ui-skin-spiderman: theme')
    activeSkinId = theme.id
  }

  const onSkinChange = (event: Event): void => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id
    if (typeof id === 'string') sync()
  }
  window.addEventListener(MARVEL_SKIN_EVENT, onSkinChange)
  window.addEventListener(APP_TOGGLE_EVENT, () => sync())
  window.addEventListener('storage', (event) => {
    if (event.key === APP_STORAGE_KEY || event.key === MARVEL_STORAGE_KEY) sync()
  })
  sync()
}
