#!/usr/bin/env node
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const USAGE = `Usage: node verify-node.mjs --spec <spec.json> --url <preview url>
  [--figma <figma.png>] [--skeleton-url <url>] [--out <dir>] [--root <selector>]
  [--box-tolerance <px>] [--max-pixel-diff <percent>] [--executable <chromium path>]
  [--viewports 1280x720,1920x1080] [--responsive-url <url>]`

const parseArgs = (argv) => {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[arg.slice(2)] = true
    else {
      out[arg.slice(2)] = next
      i++
    }
  }
  return out
}

const loadChromium = () => {
  const projectRequire = createRequire(path.join(process.cwd(), 'package.json'))
  for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
    try {
      const mod = projectRequire(name)
      if (mod.chromium) return mod.chromium
    } catch {
      continue
    }
  }
  console.error(
    'Playwright not found in this project. Install it: npm i -D @playwright/test && npx playwright install chromium'
  )
  process.exit(2)
}

const installHelpers = () => {
  if (window.__fv) return
  const UNITLESS = new Set(['opacity', 'fontWeight', 'zIndex', 'flexGrow', 'flexShrink', 'order'])
  const RAW = new Set(['display', 'position', 'float', 'visibility'])
  const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  const sel =(id) => `[data-figma-node="${id}"]`
  const splitList = (s) => s.split(/,(?![^(]*\))/).map((p) => p.trim())
  const toMs = (s) => {
    const v = parseFloat(s)
    if (Number.isNaN(v)) return NaN
    return /ms$/.test(s.trim()) ? v : v * 1000
  }
  const probe = () => {
    let p = document.getElementById('__fv_probe')
    if (!p) {
      p = document.createElement('div')
      p.id = '__fv_probe'
      p.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0'
      document.body.appendChild(p)
    }
    return p
  }
  const norm = (prop, val) => {
    const p = probe()
    p.style[prop] = ''
    p.style[prop] = typeof val === 'number' && !UNITLESS.has(prop) ? val + 'px' : String(val)
    const out = getComputedStyle(p)[prop]
    p.style[prop] = ''
    return out
  }
  const num = (prop, s) => {
    if (s === 'normal') return prop === 'letterSpacing' ? 0 : NaN
    const m = /^-?\d*\.?\d+/.exec(String(s))
    return m ? parseFloat(m[0]) : NaN
  }
  const matrixOf = (t) => {
    if (!t || t === 'none') return [1, 0, 0, 1, 0, 0]
    const computed = /^matrix/.test(t) ? t : norm('transform', t)
    if (computed === 'none') return [1, 0, 0, 1, 0, 0]
    const nums = computed.match(/-?\d*\.?\d+(e-?\d+)?/g).map(Number)
    if (nums.length === 6) return nums
    return [nums[0], nums[1], nums[4], nums[5], nums[12], nums[13]]
  }
  const sameMatrix = (a, b) =>
    a.every((v, i) => Math.abs(v - b[i]) <= (i < 4 ? 0.01 : 2))

  const checkStyles = (nodeId, styles, prefix, tolPx) => {
    const fails = []
    const el = document.querySelector(sel(nodeId))
    if (!el) return [{ figmaNode: nodeId, property: prefix + 'element', expected: 'present', actual: 'not found' }]
    const cs = getComputedStyle(el)
    for (const [prop, expected] of Object.entries(styles)) {
      const actual = cs[prop]
      let ok
      if (prop === 'fontFamily') {
        const first = String(actual).split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()
        ok = first === String(expected).toLowerCase()
      } else if (typeof expected === 'number') {
        const tol = UNITLESS.has(prop) ? 0.001 : prop === 'letterSpacing' ? 0.05 : tolPx
        ok = Math.abs(num(prop, actual) - expected) <= tol
      } else if (prop === 'transform') {
        ok = sameMatrix(matrixOf(actual), matrixOf(expected))
      } else {
        ok = RAW.has(prop) ? actual === String(expected) : actual === norm(prop, expected)
      }
      if (!ok) fails.push({ figmaNode: nodeId, property: prefix + kebab(prop), expected, actual })
    }
    return fails
  }

  const checkBoxes = (rootSel, rootId, elements, frame, tolBox) => {
    const fails = []
    const root = document.querySelector(rootSel)
    if (!root) return { fails: [{ figmaNode: rootId, property: 'root', expected: rootSel, actual: 'not found' }], rootBox: null }
    const rb = root.getBoundingClientRect()
    if (frame) {
      for (const [key, actual] of [['width', rb.width], ['height', rb.height]]) {
        if (typeof frame[key] === 'number' && Math.abs(actual - frame[key]) > tolBox)
          fails.push({ figmaNode: rootId, property: 'frame.' + key, expected: frame[key], actual: Math.round(actual * 100) / 100 })
      }
    }
    for (const item of elements) {
      if (!item.box) continue
      const el = document.querySelector(sel(item.figmaNode))
      if (!el) {
        fails.push({ figmaNode: item.figmaNode, property: 'element', expected: 'present', actual: 'not found' })
        continue
      }
      const r = el.getBoundingClientRect()
      const actual = { x: r.left - rb.left, y: r.top - rb.top, w: r.width, h: r.height }
      for (const key of ['x', 'y', 'w', 'h']) {
        if (typeof item.box[key] !== 'number') continue
        if (Math.abs(actual[key] - item.box[key]) > tolBox)
          fails.push({ figmaNode: item.figmaNode, property: 'box.' + key, expected: item.box[key], actual: Math.round(actual[key] * 100) / 100 })
      }
    }
    return { fails, rootBox: { w: rb.width, h: rb.height } }
  }

  const checkLayout = (rootSel, rootId, layout, tolPx) => {
    const fails = []
    const root = document.querySelector(rootSel)
    if (!root || !layout) return fails
    const cs = getComputedStyle(root)
    const push = (property, expected, actual) => fails.push({ figmaNode: rootId, property: 'layout.' + property, expected, actual })
    if (layout.display && cs.display !== layout.display) push('display', layout.display, cs.display)
    if (layout.direction && cs.flexDirection !== layout.direction) push('direction', layout.direction, cs.flexDirection)
    if (typeof layout.gap === 'number') {
      const actual = layout.direction === 'row' ? cs.columnGap : cs.rowGap
      if (Math.abs(num('gap', actual) - layout.gap) > tolPx) push('gap', layout.gap, actual)
    }
    if (Array.isArray(layout.padding)) {
      const sides = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
      sides.forEach((side, i) => {
        if (Math.abs(num(side, cs[side]) - layout.padding[i]) > tolPx) push(kebab(side), layout.padding[i], cs[side])
      })
    }
    for (const key of ['alignItems', 'justifyContent', 'flexWrap']) {
      if (layout[key] && cs[key] !== norm(key, layout[key])) push(kebab(key), layout[key], cs[key])
    }
    return fails
  }

  const snapshot = () => {
    const out = {}
    for (const a of document.getAnimations()) {
      const target = a.effect && a.effect.target
      if (!target || !target.closest) continue
      const holder = target.closest('[data-figma-node]')
      if (!holder) continue
      const id = holder.getAttribute('data-figma-node')
      const t = a.effect.getComputedTiming()
      const frames = a.effect.getKeyframes().map((k) => ({
        offset: k.computedOffset,
        opacity: k.opacity,
        transform: k.transform,
        easing: k.easing,
      }))
      out[id] = out[id] || []
      out[id].push({
        duration: typeof t.duration === 'number' ? t.duration : NaN,
        delay: t.delay,
        iterations: t.iterations === Infinity ? 'infinite' : t.iterations,
        easing: t.easing,
        keyframes: frames,
      })
    }
    return out
  }

  const compareKeyframes = (nodeId, expected, actual, fails) => {
    for (const kf of expected) {
      const match = actual.find((k) => Math.abs((k.offset ?? 0) - kf.offset) < 0.001)
      if (!match) {
        fails.push({ figmaNode: nodeId, property: `motion.keyframes[${kf.offset}]`, expected: 'present', actual: 'missing' })
        continue
      }
      if (typeof kf.opacity === 'number' && Math.abs(parseFloat(match.opacity) - kf.opacity) > 0.05)
        fails.push({ figmaNode: nodeId, property: `motion.keyframes[${kf.offset}].opacity`, expected: kf.opacity, actual: match.opacity })
      if (kf.transform !== undefined && !sameMatrix(matrixOf(match.transform), matrixOf(kf.transform)))
        fails.push({ figmaNode: nodeId, property: `motion.keyframes[${kf.offset}].transform`, expected: kf.transform, actual: match.transform })
    }
  }

  const checkMotion = (motion, mountSnap) => {
    const fails = []
    const warnings = []
    const live = snapshot()
    for (const m of motion) {
      const id = m.figmaNode
      const el = document.querySelector(sel(id))
      if (!el) {
        fails.push({ figmaNode: id, property: 'motion.element', expected: 'present', actual: 'not found' })
        continue
      }
      const cs = getComputedStyle(el)
      if (m.kind === 'js') {
        warnings.push({ figmaNode: id, message: 'JS-driven animation: timing not verifiable by script; final state covered by the numeric gate' })
        continue
      }
      if (m.kind === 'transition') {
        const props = splitList(cs.transitionProperty)
        const durs = splitList(cs.transitionDuration).map(toMs)
        const delays = splitList(cs.transitionDelay).map(toMs)
        const eases = splitList(cs.transitionTimingFunction)
        const at = (list, i) => list[i % list.length]
        for (const p of m.properties || ['all']) {
          let i = props.indexOf(p)
          if (i === -1) i = props.indexOf('all')
          if (i === -1 || at(durs, i) === 0) {
            fails.push({ figmaNode: id, property: `motion.transition[${p}]`, expected: `${m.duration}ms`, actual: 'no transition on this property' })
            continue
          }
          if (typeof m.duration === 'number' && Math.abs(at(durs, i) - m.duration) > 1)
            fails.push({ figmaNode: id, property: `motion.transition[${p}].duration`, expected: m.duration, actual: at(durs, i) })
          if (typeof m.delay === 'number' && Math.abs(at(delays, i) - m.delay) > 1)
            fails.push({ figmaNode: id, property: `motion.transition[${p}].delay`, expected: m.delay, actual: at(delays, i) })
          if (m.easing && at(eases, i) !== norm('transitionTimingFunction', m.easing))
            fails.push({ figmaNode: id, property: `motion.transition[${p}].easing`, expected: m.easing, actual: at(eases, i) })
        }
        continue
      }
      const hasCss = cs.animationName && cs.animationName !== 'none'
      const snaps = live[id] || mountSnap[id] || []
      if (hasCss) {
        const dur = toMs(splitList(cs.animationDuration)[0])
        const delay = toMs(splitList(cs.animationDelay)[0])
        const ease = splitList(cs.animationTimingFunction)[0]
        const iter = splitList(cs.animationIterationCount)[0]
        if (typeof m.duration === 'number' && Math.abs(dur - m.duration) > 1)
          fails.push({ figmaNode: id, property: 'motion.duration', expected: m.duration, actual: dur })
        if (typeof m.delay === 'number' && Math.abs(delay - m.delay) > 1)
          fails.push({ figmaNode: id, property: 'motion.delay', expected: m.delay, actual: delay })
        if (m.easing && ease !== norm('animationTimingFunction', m.easing))
          fails.push({ figmaNode: id, property: 'motion.easing', expected: m.easing, actual: ease })
        if (m.iterations !== undefined && String(m.iterations) !== iter)
          fails.push({ figmaNode: id, property: 'motion.iterations', expected: m.iterations, actual: iter })
      } else if (snaps.length) {
        const s = snaps[0]
        if (typeof m.duration === 'number' && Math.abs(s.duration - m.duration) > 1)
          fails.push({ figmaNode: id, property: 'motion.duration', expected: m.duration, actual: s.duration })
        if (typeof m.delay === 'number' && Math.abs(s.delay - m.delay) > 1)
          fails.push({ figmaNode: id, property: 'motion.delay', expected: m.delay, actual: s.delay })
        if (m.iterations !== undefined && String(m.iterations) !== String(s.iterations))
          fails.push({ figmaNode: id, property: 'motion.iterations', expected: m.iterations, actual: s.iterations })
      } else {
        fails.push({ figmaNode: id, property: 'motion', expected: `${m.kind} ${m.duration}ms`, actual: 'no animation' })
        continue
      }
      if (Array.isArray(m.keyframes)) {
        if (snaps.length) compareKeyframes(id, m.keyframes, snaps[0].keyframes, fails)
        else warnings.push({ figmaNode: id, message: 'keyframes not readable (animation already finished and removed); timing verified from computed style only' })
      }
    }
    return { fails, warnings }
  }

  const settle = async () => {
    await document.fonts.ready
    const pending = document.getAnimations().map((a) => {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null
      if (t && t.iterations === Infinity) return null
      return a.finished.catch(() => undefined)
    })
    await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 8000))])
  }

  const checkResponsive = (r, tolBox) => {
    const fails = []
    const tol = typeof r.tolerance === 'number' ? r.tolerance : tolBox
    const vw = window.innerWidth
    const vh = window.innerHeight
    const doc = document.scrollingElement || document.documentElement
    const push = (figmaNode, property, expected, actual) => fails.push({ figmaNode, property, expected, actual })
    const round = (n) => Math.round(n * 100) / 100
    const rect = (id) => {
      if (!id || id === 'viewport') return { left: 0, top: 0, right: vw, bottom: vh, width: vw, height: vh }
      const el = document.querySelector(sel(id))
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }
    }
    const stacked = typeof r.stackBelow === 'number' && vw < r.stackBelow
    const tooShort = typeof r.minHeight === 'number' && vh < r.minHeight

    if (doc.scrollWidth > vw + 1) push(null, 'horizontal-overflow', `<= ${vw}`, doc.scrollWidth)
    if (r.singleScreen && !stacked && !tooShort && doc.scrollHeight > vh + 1)
      push(null, 'vertical-scroll', `<= ${vh}`, doc.scrollHeight)

    for (const id of r.mustRemain || []) {
      const rc = rect(id)
      if (!rc || rc.width === 0 || rc.height === 0) {
        push(id, 'visible', 'rendered', rc ? 'zero size' : 'not found')
        continue
      }
      if (rc.left < -tol || rc.right > vw + tol) push(id, 'clipped-x', `within 0..${vw}`, `${round(rc.left)}..${round(rc.right)}`)
      if (r.singleScreen && !stacked && !tooShort && (rc.top < -tol || rc.bottom > vh + tol))
        push(id, 'clipped-y', `within 0..${vh}`, `${round(rc.top)}..${round(rc.bottom)}`)
    }
    if (stacked) return fails

    for (const a of r.anchors || []) {
      const rc = rect(a.figmaNode)
      const within = rect(a.within)
      if (!rc || !within) {
        push(a.figmaNode, 'anchor', 'element present', 'not found')
        continue
      }
      const actual = {
        left: rc.left - within.left,
        top: rc.top - within.top,
        right: within.right - rc.right,
        bottom: within.bottom - rc.bottom,
      }
      for (const [edge, expected] of Object.entries(a.edges || {})) {
        const span = edge === 'left' || edge === 'right' ? within.width : within.height
        let target = expected
        if (typeof expected === 'string') {
          const m = /^(-?[\d.]+)%\s*(?:([+-])\s*([\d.]+)(?:px)?)?$/.exec(expected.trim())
          target = m ? (parseFloat(m[1]) / 100) * span + (m[2] ? (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) : 0) : parseFloat(expected)
        }
        if (Math.abs(actual[edge] - target) > tol) push(a.figmaNode, `anchor.${edge}`, expected, round(actual[edge]))
      }
    }

    for (const c of r.centered || []) {
      const rc = rect(c.figmaNode)
      const within = rect(c.within)
      if (!rc || !within) {
        push(c.figmaNode, 'centered', 'element present', 'not found')
        continue
      }
      const offset = c.offset || 0
      const delta =
        c.axis === 'y'
          ? (rc.top + rc.bottom) / 2 - (within.top + within.bottom) / 2
          : (rc.left + rc.right) / 2 - (within.left + within.right) / 2
      if (Math.abs(delta - offset) > tol) push(c.figmaNode, `centered.${c.axis || 'x'}`, offset, round(delta))
    }

    for (const f of r.fractions || []) {
      const rc = rect(f.figmaNode)
      const within = rect(f.of)
      if (!rc || !within) {
        push(f.figmaNode, 'fraction', 'element present', 'not found')
        continue
      }
      const axis = f.axis === 'height' ? 'height' : 'width'
      const actual = rc[axis] / within[axis]
      if (Math.abs(actual - f.value) > 0.01) push(f.figmaNode, `fraction.${axis}`, f.value, Math.round(actual * 1000) / 1000)
    }

    for (const [a, b] of r.noOverlap || []) {
      const ra = rect(a)
      const rb = rect(b)
      if (!ra || !rb) continue
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
      if (w > 1 && h > 1) push(a, 'overlap', `no overlap with ${b}`, `${round(w)}x${round(h)}`)
    }
    return fails
  }

  document.addEventListener(
    'click',
    (e) => {
      const link = e.target && e.target.closest && e.target.closest('a[href]')
      if (link) e.preventDefault()
    },
    true
  )
  document.addEventListener('submit', (e) => e.preventDefault(), true)

  window.__fv = { checkStyles, checkBoxes, checkLayout, checkMotion, checkResponsive, snapshot, settle }
}

