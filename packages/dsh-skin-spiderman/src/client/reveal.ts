import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

/** The conversation column: css-modules class keeps the centerCol token. */
const CENTER_COL_SELECTOR = '[class*="centerCol"]'

export interface RevealImages {
  peter: string
  suit: string
}

interface Blob {
  x: number
  y: number
  r: number
}

const IDLE_MS = 1600
const SAMPLE_TTL_MS = 1800
const MAX_SAMPLES = 14

/**
 * Fluid identity reveal: the suit figure sits behind the conversation pane by
 * default. Moving the pointer paints soft "ink" blobs that trail the cursor
 * and reveal the Peter Parker figure underneath, then fades back to the suit
 * when the pointer rests or leaves the pane.
 */
export function mountReveal(images: RevealImages): () => void {
  let wrap: HTMLDivElement | undefined
  let suit: HTMLImageElement | undefined
  let peter: HTMLImageElement | undefined
  let center: HTMLElement | undefined
  const raised = new Map<HTMLElement, { position: string; zIndex: string }>()

  const target = { x: -9999, y: -9999, active: false }
  const main: Blob = { x: -9999, y: -9999, r: 0 }
  const trail: Blob = { x: -9999, y: -9999, r: 0 }
  const soft: Blob = { x: -9999, y: -9999, r: 0 }
  const wake: Array<{ x: number; y: number; t: number }> = []
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 }

  let rect = { left: 0, top: 0, width: 0, height: 0 }
  let lastMove = 0
  let raf = 0
  let reducedMotion = false

  const readRect = (): void => {
    if (center === undefined) return
    const r = center.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) rect = { left: r.left, top: r.top, width: r.width, height: r.height }
  }

  const onMove = (event: PointerEvent): void => {
    if (center === undefined || peter === undefined) return
    const inside = event.clientX >= rect.left
      && event.clientX <= rect.left + rect.width
      && event.clientY >= rect.top
      && event.clientY <= rect.top + rect.height
    if (!inside) {
      target.active = false
      return
    }
    target.active = true
    target.x = event.clientX - rect.left
    target.y = event.clientY - rect.top
    wake.push({ x: target.x, y: target.y, t: performance.now() })
    if (wake.length > MAX_SAMPLES) wake.splice(0, wake.length - MAX_SAMPLES)
    parallax.tx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(1, rect.width)
    parallax.ty = (event.clientY - (rect.top + rect.height / 2)) / Math.max(1, rect.height)
    lastMove = performance.now()
  }

  const applyMask = (now: number, radiusMain: number): void => {
    if (peter === undefined) return
    const layers: Array<[Blob, number]> = [
      [main, 1.0],
      [trail, 0.85],
      [soft, 0.7],
    ]
    const gradients = layers.map(([blob, strength]) =>
      `radial-gradient(circle ${Math.max(0, blob.r * strength)}px at ${blob.x}px ${blob.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 52%, rgba(0,0,0,0) 76%)`,
    ).join(', ')
    const wakeGradients = wake.map((s) => {
      const age = Math.min(1, (now - s.t) / SAMPLE_TTL_MS)
      const r = Math.max(0, radiusMain * (1 - age * 0.62))
      return `radial-gradient(circle ${r}px at ${s.x}px ${s.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 52%, rgba(0,0,0,0) 76%)`
    })
    const all = wakeGradients.length > 0
      ? wakeGradients.join(', ') + ', ' + gradients
      : gradients
    peter.style.maskImage = all
    peter.style.webkitMaskImage = all
  }

  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick)
    if (peter === undefined || suit === undefined || reducedMotion) return

    if (target.active && now - lastMove > IDLE_MS) target.active = false
    while (wake.length > 0 && now - wake[0].t > SAMPLE_TTL_MS) wake.shift()

    const speedMain = 0.16
    const speedTrail = 0.10
    const speedSoft = 0.06
    const radiusMain = Math.min(230, Math.max(110, rect.width * 0.2))
    const radiusTrail = radiusMain * 0.72
    const radiusSoft = radiusMain * 0.5

    const tx = target.active ? target.x : rect.left + rect.width + 120
    const ty = target.active ? target.y : rect.top + rect.height + 160
    const tr = target.active ? radiusMain : 0

    main.x = lerp(main.x, tx, speedMain)
    main.y = lerp(main.y, ty, speedMain)
    main.r = lerp(main.r, tr, speedMain)
    trail.x = lerp(trail.x, tx, speedTrail)
    trail.y = lerp(trail.y, ty, speedTrail)
    trail.r = lerp(trail.r, tr, speedTrail)
    soft.x = lerp(soft.x, tx, speedSoft)
    soft.y = lerp(soft.y, ty, speedSoft)
    soft.r = lerp(soft.r, tr, speedSoft)

    parallax.x = lerp(parallax.x, parallax.tx, 0.08)
    parallax.y = lerp(parallax.y, parallax.ty, 0.08)
    suit.style.transform = `translate3d(${Math.round(parallax.x * -14)}px, ${Math.round(parallax.y * -8)}px, 0) scale(1.04)`
    peter.style.transform = `translate3d(${Math.round(parallax.x * -6)}px, ${Math.round(parallax.y * -4)}px, 0)`

    applyMask(now, radiusMain)
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

    const glow = document.createElement('div')
    glow.className = cls('glow')
    glow.dataset.dshGlow = ''
    glow.setAttribute('aria-hidden', 'true')

    suit = document.createElement('img')
    suit.className = cls('figure') + ' ' + cls('suit')
    suit.dataset.dshFigure = 'suit'
    suit.src = images.suit
    suit.alt = ''
    suit.draggable = false

    peter = document.createElement('img')
    peter.className = cls('figure') + ' ' + cls('peter')
    peter.dataset.dshFigure = 'peter'
    peter.src = images.peter
    peter.alt = ''
    peter.draggable = false
    peter.style.maskImage = 'none'
    peter.style.webkitMaskImage = 'none'

    wrap.append(glow, suit, peter)
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

    reducedMotion = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-reduced-motion: reduce)').matches

    readRect()
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', readRect)
    if (!reducedMotion) {
      main.x = rect.left + rect.width + 120
      main.y = rect.top + rect.height + 160
      trail.x = main.x
      trail.y = main.y
      soft.x = main.x
      soft.y = main.y
      raf = requestAnimationFrame(tick)
    }
  }

  const observer = new MutationObserver(() => { ensure() })
  observer.observe(document.body, { childList: true, subtree: true })
  ensure()

  return () => {
    observer.disconnect()
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('resize', readRect)
    wrap?.remove()
    wrap = undefined
    suit = undefined
    peter = undefined
    for (const [el, original] of raised) {
      el.style.position = original.position
      el.style.zIndex = original.zIndex
    }
    raised.clear()
    center = undefined
  }
}
