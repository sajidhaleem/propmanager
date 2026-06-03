/**
 * Generates PNG app icons from SVG source using sharp.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.join(__dirname, '../public/icons')

mkdirSync(iconsDir, { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

// SVG icon source - a house/property icon on blue gradient
function svgIcon(size) {
  const pad = Math.round(size * 0.15)
  const inner = size - pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <linearGradient id="ic" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#bfdbfe" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#bg)"/>
  <g transform="translate(${pad}, ${pad}) scale(${inner / 100})">
    <!-- House shape -->
    <path d="M50 10 L90 45 L80 45 L80 88 L60 88 L60 65 L40 65 L40 88 L20 88 L20 45 L10 45 Z"
          fill="url(#ic)" stroke="none"/>
    <!-- Door -->
    <rect x="42" y="67" width="16" height="21" rx="2" fill="#1e40af" opacity="0.4"/>
    <!-- Window left -->
    <rect x="24" y="52" width="14" height="12" rx="2" fill="#1e40af" opacity="0.35"/>
    <!-- Window right -->
    <rect x="62" y="52" width="14" height="12" rx="2" fill="#1e40af" opacity="0.35"/>
  </g>
</svg>`
}

async function generateIcons() {
  for (const size of sizes) {
    const svg = Buffer.from(svgIcon(size))
    const outPath = path.join(iconsDir, `icon-${size}x${size}.png`)
    await sharp(svg).png().toFile(outPath)
    console.log(`✓ Generated ${outPath}`)
  }
  console.log('\n✅ All icons generated successfully!')
}

generateIcons().catch(console.error)
