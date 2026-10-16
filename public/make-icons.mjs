// Makes the app icons from your logo.
// Run it from the project folder:   node scripts/make-icons.mjs
// To change the logo later: replace public/favicon.svg (or change SOURCE below) and run it again.
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const SOURCE = 'public/favicon.svg'
const BACKGROUND = '#0B1F1A' // the dark green of the app

// size: the square icon size in pixels. logoRatio: how much of the square the logo fills.
// The "maskable" icon keeps the logo smaller so phones can cut its corners without clipping the logo.
const ICONS = [
  { file: 'public/icon-192.png', size: 192, logoRatio: 0.62 },
  { file: 'public/icon-512.png', size: 512, logoRatio: 0.62 },
  { file: 'public/icon-maskable-512.png', size: 512, logoRatio: 0.5 },
  { file: 'public/apple-touch-icon.png', size: 180, logoRatio: 0.62 },
]

const svg = await readFile(SOURCE)

for (const { file, size, logoRatio } of ICONS) {
  const logoSize = Math.round(size * logoRatio)

  const logo = await sharp(svg, { density: 600 })
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(file)

  console.log(`Made ${file} (${size}x${size})`)
}
