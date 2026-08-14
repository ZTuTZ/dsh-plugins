import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

/** The conversation column: css-modules class keeps the centerCol token. */
const CENTER_COL_SELECTOR = '[class*="centerCol"]'

export interface RevealImages {
  peter: string
  suit: string
}

export function mountReveal(images: RevealImages): () => void {
  let wrap: HTMLDivElement | undefined
  let suit: HTMLImageElement | undefined
  let peter: HTMLImageElement | undefined
  let center: HTMLElement | undefined
  let viewRoot: HTMLElement | undefined
  let viewRootBackground: string | undefined

  const onMove = (event: PointerEvent): void => {
    if (center === undefined || peter === undefined) return
    const rect = center.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const hide = `${Math.round((1 - ratio) * 100)}% 0 0 0`
    peter.style.clipPath = `inset(0 0 0 ${hide})`
    if (suit !== undefined) {
      const shift = Math.round((ratio - 0.5) * -24)
      suit.style.transform = `translateX(${shift}px) scale(1.06)`
    }
  }

  const ensure = (): void => {
    if (wrap !== undefined) return
    const found = document.querySelector<HTMLElement>(CENTER_COL_SELECTOR)
    if (found === null) return
    center = found
    center.style.position = 'relative'

    // The conversation view root paints an opaque surface that would hide the
    // background art; make it transparent (bubbles keep their own surfaces).
    const scrollBody = center.querySelector<HTMLElement>('[data-conversation-scroll]')
    const root = scrollBody?.parentElement
    if (root !== undefined && root !== null) {
      viewRoot = root
      viewRootBackground = root.style.background
      root.style.background = 'transparent'
      root.style.position = 'relative'
      root.style.zIndex = '1'
    }

    wrap = document.createElement('div')
    wrap.className = cls('reveal')
    wrap.dataset.dshSpidermanReveal = ''

    suit = document.createElement('img')
    suit.className = cls('layer') + ' ' + cls('suit')
    suit.src = images.suit
    suit.alt = ''
    peter = document.createElement('img')
    peter.className = cls('layer') + ' ' + cls('peter')
    peter.src = images.peter
    peter.alt = ''
    wrap.append(suit, peter)
    center.prepend(wrap)
    window.addEventListener('pointermove', onMove)
  }

  const observer = new MutationObserver(() => { ensure() })
  observer.observe(document.body, { childList: true, subtree: true })
  ensure()

  return () => {
    observer.disconnect()
    window.removeEventListener('pointermove', onMove)
    wrap?.remove()
    wrap = undefined
    suit = undefined
    if (viewRoot !== undefined) {
      viewRoot.style.background = viewRootBackground ?? ''
      viewRoot.style.position = ''
      viewRoot.style.zIndex = ''
    }
    viewRoot = undefined
    viewRootBackground = undefined
    center = undefined
    peter = undefined
  }
}
