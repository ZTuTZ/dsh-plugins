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
  const raised = new Map<HTMLElement, { position: string; zIndex: string }>()

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

    // Raise the real chat surfaces (message scroll area and composer seat)
    // above the background layer. The display:contents slot wrapper cannot
    // take z-index, so target the actual boxes inside it.
    const surfaces = center.querySelectorAll<HTMLElement>(
      '[data-conversation-scroll], [data-composer-seat]',
    )
    for (const surface of surfaces) {
      raised.set(surface, { position: surface.style.position, zIndex: surface.style.zIndex })
      surface.style.position = 'relative'
      surface.style.zIndex = '1'
    }
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
    for (const [el, original] of raised) {
      el.style.position = original.position
      el.style.zIndex = original.zIndex
    }
    raised.clear()
    center = undefined
    peter = undefined
  }
}
