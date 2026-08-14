import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

export interface RevealImages {
  peter: string
  suit: string
}

export function mountReveal(images: RevealImages): () => void {
  let wrap: HTMLDivElement | undefined
  let peter: HTMLImageElement | undefined
  let root: HTMLElement | undefined

  const onMove = (event: PointerEvent): void => {
    if (root === undefined || peter === undefined) return
    const rect = root.getBoundingClientRect()
    if (rect.width <= 0) return
    // Reveal across the center area of the screen (the conversation column).
    const centerLeft = rect.left + rect.width * 0.22
    const ratio = Math.min(1, Math.max(0, (event.clientX - centerLeft) / (rect.width * 0.78)))
    const hide = `${Math.round((1 - ratio) * 100)}% 0 0 0`
    peter.style.clipPath = `inset(0 0 0 ${hide})`
  }

  const ensure = (): void => {
    if (wrap !== undefined) return
    root = document.body
    if (root === undefined) return

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
    root.appendChild(wrap)
    window.addEventListener('pointermove', onMove)
  }

  ensure()

  return () => {
    window.removeEventListener('pointermove', onMove)
    wrap?.remove()
    wrap = undefined
    root = undefined
    peter = undefined
  }
}
