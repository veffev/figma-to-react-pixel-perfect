#!/usr/bin/env node
import { createHash } from 'node:crypto'
import fs from 'node:fs'

const EXCLUDED = new Set(['fixture'])

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object')
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stable(value[key])
        return acc
      }, {})
  return value
}

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Usage: node spec-hash.mjs <spec.json> [more specs...]')
  process.exit(2)
}

for (const file of files) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
  const trimmed = Object.fromEntries(Object.entries(spec).filter(([key]) => !EXCLUDED.has(key)))
  const hash = createHash('sha256').update(JSON.stringify(stable(trimmed))).digest('hex')
  console.log(`sha256:${hash}  ${file}`)
}
