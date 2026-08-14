import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

/** The conversation column: css-modules class keeps the centerCol token. */
const CENTER_COL_SELECTOR = '[class*="centerCol"]'

export interface RevealImages {
  peter: string
  suit: string
}

/**
 * Identity reveal driven by the reference site's WebGL stable-fluids solver,
 * ported to raw WebGL2 (no three.js): splat dye + velocity at the pointer,
 * then curl / vorticity / pressure / advection each frame. The dye masks the
 * Peter layer over the suit layer with a soft step.
 */

const VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const FRAG_PRE = 'precision highp float;\nprecision mediump sampler2D;\n'

const SPLAT_FRAG = `${FRAG_PRE}
uniform sampler2D uTarget;
uniform float aspectRatio, radius;
uniform vec3 color;
uniform vec2 point;
varying vec2 vUv;
void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.0);
}`

const ADVECTION_FRAG = `${FRAG_PRE}
uniform sampler2D uVelocity, uSource;
uniform vec2 texelSize;
uniform float dt, dissipation;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(dissipation * texture2D(uSource, vUv - dt * texture2D(uVelocity, vUv).xy * texelSize).rgb, 1.0);
}`

const DIVERGENCE_FRAG = `${FRAG_PRE}
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
vec2 vel(vec2 uv) {
  vec2 e = vec2(1.0);
  if (uv.x < 0.0) { uv.x = 0.0; e.x = -1.0; }
  if (uv.x > 1.0) { uv.x = 1.0; e.x = -1.0; }
  if (uv.y < 0.0) { uv.y = 0.0; e.y = -1.0; }
  if (uv.y > 1.0) { uv.y = 1.0; e.y = -1.0; }
  return e * texture2D(uVelocity, uv).xy;
}
void main() {
  vec2 L = vUv - vec2(texelSize.x, 0.0), R = vUv + vec2(texelSize.x, 0.0);
  vec2 T = vUv + vec2(0.0, texelSize.y), B = vUv - vec2(0.0, texelSize.y);
  gl_FragColor = vec4(0.5 * (vel(R).x - vel(L).x + vel(T).y - vel(B).y), 0.0, 0.0, 1.0);
}`

const CURL_FRAG = `${FRAG_PRE}
uniform sampler2D uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  vec2 L = vUv - vec2(texelSize.x, 0.0), R = vUv + vec2(texelSize.x, 0.0);
  vec2 T = vUv + vec2(0.0, texelSize.y), B = vUv - vec2(0.0, texelSize.y);
  gl_FragColor = vec4(
    texture2D(uVelocity, R).y - texture2D(uVelocity, L).y
    - texture2D(uVelocity, T).x + texture2D(uVelocity, B).x,
    0.0, 0.0, 1.0);
}`

const VORTICITY_FRAG = `${FRAG_PRE}
uniform sampler2D uVelocity, uCurl;
uniform vec2 texelSize;
uniform float curlStrength, dt;
varying vec2 vUv;
void main() {
  vec2 L = vUv - vec2(texelSize.x, 0.0), R = vUv + vec2(texelSize.x, 0.0);
  vec2 T = vUv + vec2(0.0, texelSize.y), B = vUv - vec2(0.0, texelSize.y);
  vec2 f = normalize(vec2(
    abs(texture2D(uCurl, T).x) - abs(texture2D(uCurl, B).x),
    abs(texture2D(uCurl, R).x) - abs(texture2D(uCurl, L).x)
  ) + 0.0001) * curlStrength * texture2D(uCurl, vUv).x;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy + f * dt, 0.0, 1.0);
}`

const PRESSURE_FRAG = `${FRAG_PRE}
uniform sampler2D uPressure, uDivergence;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  vec2 L = clamp(vUv - vec2(texelSize.x, 0.0), 0.0, 1.0);
  vec2 R = clamp(vUv + vec2(texelSize.x, 0.0), 0.0, 1.0);
  vec2 T = clamp(vUv + vec2(0.0, texelSize.y), 0.0, 1.0);
  vec2 B = clamp(vUv - vec2(0.0, texelSize.y), 0.0, 1.0);
  gl_FragColor = vec4(
    (texture2D(uPressure, L).x + texture2D(uPressure, R).x
      + texture2D(uPressure, T).x + texture2D(uPressure, B).x
      - texture2D(uDivergence, vUv).x) * 0.25,
    0.0, 0.0, 1.0);
}`

