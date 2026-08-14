export interface FluidOptions {
  particleCount?: number
}

export function mountFluid(root: HTMLElement, options: FluidOptions = {}): () => void {
  const reduced = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return () => undefined

  const canvas = document.createElement('canvas')
  canvas.dataset.dshSpidermanFluid = ''
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.zIndex = '1'
  canvas.style.pointerEvents = 'none'
  root.appendChild(canvas)

  const ctx2d = canvas.getContext('2d')
  if (ctx2d === null) {
    canvas.remove()
    return () => undefined
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let width = 0
  let height = 0
  const count = options.particleCount ?? 60
  const particles = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1 + Math.random() * 2,
    vx: (Math.random() - 0.5) * 0.0004,
    vy: (Math.random() - 0.5) * 0.0004,
  }))
  const mouse = { x: -1, y: -1 }

  const resize = (): void => {
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const onMove = (event: PointerEvent): void => {
    mouse.x = event.clientX
    mouse.y = event.clientY
  }

  let raf = 0
  const tick = (): void => {
    ctx2d.clearRect(0, 0, width, height)
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      const dx = (mouse.x / Math.max(1, width)) - p.x
      const dy = (mouse.y / Math.max(1, height)) - p.y
      p.x += dx * 0.002
      p.y += dy * 0.002
      const px = ((p.x % 1) + 1) % 1 * width
      const py = ((p.y % 1) + 1) % 1 * height
      ctx2d.beginPath()
      ctx2d.arc(px, py, p.r, 0, Math.PI * 2)
      ctx2d.fillStyle = 'rgba(217, 43, 58, 0.55)'
      ctx2d.fill()
    }
    raf = requestAnimationFrame(tick)
  }

  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onMove)
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onMove)
    canvas.remove()
  }
}
