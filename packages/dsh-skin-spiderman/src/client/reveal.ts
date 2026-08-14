import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

export interface RevealImages {
  peter: string
  suit: string
}

export function mountReveal(root: HTMLElement, images: RevealImages): () => void {
  const wrap = document.createElement('div')
  wrap.className = cls('reveal')
  wrap.dataset.dshSpidermanReveal = ''

  const suit = document.createElement('img')
  suit.className = cls('layer') + ' ' + cls('suit')
  suit.src = images.suit
  suit.alt = ''
  const peter = document.createElement('img')
  peter.className = cls('layer') + ' ' + cls('peter')
  peter.src = images.peter
  peter.alt = ''
  wrap.append(suit, peter)
  root.appendChild(wrap)

  const onMove = (event: PointerEvent): void => {
    // Peter is revealed from the left as the pointer moves across the screen.
    const ratio = Math.min(1, Math.max(0, event.clientX / Math.max(1, window.innerWidth)))
    const hide = `${Math.round((1 - ratio) * 100)}% 0 0 0`
    peter.style.clipPath = `inset(0 0 0 ${hide})`
  }
  window.addEventListener('pointermove', onMove)

  return () => {
    window.removeEventListener('pointermove', onMove)
    wrap.remove()
  }
}