const prepare = async (page, rootSel) => {
  await page.waitForSelector(rootSel, { state: 'visible', timeout: 15000 }).catch(() => undefined)
  await page.evaluate(installHelpers)
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined)
}

const parseViewports = (value) => {
  if (!value) return null
  if (Array.isArray(value))
    return value.map((v) => (Array.isArray(v) ? { width: v[0], height: v[1] } : { width: v.width, height: v.height }))
  return String(value)
    .split(',')
    .map((part) => part.trim().split('x').map(Number))
    .filter(([w, h]) => w > 0 && h > 0)
    .map(([width, height]) => ({ width, height }))
}

const comparePngs = async (context, implPath, figmaPath) => {
  const page = await context.newPage()
  await page.goto('about:blank')
  const toUrl = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')
  const result = await page.evaluate(
    async ({ a, b }) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error('image load failed'))
          img.src = src
        })
      const [ia, ib] = await Promise.all([load(a), load(b)])
      const size = { impl: [ia.width, ia.height], figma: [ib.width, ib.height] }
      if (ia.width !== ib.width || ia.height !== ib.height) return { size, mismatch: true }
      const data = (img) => {
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0)
        return ctx.getImageData(0, 0, img.width, img.height)
      }
      const da = data(ia)
      const db = data(ib)
      const out = document.createElement('canvas')
      out.width = ia.width
      out.height = ia.height
      const octx = out.getContext('2d')
      const od = octx.createImageData(ia.width, ia.height)
      let diff = 0
      for (let i = 0; i < da.data.length; i += 4) {
        const delta = Math.max(
          Math.abs(da.data[i] - db.data[i]),
          Math.abs(da.data[i + 1] - db.data[i + 1]),
          Math.abs(da.data[i + 2] - db.data[i + 2]),
          Math.abs(da.data[i + 3] - db.data[i + 3])
        )
        const changed = delta > 26
        if (changed) diff++
        const grey = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3
        od.data[i] = changed ? 255 : 255 - (255 - grey) * 0.2
        od.data[i + 1] = changed ? 0 : 255 - (255 - grey) * 0.2
        od.data[i + 2] = changed ? 80 : 255 - (255 - grey) * 0.2
        od.data[i + 3] = 255
      }
      octx.putImageData(od, 0, 0)
      return { size, mismatch: false, percent: (100 * diff) / (ia.width * ia.height), png: out.toDataURL('image/png') }
    },
    { a: toUrl(implPath), b: toUrl(figmaPath) }
  )
  await page.close()
  return result
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.spec || !args.url) {
    console.error(USAGE)
    process.exit(2)
  }
  const spec = JSON.parse(fs.readFileSync(args.spec, 'utf8'))
  const outDir = args.out || path.dirname(args.spec)
  fs.mkdirSync(outDir, { recursive: true })
  const rootSel = args.root || `[data-figma-node="${spec.nodeId}"]`
  const tolBox = Number(args['box-tolerance'] ?? 1)
  const tolPx = 0.5
  const frame = spec.frame || {}
  const scale = frame.screenshotScale || 1
  const viewport = { width: Math.ceil(frame.width || 1280), height: Math.max(Math.ceil(frame.height || 0), 600) }
  const elements = spec.elements || []
  const motion = spec.motion || []
  const failures = []
  const warnings = []

  const chromium = loadChromium()
  const browser = await chromium.launch(args.executable ? { executablePath: args.executable } : {})
  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale })
    const page = await context.newPage()
    await page.goto(args.url, { waitUntil: 'domcontentloaded' })
    await prepare(page, rootSel)

    const mountSnap = {}
    for (const wait of [0, 40, 120, 250]) {
      if (wait) await page.waitForTimeout(wait)
      const snap = await page.evaluate(() => window.__fv.snapshot())
      for (const [id, list] of Object.entries(snap)) if (!mountSnap[id]) mountSnap[id] = list
    }

    await page.waitForLoadState('load')
    await page.evaluate(() => window.__fv.settle())

    const boxes = await page.evaluate(
      ({ rootSel, rootId, elements, frame, tolBox }) => window.__fv.checkBoxes(rootSel, rootId, elements, frame, tolBox),
      { rootSel, rootId: spec.nodeId, elements, frame, tolBox }
    )
    failures.push(...boxes.fails)

    if (boxes.rootBox) {
      failures.push(
        ...(await page.evaluate(
          ({ rootSel, rootId, layout, tolPx }) => window.__fv.checkLayout(rootSel, rootId, layout, tolPx),
          { rootSel, rootId: spec.nodeId, layout: spec.layout || null, tolPx }
        ))
      )
      for (const item of elements) {
        if (!item.style) continue
        const fails = await page.evaluate(
          ({ id, styles, tolPx }) => window.__fv.checkStyles(id, styles, '', tolPx),
          { id: item.figmaNode, styles: item.style, tolPx }
        )
        failures.push(...fails.filter((f) => f.property !== 'element'))
      }

      if (motion.length) {
        const res = await page.evaluate(({ motion, mountSnap }) => window.__fv.checkMotion(motion, mountSnap), { motion, mountSnap })
        failures.push(...res.fails)
        warnings.push(...res.warnings)
      }

      for (const [state, nodes] of Object.entries(spec.states || {})) {
        for (const [nodeId, styles] of Object.entries(nodes)) {
          const loc = page.locator(`[data-figma-node="${nodeId}"]`).first()
          if ((await loc.count()) === 0) {
            failures.push({ figmaNode: nodeId, property: `state.${state}.element`, expected: 'present', actual: 'not found' })
            continue
          }
          const pressed = state === 'active' || state === 'pressed'
          if (state === 'hover') await loc.hover()
          else if (state === 'focus') await loc.focus()
          else if (pressed) {
            await loc.hover()
            await page.mouse.down()
          } else {
            warnings.push({ figmaNode: nodeId, message: `state "${state}" cannot be triggered by script; verify it through a preview ?state= with its own spec` })
            continue
          }
          await page.evaluate(() => window.__fv.settle())
          failures.push(
            ...(await page.evaluate(
              ({ id, styles, prefix, tolPx }) => window.__fv.checkStyles(id, styles, prefix, tolPx),
              { id: nodeId, styles, prefix: `state.${state}.`, tolPx }
            ))
          )
          if (pressed) await page.mouse.up()
          await page.mouse.move(0, 0)
          await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur())
          await page.evaluate(() => window.__fv.settle())
        }
      }

      const implPath = path.join(outDir, 'impl.png')
      await page.locator(rootSel).first().screenshot({ path: implPath, animations: 'disabled' })
      let pixelDiff = null
      if (args.figma) {
        const cmp = await comparePngs(context, implPath, args.figma)
        if (cmp.mismatch) {
          failures.push({ figmaNode: spec.nodeId, property: 'screenshot.size', expected: cmp.size.figma.join('x'), actual: cmp.size.impl.join('x') })
        } else {
          pixelDiff = Math.round(cmp.percent * 100) / 100
          fs.writeFileSync(path.join(outDir, 'diff.png'), Buffer.from(cmp.png.split(',')[1], 'base64'))
          const max = args['max-pixel-diff'] !== undefined ? Number(args['max-pixel-diff']) : null
          if (max !== null && pixelDiff > max)
            failures.push({ figmaNode: spec.nodeId, property: 'pixelDiff', expected: `<= ${max}%`, actual: `${pixelDiff}%` })
        }
      }

      if (args['skeleton-url']) {
        const sk = await context.newPage()
        await sk.goto(args['skeleton-url'], { waitUntil: 'load' })
        await sk.waitForSelector(`[data-figma-skeleton], ${rootSel}`, { state: 'visible', timeout: 15000 }).catch(() => undefined)
        const box = await sk.evaluate((rootSel) => {
          const el = document.querySelector('[data-figma-skeleton]') || document.querySelector(rootSel)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { w: r.width, h: r.height }
        }, rootSel)
        if (!box) failures.push({ figmaNode: spec.nodeId, property: 'skeleton', expected: 'present', actual: 'not found' })
        else
          for (const key of ['w', 'h'])
            if (Math.abs(box[key] - boxes.rootBox[key]) > tolBox)
              failures.push({ figmaNode: spec.nodeId, property: `skeleton.${key}`, expected: boxes.rootBox[key], actual: box[key] })
        await sk.close()
      }

      if (motion.length) {
        const reduced = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: 'reduce' })
        const rp = await reduced.newPage()
        await rp.goto(args.url, { waitUntil: 'load' })
        await prepare(rp, rootSel)
        await rp.evaluate(() => window.__fv.settle())
        const res = await rp.evaluate(
          ({ rootSel, rootId, elements, frame, tolBox }) => window.__fv.checkBoxes(rootSel, rootId, elements, frame, tolBox),
          { rootSel, rootId: spec.nodeId, elements, frame, tolBox }
        )
        const known = new Set(failures.map((f) => `${f.figmaNode}|${f.property}`))
        failures.push(
          ...res.fails
            .filter((f) => !known.has(`${f.figmaNode}|${f.property}`))
            .map((f) => ({ ...f, property: 'reduced-motion.' + f.property }))
        )
        await reduced.close()
      }

      const responsive = spec.responsive || null
      const viewports = parseViewports(args.viewports) || parseViewports(responsive && responsive.viewports) || []
      if (responsive && viewports.length) {
        const pageUrl = args['responsive-url'] || args.url
        for (const vp of viewports) {
          const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })
          const rp = await ctx.newPage()
          await rp.goto(pageUrl, { waitUntil: 'load' })
          await prepare(rp, rootSel)
          await rp.evaluate(() => window.__fv.settle())
          const fails = await rp.evaluate(({ responsive, tolBox }) => window.__fv.checkResponsive(responsive, tolBox), { responsive, tolBox })
          const tag = `viewport[${vp.width}x${vp.height}].`
          failures.push(...fails.map((f) => ({ ...f, property: tag + f.property })))
          await rp.screenshot({ path: path.join(outDir, `viewport-${vp.width}x${vp.height}.png`), animations: 'disabled' })
          await ctx.close()
        }
      } else if (spec.scope === 'page') {
        warnings.push({ figmaNode: spec.nodeId, message: 'page spec without "responsive": layout verified at the frame size only' })
      }

      writeReport(outDir, spec, failures, warnings, pixelDiff)
      return failures.length
    }

    writeReport(outDir, spec, failures, warnings, null)
    return failures.length
  } finally {
    await browser.close()
  }
}

const writeReport = (outDir, spec, failures, warnings, pixelDiff) => {
  const report = { nodeId: spec.nodeId, component: spec.component || null, pass: failures.length === 0, pixelDiff, failures, warnings }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  const head = report.pass ? 'PASS' : `FAIL (${failures.length})`
  console.log(`${head}  ${spec.component || spec.nodeId}  pixelDiff=${pixelDiff === null ? 'n/a' : pixelDiff + '%'}  warnings=${warnings.length}`)
  for (const f of failures) console.log(`  ${f.figmaNode}  ${f.property}  expected=${JSON.stringify(f.expected)}  actual=${JSON.stringify(f.actual)}`)
  for (const w of warnings) console.log(`  warn ${w.figmaNode}  ${w.message}`)
}

main()
  .then((count) => process.exit(count ? 1 : 0))
  .catch((err) => {
    console.error(err)
    process.exit(2)
  })
