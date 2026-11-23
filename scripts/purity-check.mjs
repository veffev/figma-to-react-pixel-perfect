#!/usr/bin/env node
import fs from 'node:fs'

const USAGE = 'Usage: node purity-check.mjs [--spec <spec.json>] <component files...>'

const DATA_MODULES = [
  'swr',
  '@tanstack/react-query',
  'react-query',
  '@apollo/client',
  'urql',
  'graphql-request',
  'axios',
  'wretch',
  'ky',
  'got',
  'node-fetch',
  '@supabase/supabase-js',
  '@supabase/ssr',
  '@trpc/client',
  '@trpc/react-query',
  'firebase',
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const RULES = [
  { name: 'fetch call', re: /(^|[^.\w])fetch\s*\(/ },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { name: 'server action', re: /^\s*['"]use server['"]/ },
  { name: 'data hook', re: /\buse(SWR|SWRInfinite|SWRMutation|Query|InfiniteQuery|Mutation|SuspenseQuery)\s*\(/ },
  ...DATA_MODULES.map((mod) => ({
    name: `import of ${mod}`,
    re: new RegExp(`(from\\s+|require\\(\\s*|import\\(\\s*)['"]${escapeRe(mod)}(/[^'"]*)?['"]`),
  })),
]

const collectStrings = (value, out) => {
  if (typeof value === 'string') {
    if (value.trim().length >= 4) out.add(value.trim())
  } else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out))
}

const args = process.argv.slice(2)
const files = []
let specPath = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--spec') specPath = args[++i]
  else files.push(args[i])
}
if (!files.length) {
  console.error(USAGE)
  process.exit(2)
}

const fixtureStrings = new Set()
if (specPath) collectStrings(JSON.parse(fs.readFileSync(specPath, 'utf8')).fixture, fixtureStrings)

const findings = []
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    for (const rule of RULES)
      if (rule.re.test(line)) findings.push({ file, line: index + 1, rule: rule.name, text: line.trim() })
    for (const value of fixtureStrings)
      if (line.includes(value))
        findings.push({ file, line: index + 1, rule: 'fixture value hardcoded', text: value })
  })
}

if (!findings.length) {
  console.log(`PASS  ${files.length} file(s): no data logic, no fixture values`)
  process.exit(0)
}
console.log(`FAIL (${findings.length})`)
for (const f of findings) console.log(`  ${f.file}:${f.line}  ${f.rule}  ${f.text}`)
process.exit(1)
