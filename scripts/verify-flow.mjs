#!/usr/bin/env node
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const USAGE = `Usage: node verify-flow.mjs --walk <flow-walk.json> --url <playground url>
  [--out <dir>] [--viewport 1440x900] [--timeout <ms>] [--executable <chromium path>]`

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
  console.error('Playwright not found in this project. Install it: npm i -D @playwright/test && npx playwright install chromium')
  process.exit(2)
}

const node = (id) => `[data-figma-node="${id}"]`

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.walk || !args.url) {
    console.error(USAGE)
    process.exit(2)
  }
  const walk = JSON.parse(fs.readFileSync(args.walk, 'utf8'))
  const outDir = args.out || path.dirname(args.walk)
  fs.mkdirSync(outDir, { recursive: true })
  const timeout = Number(args.timeout ?? 8000)
  const [width, height] = String(args.viewport || '1440x900').split('x').map(Number)
  const failures = []
  const visited = []
  const runtimeErrors = []

  const chromium = loadChromium()
  const browser = await chromium.launch(args.executable ? { executablePath: args.executable } : {})
  try {
    const page = await browser.newPage({ viewport: { width, height } })
    page.on('pageerror', (err) => runtimeErrors.push(String(err.message || err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') runtimeErrors.push(msg.text())
    })
    await page.goto(args.url, { waitUntil: 'load' })
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined)

    for (const step of walk.steps || []) {
      const reached = await page
        .waitForSelector(`[data-flow-step="${step.id}"]`, { state: 'attached', timeout })
        .then(() => true)
        .catch(() => false)
      if (!reached) {
        const actual = await page.evaluate(() => document.querySelector('[data-flow-step]')?.getAttribute('data-flow-step') ?? 'no flow container')
        failures.push({ step: step.id, check: 'reached', expected: step.id, actual })
        break
      }
      if (step.root) {
        const visible = await page
          .waitForSelector(node(step.root), { state: 'visible', timeout })
          .then(() => true)
          .catch(() => false)
        if (!visible) failures.push({ step: step.id, check: 'root-visible', expected: step.root, actual: 'not visible' })
      }
      for (const id of step.expectVisible || []) {
        if (!(await page.locator(node(id)).first().isVisible().catch(() => false)))
          failures.push({ step: step.id, check: 'visible', expected: id, actual: 'not visible' })
      }
      await page.screenshot({ path: path.join(outDir, `flow-${step.id}.png`) })
      visited.push(step.id)

      let aborted = false
      for (const action of step.actions || []) {
        const target = action.click || action.fill || action.press || action.check
        const loc = page.locator(node(target)).first()
        if ((await loc.count()) === 0) {
          failures.push({ step: step.id, check: 'action-target', expected: target, actual: 'not found' })
          aborted = true
          break
        }
        try {
          if (action.fill) await loc.fill(String(action.value ?? ''), { timeout })
          else if (action.check) await loc.check({ timeout })
          else if (action.press) await loc.press(String(action.key || 'Enter'), { timeout })
          else await loc.click({ timeout })
        } catch (err) {
          failures.push({ step: step.id, check: 'action', expected: JSON.stringify(action), actual: String(err.message).split('\n')[0] })
          aborted = true
          break
        }
        if (action.expectState) {
          const ok = await page
            .waitForSelector(`[data-flow-state="${action.expectState}"]`, { state: 'attached', timeout })
            .then(() => true)
            .catch(() => false)
          if (!ok) failures.push({ step: step.id, check: 'state', expected: action.expectState, actual: await page.evaluate(() => document.querySelector('[data-flow-state]')?.getAttribute('data-flow-state') ?? 'none') })
        }
      }
      if (aborted) break
    }
    for (const message of runtimeErrors) failures.push({ step: null, check: 'runtime-error', expected: 'no errors', actual: message })
  } finally {
    await browser.close()
  }

  const expected = (walk.steps || []).map((s) => s.id)
  const report = { flow: walk.flow || null, pass: failures.length === 0, expected, visited, failures }
  fs.writeFileSync(path.join(outDir, 'flow-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${report.pass ? 'PASS' : `FAIL (${failures.length})`}  flow ${walk.flow || ''}  visited ${visited.length}/${expected.length}: ${visited.join(' > ')}`)
  for (const f of failures) console.log(`  ${f.step ?? '-'}  ${f.check}  expected=${JSON.stringify(f.expected)}  actual=${JSON.stringify(f.actual)}`)
  return failures.length
}

main()
  .then((count) => process.exit(count ? 1 : 0))
  .catch((err) => {
    console.error(err)
    process.exit(2)
  })
