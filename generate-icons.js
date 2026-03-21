// Generates public/icon-192.png and public/icon-512.png
// Run with: node generate-icons.js

import sharp from 'sharp'

function makeSvg(size) {
  const cx = size / 2
  const cy = size / 2
  const r  = Math.round(size * 0.42)          // circle radius
  const sw = Math.max(3, Math.round(size * 0.018)) // stroke width
  const fs = Math.round(size * 0.26)           // font size

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1a1a1a"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="${sw}"/>
  <text
    x="${cx}" y="${cy + Math.round(fs * 0.36)}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fs}"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="auto"
  >HMF</text>
</svg>`
}

async function generate() {
  await sharp(Buffer.from(makeSvg(192))).png().toFile('public/icon-192.png')
  console.log('✓  public/icon-192.png')

  await sharp(Buffer.from(makeSvg(512))).png().toFile('public/icon-512.png')
  console.log('✓  public/icon-512.png')
}

generate().catch(err => { console.error(err); process.exit(1) })
