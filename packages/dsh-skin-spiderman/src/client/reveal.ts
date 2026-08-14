import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

/** The conversation column: css-modules class keeps the centerCol token. */
const CENTER_COL_SELECTOR = '[class*="centerCol"]'

export interface RevealImages {
  peter: string
  suit: string
}

const DYE_W = 120
const DYE_H = 160
const SPLAT_RADIUS = 11
const MAX_SPLATS = 40

/**
 * Fluid identity reveal rendered on a canvas: the suit is the base layer and a
 * low-resolution dye field follows the pointer, diffusing like ink and masking
 * in the Peter Parker layer. The dye is sticky while hovering the hero and
 * dissolves back to the suit when the pointer leaves.
 */
export function mountReveal(images: RevealImages): () => void {
  let wrap: HTMLDivElement | undefined
  let stage: HTMLDivElement | undefined
  let canvas: HTMLCanvasElement | undefined
  let center: HTMLElement | undefined
  const raised = new Map<HTMLElement, { position: string; zIndex: string }>()

  const suitImg = new Image()
  const peterImg = new Image()
  suitImg.src = images.suit
  peterImg.src = images.peter

  // low-res dye field
  const dye = new Float32Array(DYE_W * DYE_H)
  const splats: Array<{ x: number; y: number }> = []
  const fieldX = new Float32Array(12 * 16)
  const fieldY = new Float32Array(12 * 16)
  for (let i = 0; i < fieldX.length; i++) {
    const a = Math.random() * Math.PI * 2
    fieldX[i] = Math.cos(a)
    fieldY[i] = Math.sin(a)
  }

  let active = false
  let raf = 0
  let reducedMotion = false
  let dyeCanvas: HTMLCanvasElement | undefined
  let dyeCtx: CanvasRenderingContext2D | undefined
  let tmpCanvas: HTMLCanvasElement | undefined
  let tmpCtx: CanvasRenderingContext2D | undefined

  const readRect = (): { left: number; top: number; width: number; height: number } => {
    if (stage === undefined) return { left: 0, top: 0, width: 0, height: 0 }
    const r = stage.getBoundingClientRect()
    return { left: r.left, top: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height) }
  }

  const nearFigure = (clientX: number, clientY: number, stageRect: { left: number; top: number; width: number; height: number }): boolean => {
    const margin = Math.max(10, stageRect.height * 0.05)
    return clientX >= stageRect.left - margin
      && clientX <= stageRect.left + stageRect.width + margin
      && clientY >= stageRect.top - margin
      && clientY <= stageRect.top + stageRect.height + margin
  }

  const onMove = (event: PointerEvent): void => {
    if (stage === undefined) return
    const r = readRect()
    if (!nearFigure(event.clientX, event.clientY, r)) {
      active = false
      return
    }
    active = true
    const x = (event.clientX - r.left) / r.width * DYE_W
    const y = (event.clientY - r.top) / r.height * DYE_H
    splats.push({ x, y })
    if (splats.length > MAX_SPLATS) splats.splice(0, splats.length - MAX_SPLATS)
  }

  const splat = (x: number, y: number): void => {
    const r2 = SPLAT_RADIUS * SPLAT_RADIUS
    const x0 = Math.max(0, Math.floor(x - SPLAT_RADIUS))
    const x1 = Math.min(DYE_W - 1, Math.ceil(x + SPLAT_RADIUS))
    const y0 = Math.max(0, Math.floor(y - SPLAT_RADIUS))
    const y1 = Math.min(DYE_H - 1, Math.ceil(y + SPLAT_RADIUS))
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - x
        const dy = yy - y
        const d2 = dx * dx + dy * dy
        if (d2 <= r2) {
          const k = 1 - Math.sqrt(d2) / SPLAT_RADIUS
          const i = yy * DYE_W + xx
          dye[i] = Math.min(2.0, dye[i] + k * k * (1.8 + Math.random() * 0.3))
        }
      }
    }
  }

  const sampleField = (x: number, y: number, field: Float32Array, gw: number, gh: number): number => {
    const fx = Math.min(gw - 1.001, Math.max(0, x / DYE_W * gw))
    const fy = Math.min(gh - 1.001, Math.max(0, y / DYE_H * gh))
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const i = y0 * gw + x0
    const a = field[i]
    const b = field[i + 1]
    const c = field[i + gw]
    const d = field[i + gw + 1]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }

  const tick = (): void => {
    raf = requestAnimationFrame(tick)
    try {
      if (canvas === undefined || stage === undefined) return
      const ctx = canvas.getContext('2d')
      if (ctx === null) return
      if (!suitImg.complete || !peterImg.complete) return
      if (reducedMotion) {
        // Static suit backdrop for reduced-motion users; no fluid loop.
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(suitImg, 0, 0, canvas.width, canvas.height)
        return
      }
      if (dyeCanvas === undefined || dyeCtx === undefined || tmpCanvas === undefined || tmpCtx === undefined) return

      // Advect the dye along a noise field (slow swirl). While hovering the
      // dye is persistent so the swept area stays revealed; leaving dissolves
      // it back to the suit. Nearest sampling keeps the ink crisp.
      const next = new Float32Array(DYE_W * DYE_H)
      const decay = active ? 1 : 0.93
      for (let y = 1; y < DYE_H - 1; y++) {
        for (let x = 1; x < DYE_W - 1; x++) {
          const i = y * DYE_W + x
          const v = dye[i]
          if (v <= 0.003) continue
          const fx = sampleField(x, y, fieldX, 12, 16) * 0.9
          const fy = sampleField(x, y, fieldY, 12, 16) * 0.9
          const sx = Math.min(DYE_W - 2, Math.max(1, x + fx))
          const sy = Math.min(DYE_H - 2, Math.max(1, y + fy))
          next[i] = Math.max(0, Math.min(1, dye[Math.round(sy) * DYE_W + Math.round(sx)] * decay))
        }
      }
      dye.set(next)

      while (splats.length > 0) {
        const s = splats.shift()!
        splat(s.x, s.y)
      }

      // paint the dye field to the low-res canvas
      const imgData = dyeCtx.createImageData(DYE_W, DYE_H)
      const data = imgData.data
      for (let i = 0; i < dye.length; i++) {
        const a = Math.min(1, dye[i])
        data[i * 4] = 255
        data[i * 4 + 1] = 255
        data[i * 4 + 2] = 255
        data[i * 4 + 3] = Math.round(Math.min(1, a / 0.3) * 255)
      }
      dyeCtx.putImageData(imgData, 0, 0)

      // composite: suit base, then peter masked by the dye
      const w = canvas.width
      const h = canvas.height
      tmpCtx.clearRect(0, 0, w, h)
      tmpCtx.drawImage(peterImg, 0, 0, w, h)
      tmpCtx.globalCompositeOperation = 'destination-in'
      tmpCtx.imageSmoothingEnabled = true
      tmpCtx.drawImage(dyeCanvas, 0, 0, w, h)
      tmpCtx.globalCompositeOperation = 'source-over'

      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(suitImg, 0, 0, w, h)
      ctx.drawImage(tmpCanvas, 0, 0)
    } catch (err) {
      console.warn('[skin-spiderman] reveal tick error:', err)
    }
  }

  const resize = (): void => {
    if (canvas === undefined || stage === undefined) return
    const r = stage.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    canvas.style.width = `${Math.round(r.width)}px`
    canvas.style.height = `${Math.round(r.height)}px`
    dyeCanvas = document.createElement('canvas')
    dyeCanvas.width = DYE_W
    dyeCanvas.height = DYE_H
    dyeCtx = dyeCanvas.getContext('2d') ?? undefined
    tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = canvas.width
    tmpCanvas.height = canvas.height
    tmpCtx = tmpCanvas.getContext('2d') ?? undefined
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

    stage = document.createElement('div')
    stage.className = cls('stage')
    stage.dataset.dshStage = ''

    canvas = document.createElement('canvas')
    canvas.className = cls('canvas')
    canvas.setAttribute('aria-hidden', 'true')

    const suitEl = document.createElement('img')
    suitEl.className = cls('hiddenImg')
    suitEl.dataset.dshFigure = 'suit'
    suitEl.src = images.suit
    suitEl.alt = ''

    const peterEl = document.createElement('img')
    peterEl.className = cls('hiddenImg')
    peterEl.dataset.dshFigure = 'peter'
    peterEl.src = images.peter
    peterEl.alt = ''

    stage.append(canvas, suitEl, peterEl)
    wrap.append(glow, stage)
    center.prepend(wrap)

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

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', resize)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => resize())
      ro.observe(stage)
      ;(wrap as unknown as { __ro?: ResizeObserver }).__ro = ro
    }
    resize()
    raf = requestAnimationFrame(tick)
  }

  const observer = new MutationObserver(() => { ensure() })
  observer.observe(document.body, { childList: true, subtree: true })
  ensure()

  return () => {
    observer.disconnect()
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('resize', resize)
    const ro = (wrap as unknown as { __ro?: ResizeObserver } | undefined)?.__ro
    ro?.disconnect()
    wrap?.remove()
    wrap = undefined
    stage = undefined
    canvas = undefined
    for (const [el, original] of raised) {
      el.style.position = original.position
      el.style.zIndex = original.zIndex
    }
    raised.clear()
    center = undefined
  }
}
