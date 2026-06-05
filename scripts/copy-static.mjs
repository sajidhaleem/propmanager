/**
 * Cross-platform script to copy .next/static → public/_next/static
 * Used by Netlify build command to ensure /_next/static/ assets are served
 * correctly as CDN files, bypassing the SSR function.
 */
import { cpSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const src = join(root, '.next', 'static')
const dst = join(root, 'public', '_next', 'static')

mkdirSync(join(root, 'public', '_next'), { recursive: true })
cpSync(src, dst, { recursive: true })

console.log(`✓ Copied .next/static → public/_next/static`)