const GRADIENT_FRAG = `${FRAG_PRE}
uniform sampler2D uPressure, uVelocity;
uniform vec2 texelSize;
varying vec2 vUv;
void main() {
  float pL = texture2D(uPressure, clamp(vUv - vec2(texelSize.x, 0.0), 0.0, 1.0)).x;
  float pR = texture2D(uPressure, clamp(vUv + vec2(texelSize.x, 0.0), 0.0, 1.0)).x;
  float pT = texture2D(uPressure, clamp(vUv + vec2(0.0, texelSize.y), 0.0, 1.0)).x;
  float pB = texture2D(uPressure, clamp(vUv - vec2(0.0, texelSize.y), 0.0, 1.0)).x;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(pR - pL, pT - pB), 0.0, 1.0);
}`

const CLEAR_FRAG = `${FRAG_PRE}
uniform sampler2D uTexture;
uniform float value;
varying vec2 vUv;
void main() {
  gl_FragColor = value * texture2D(uTexture, vUv);
}`

const DISPLAY_FRAG = `${FRAG_PRE}
uniform sampler2D uTexture, uBaseImage, uRevealImage;
uniform float threshold, edgeSoftness, uSourceAspect, uViewportAspect;
varying vec2 vUv;
vec2 coverUv(vec2 uv) {
  float r = uViewportAspect / uSourceAspect;
  if (r > 1.0) uv.y = (uv.y - 0.5) / r + 0.5;
  else uv.x = (uv.x - 0.5) * r + 0.5;
  return uv;
}
void main() {
  float d = clamp(length(texture2D(uTexture, vUv).rgb), 0.0, 1.0);
  float a = edgeSoftness > 0.0
    ? smoothstep(threshold - edgeSoftness * 0.5, threshold + edgeSoftness * 0.5, d)
    : step(threshold, d);
  vec2 imageUv = coverUv(vUv);
  vec4 base = texture2D(uBaseImage, imageUv);
  vec4 reveal = texture2D(uRevealImage, imageUv);
  vec3 rgb = mix(base.rgb, reveal.rgb, a);
  float alpha = mix(base.a, reveal.a, a);
  gl_FragColor = vec4(rgb, alpha);
}`

interface Target {
  texture: WebGLTexture
  fbo: WebGLFramebuffer
}

