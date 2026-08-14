import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

const CONVERSATION_PANE = '[data-pane="conversation"]'

export interface RevealImages {
  peter: string
  suit: string
}

export function mountReveal(images: RevealImages): () => void {
  let wrap: HTMLDivElement | undefined
  let peter: HTMLImageElement | undefined
  let pane: HTMLElement | undefined

  const onMove = (event: PointerEvent): void => {
    if (pane === undefined || peter === undefined) return
    const rect = pane.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const hide = `${Math.round((1 - ratio) * 100)}% 0 0 0`
    peter.style.clipPath = `inset(0 0 0 ${hide})`
  }

  const ensure = (): void => {
    if (wrap !== undefined) return
    const found = document.querySelector<HTMLElement>(CONVERSATION_PANE)
    if (found === null) return
    pane = found
    pane.style.position = 'relative'

    wrap = document.createElement('div')
    wrap.className = cls('reveal')
    wrap.dataset.dshSpidermanReveal = ''

    const suit = document.createElement('img')
    suit.className = cls('layer') + ' ' + cls('suit')
    suit.src = images.suit
    suit.alt = ''
    peter = document.createElement('img')
    peter.className = cls('layer') + ' ' + cls('peter')
    peter.src = images.peter
    peter.alt = ''
    wrap.append(suit, peter)
    pane.appendChild(wrap)
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
    pane = undefined
    peter = undefined
  }
}
