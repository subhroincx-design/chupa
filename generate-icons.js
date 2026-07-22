import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="128" fill="#059669"/>
  <path d="M256 128c-70.7 0-128 46.6-128 104 0 35.1 21.3 66 54.6 85.3L168 368l56.8-24.3c10.1 2.8 20.7 4.3 31.2 4.3 70.7 0 128-46.6 128-104S326.7 128 256 128z" fill="#FFFFFF"/>
  <circle cx="206" cy="232" r="14" fill="#059669"/>
  <circle cx="256" cy="232" r="14" fill="#059669"/>
  <circle cx="306" cy="232" r="14" fill="#059669"/>
</svg>
`

async function generate() {
  const publicDir = path.join(__dirname, 'public')
  const svgBuffer = Buffer.from(svgIcon)

  // 192x192
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192.png'))
  console.log('✓ Generated pwa-192.png')

  // 512x512
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512.png'))
  console.log('✓ Generated pwa-512.png')

  // Apple Touch Icon 180x180
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))
  console.log('✓ Generated apple-touch-icon.png')

  // Favicon 64x64
  await sharp(svgBuffer).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png'))
  console.log('✓ Generated favicon.png')
}

generate().catch(console.error)