const SIM_RES = 64
const DYE_RES = 256
const CURL = 40
const PRESSURE_ITERATIONS = 14
const VELOCITY_DISSIPATION = 0.95
const DYE_DISSIPATION = 0.94
const SPLAT_RADIUS = 0.28 / 100
const FORCE_STRENGTH = 7.5
const PRESSURE_DECAY = 0.75

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

  let gl: WebGL2RenderingContext | null = null
  let programs: Record<string, WebGLProgram> = {}
  let quadVao: WebGLVertexArrayObject | null = null
  let velocity: [Target, Target] | null = null
  let dye: [Target, Target] | null = null
  let curl: Target | null = null
  let divergence: Target | null = null
  let pressure: [Target, Target] | null = null
  let suitTex: WebGLTexture | null = null
  let peterTex: WebGLTexture | null = null
  let imagesReady = false

  const mouse = { x: 0, y: 0, vx: 0, vy: 0, moved: false }
  let lastPointer = { x: -1, y: -1 }
  let raf = 0
  let reducedMotion = false

  const stageRect = (): { left: number; top: number; width: number; height: number } => {
    if (stage === undefined) return { left: 0, top: 0, width: 1, height: 1 }
    const r = stage.getBoundingClientRect()
    return { left: r.left, top: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height) }
  }

  const nearStage = (clientX: number, clientY: number, r: { left: number; top: number; width: number; height: number }): boolean => {
    const margin = Math.max(10, r.height * 0.05)
    return clientX >= r.left - margin
      && clientX <= r.left + r.width + margin
      && clientY >= r.top - margin
      && clientY <= r.top + r.height + margin
  }

  const onMove = (event: PointerEvent): void => {
    if (canvas === undefined) return
    const r = stageRect()
    if (!nearStage(event.clientX, event.clientY, r)) {
      mouse.moved = false
      return
    }
    if (lastPointer.x >= 0) {
      mouse.vx = (event.clientX - lastPointer.x) * FORCE_STRENGTH
      mouse.vy = (event.clientY - lastPointer.y) * FORCE_STRENGTH
    } else {
      mouse.vx = 0
      mouse.vy = 0
    }
    lastPointer.x = event.clientX
    lastPointer.y = event.clientY
    mouse.x = (event.clientX - r.left) / r.width
    mouse.y = 1 - (event.clientY - r.top) / r.height
    mouse.moved = true
  }

  const compile = (type: number, src: string): WebGLShader => {
    const shader = gl!.createShader(type)!
    gl!.shaderSource(shader, src)
    gl!.compileShader(shader)
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      console.error('[skin-spiderman] shader error:', gl!.getShaderInfoLog(shader))
    }
    return shader
  }

  const makeProgram = (frag: string): WebGLProgram => {
    const prog = gl!.createProgram()!
    gl!.attachShader(prog, compile(gl!.VERTEX_SHADER, VERT))
    gl!.attachShader(prog, compile(gl!.FRAGMENT_SHADER, frag))
    gl!.linkProgram(prog)
    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
      console.error('[skin-spiderman] program error:', gl!.getProgramInfoLog(prog))
    }
    return prog
  }

  const createTarget = (w: number, h: number): Target => {
    const texture = gl!.createTexture()!
    gl!.bindTexture(gl!.TEXTURE_2D, texture)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE)
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA16F, w, h, 0, gl!.RGBA, gl!.HALF_FLOAT, null)
    const fbo = gl!.createFramebuffer()!
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo)
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0)
    return { texture, fbo }
  }

  const doubleTarget = (w: number, h: number): [Target, Target] => [createTarget(w, h), createTarget(w, h)]

  const bindTexture = (unit: number, texture: WebGLTexture | null, name: string, prog: WebGLProgram): void => {
    gl!.activeTexture(gl!.TEXTURE0 + unit)
    gl!.bindTexture(gl!.TEXTURE_2D, texture)
    gl!.uniform1i(gl!.getUniformLocation(prog, name), unit)
  }

  const pass = (prog: WebGLProgram, target: Target | null, setUniforms: () => void): void => {
    gl!.useProgram(prog)
    setUniforms()
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, target?.fbo ?? null)
    gl!.viewport(0, 0, target ? targetSize(target).w : canvas!.width, target ? targetSize(target).h : canvas!.height)
    gl!.bindVertexArray(quadVao)
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
  }

  const targetSizes = new Map<Target, { w: number; h: number }>()
  const rememberSize = (t: Target, w: number, h: number): void => { targetSizes.set(t, { w, h }) }
  const targetSize = (t: Target): { w: number; h: number } => targetSizes.get(t) ?? { w: 64, h: 64 }

  const initGL = (): boolean => {
    if (canvas === undefined) return false
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false })
    if (gl === null) {
      console.error('[skin-spiderman] WebGL2 unavailable')
      return false
    }
    if (gl.getExtension('EXT_color_buffer_float') === null) {
      console.error('[skin-spiderman] EXT_color_buffer_float unavailable')
      return false
    }

    programs = {
      splat: makeProgram(SPLAT_FRAG),
      advection: makeProgram(ADVECTION_FRAG),
      divergence: makeProgram(DIVERGENCE_FRAG),
      curl: makeProgram(CURL_FRAG),
      vorticity: makeProgram(VORTICITY_FRAG),
      pressure: makeProgram(PRESSURE_FRAG),
      gradient: makeProgram(GRADIENT_FRAG),
      clear: makeProgram(CLEAR_FRAG),
      display: makeProgram(DISPLAY_FRAG),
    }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    quadVao = gl.createVertexArray()
    gl.bindVertexArray(quadVao)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    velocity = doubleTarget(SIM_RES, SIM_RES)
    rememberSize(velocity[0], SIM_RES, SIM_RES)
    rememberSize(velocity[1], SIM_RES, SIM_RES)
    dye = doubleTarget(DYE_RES, DYE_RES)
    rememberSize(dye[0], DYE_RES, DYE_RES)
    rememberSize(dye[1], DYE_RES, DYE_RES)
    curl = createTarget(SIM_RES, SIM_RES)
    rememberSize(curl, SIM_RES, SIM_RES)
    divergence = createTarget(SIM_RES, SIM_RES)
    rememberSize(divergence, SIM_RES, SIM_RES)
    pressure = doubleTarget(SIM_RES, SIM_RES)
    rememberSize(pressure[0], SIM_RES, SIM_RES)
    rememberSize(pressure[1], SIM_RES, SIM_RES)

    suitTex = gl.createTexture()
    peterTex = gl.createTexture()
    return true
  }

  const loadTexture = (img: HTMLImageElement): WebGLTexture => {
    const tex = gl!.createTexture()!
    gl!.bindTexture(gl!.TEXTURE_2D, tex)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE)
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img)
    return tex
  }

  const splat = (x: number, y: number, vx: number, vy: number): void => {
    if (velocity === null || dye === null) return
    const prog = programs.splat
    gl!.useProgram(prog)
    gl!.uniform2f(gl!.getUniformLocation(prog, 'point'), x, y)
    gl!.uniform1f(gl!.getUniformLocation(prog, 'radius'), SPLAT_RADIUS)
    gl!.uniform1f(gl!.getUniformLocation(prog, 'aspectRatio'), SIM_RES / SIM_RES)
    // velocity
    gl!.uniform3f(gl!.getUniformLocation(prog, 'color'), vx, -vy, 0)
    bindTexture(0, velocity[0].texture, 'uTarget', prog)
    pass(prog, velocity[1], () => undefined)
    ;[velocity[0], velocity[1]] = [velocity[1], velocity[0]]
    // dye
    gl!.useProgram(prog)
    gl!.uniform3f(gl!.getUniformLocation(prog, 'color'), 3, 3, 3)
    bindTexture(0, dye[0].texture, 'uTarget', prog)
    pass(prog, dye[1], () => undefined)
    ;[dye[0], dye[1]] = [dye[1], dye[0]]
  }

  const simulate = (dt: number): void => {
    if (velocity === null || dye === null || curl === null || divergence === null || pressure === null) return
    const simTexel = { x: 1 / SIM_RES, y: 1 / SIM_RES }
    const dyeTexel = { x: 1 / DYE_RES, y: 1 / DYE_RES }

    const curlProg = programs.curl
    gl!.useProgram(curlProg)
    gl!.uniform2f(gl!.getUniformLocation(curlProg, 'texelSize'), simTexel.x, simTexel.y)
    bindTexture(0, velocity[0].texture, 'uVelocity', curlProg)
    pass(curlProg, curl, () => undefined)

    const vortProg = programs.vorticity
    gl!.useProgram(vortProg)
    gl!.uniform2f(gl!.getUniformLocation(vortProg, 'texelSize'), simTexel.x, simTexel.y)
    gl!.uniform1f(gl!.getUniformLocation(vortProg, 'curlStrength'), CURL)
    gl!.uniform1f(gl!.getUniformLocation(vortProg, 'dt'), dt)
    bindTexture(0, velocity[0].texture, 'uVelocity', vortProg)
    bindTexture(1, curl.texture, 'uCurl', vortProg)
    pass(vortProg, velocity[1], () => undefined)
    ;[velocity[0], velocity[1]] = [velocity[1], velocity[0]]

    const divProg = programs.divergence
    gl!.useProgram(divProg)
    gl!.uniform2f(gl!.getUniformLocation(divProg, 'texelSize'), simTexel.x, simTexel.y)
    bindTexture(0, velocity[0].texture, 'uVelocity', divProg)
    pass(divProg, divergence, () => undefined)

    const clearProg = programs.clear
    gl!.useProgram(clearProg)
    gl!.uniform1f(gl!.getUniformLocation(clearProg, 'value'), PRESSURE_DECAY)
    bindTexture(0, pressure[0].texture, 'uTexture', clearProg)
    pass(clearProg, pressure[1], () => undefined)
    ;[pressure[0], pressure[1]] = [pressure[1], pressure[0]]

    const presProg = programs.pressure
    gl!.useProgram(presProg)
    gl!.uniform2f(gl!.getUniformLocation(presProg, 'texelSize'), simTexel.x, simTexel.y)
    bindTexture(0, divergence.texture, 'uDivergence', presProg)
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl!.useProgram(presProg)
      bindTexture(1, pressure[0].texture, 'uPressure', presProg)
      pass(presProg, pressure[1], () => undefined)
      ;[pressure[0], pressure[1]] = [pressure[1], pressure[0]]
    }

    const gradProg = programs.gradient
    gl!.useProgram(gradProg)
    gl!.uniform2f(gl!.getUniformLocation(gradProg, 'texelSize'), simTexel.x, simTexel.y)
    bindTexture(0, pressure[0].texture, 'uPressure', gradProg)
    bindTexture(1, velocity[0].texture, 'uVelocity', gradProg)
    pass(gradProg, velocity[1], () => undefined)
    ;[velocity[0], velocity[1]] = [velocity[1], velocity[0]]

    const advProg = programs.advection
    gl!.useProgram(advProg)
    gl!.uniform2f(gl!.getUniformLocation(advProg, 'texelSize'), simTexel.x, simTexel.y)
    gl!.uniform1f(gl!.getUniformLocation(advProg, 'dt'), dt)
    gl!.uniform1f(gl!.getUniformLocation(advProg, 'dissipation'), VELOCITY_DISSIPATION)
    bindTexture(0, velocity[0].texture, 'uVelocity', advProg)
    bindTexture(1, velocity[0].texture, 'uSource', advProg)
    pass(advProg, velocity[1], () => undefined)
    ;[velocity[0], velocity[1]] = [velocity[1], velocity[0]]

    gl!.useProgram(advProg)
    gl!.uniform2f(gl!.getUniformLocation(advProg, 'texelSize'), dyeTexel.x, dyeTexel.y)
    gl!.uniform1f(gl!.getUniformLocation(advProg, 'dissipation'), DYE_DISSIPATION)
    bindTexture(0, velocity[0].texture, 'uVelocity', advProg)
    bindTexture(1, dye[0].texture, 'uSource', advProg)
    pass(advProg, dye[1], () => undefined)
    ;[dye[0], dye[1]] = [dye[1], dye[0]]
  }

  const render = (): void => {
    if (dye === null || suitTex === null || peterTex === null || canvas === undefined) return
    const prog = programs.display
    gl!.useProgram(prog)
    gl!.uniform1f(gl!.getUniformLocation(prog, 'threshold'), 1)
    gl!.uniform1f(gl!.getUniformLocation(prog, 'edgeSoftness'), 0)
    gl!.uniform1f(gl!.getUniformLocation(prog, 'uSourceAspect'), 1)
    gl!.uniform1f(gl!.getUniformLocation(prog, 'uViewportAspect'), canvas.width / canvas.height)
    bindTexture(0, dye[0].texture, 'uTexture', prog)
    bindTexture(1, suitTex, 'uBaseImage', prog)
    bindTexture(2, peterTex, 'uRevealImage', prog)
    pass(prog, null, () => undefined)
  }

  const tick = (): void => {
    raf = requestAnimationFrame(tick)
    if (canvas === undefined || gl === null) return
    if (!imagesReady) {
      if (suitImg.complete && peterImg.complete) {
        suitTex = loadTexture(suitImg)
        peterTex = loadTexture(peterImg)
        imagesReady = true
      } else {
        return
      }
    }
    if (reducedMotion) {
      render()
      return
    }
    const now = performance.now()
    const dt = Math.min((now - lastTime) / 1000, 0.016)
    lastTime = now
    if (mouse.moved) {
      splat(mouse.x, mouse.y, mouse.vx, mouse.vy)
      mouse.moved = false
    }
    simulate(dt)
    render()
  }
  let lastTime = performance.now()

  const resize = (): void => {
    if (canvas === undefined || stage === undefined) return
    const r = stage.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    canvas.style.width = `${Math.round(r.width)}px`
    canvas.style.height = `${Math.round(r.height)}px`
    if (gl !== null) {
      gl.viewport(0, 0, canvas.width, canvas.height)
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
    if (initGL()) raf = requestAnimationFrame(tick)
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
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    gl = null
    for (const [el, original] of raised) {
      el.style.position = original.position
      el.style.zIndex = original.zIndex
    }
    raised.clear()
    center = undefined
  }
}
