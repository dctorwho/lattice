import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as zlibConstants, deflateSync } from 'node:zlib'

const size = 256
const background = '#161A2B'
const white = '#FFFFFF'
const lineWidth = 10
const tiles = [
  { x: 40, y: 44, width: 64, height: 64, radius: 16, color: '#8B5CF6' },
  { x: 120, y: 44, width: 64, height: 64, radius: 16, color: '#A78BFA' },
  { x: 40, y: 124, width: 64, height: 64, radius: 16, color: '#C4B5FD' },
  { x: 120, y: 124, width: 64, height: 64, radius: 16, color: '#8B5CF6' }
]
const sourceLine = { x1: 48, y1: 208, x2: 208, y2: 48 }

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const outputs = {
  svg: 'build/brand/lattice-icon.svg',
  png: 'build/brand/lattice-icon-256.png',
  ico: 'build/brand/lattice.ico'
}

const parseHexColor = (color) => {
  const red = Number.parseInt(color.slice(1, 3), 16)
  const green = Number.parseInt(color.slice(3, 5), 16)
  const blue = Number.parseInt(color.slice(5, 7), 16)
  return [red, green, blue, 255]
}

const resolveProjectOutput = (projectRelativePath) => {
  if (!projectRelativePath || isAbsolute(projectRelativePath)) {
    throw new Error(`Output path must be repository-relative: ${projectRelativePath}`)
  }

  const outputPath = resolve(repositoryRoot, projectRelativePath)
  const relativePath = relative(repositoryRoot, outputPath)
  if (relativePath === '' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Output path escapes the repository: ${projectRelativePath}`)
  }

  return outputPath
}

const svg = () => {
  const tileElements = tiles
    .map(
      (tile) =>
        `  <rect x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" rx="${tile.radius}" fill="${tile.color}" />`
    )
    .join('\n')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-labelledby="title">`,
    '  <title id="title">Lattice application icon</title>',
    `  <rect width="${size}" height="${size}" fill="${background}" />`,
    tileElements,
    `  <path d="M ${sourceLine.x1} ${sourceLine.y1} L ${sourceLine.x2} ${sourceLine.y2}" fill="none" stroke="${white}" stroke-width="${lineWidth}" stroke-linecap="round" />`,
    '</svg>',
    ''
  ].join('\n')
}

const isInsideRoundedRectangle = (x, y, tile) => {
  const left = tile.x
  const right = tile.x + tile.width
  const top = tile.y
  const bottom = tile.y + tile.height

  if (x < left || x >= right || y < top || y >= bottom) {
    return false
  }

  const nearestX = Math.max(left + tile.radius, Math.min(x, right - tile.radius))
  const nearestY = Math.max(top + tile.radius, Math.min(y, bottom - tile.radius))
  const deltaX = x - nearestX
  const deltaY = y - nearestY
  return deltaX * deltaX + deltaY * deltaY <= tile.radius * tile.radius
}

const distanceToLineSegment = (x, y) => {
  const lineX = sourceLine.x2 - sourceLine.x1
  const lineY = sourceLine.y2 - sourceLine.y1
  const lineLengthSquared = lineX * lineX + lineY * lineY
  const pointX = x - sourceLine.x1
  const pointY = y - sourceLine.y1
  const progress = Math.max(0, Math.min(1, (pointX * lineX + pointY * lineY) / lineLengthSquared))
  const deltaX = x - (sourceLine.x1 + lineX * progress)
  const deltaY = y - (sourceLine.y1 + lineY * progress)
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
}

const rasterize = () => {
  const pixels = Buffer.alloc(size * size * 4)
  const backgroundRgba = parseHexColor(background)
  const whiteRgba = parseHexColor(white)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pointX = x + 0.5
      const pointY = y + 0.5
      let rgba = backgroundRgba

      for (const tile of tiles) {
        if (isInsideRoundedRectangle(pointX, pointY, tile)) {
          rgba = parseHexColor(tile.color)
        }
      }

      if (distanceToLineSegment(pointX, pointY) <= lineWidth / 2) {
        rgba = whiteRgba
      }

      const offset = (y * size + x) * 4
      pixels[offset] = rgba[0]
      pixels[offset + 1] = rgba[1]
      pixels[offset + 2] = rgba[2]
      pixels[offset + 3] = rgba[3]
    }
  }

  return pixels
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < table.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

const crc32 = (data) => {
  let value = 0xffffffff
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBytes.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length)
  return chunk
}

const png = (pixels) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6

  const scanlines = Buffer.alloc((size * 4 + 1) * size)
  for (let row = 0; row < size; row += 1) {
    const scanlineOffset = row * (size * 4 + 1)
    scanlines[scanlineOffset] = 0
    pixels.copy(scanlines, scanlineOffset + 1, row * size * 4, (row + 1) * size * 4)
  }

  const compressed = deflateSync(scanlines, {
    level: 9,
    memLevel: 9,
    strategy: zlibConstants.Z_FIXED
  })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

const ico = (pngBytes) => {
  const headerLength = 6
  const entryLength = 16
  const result = Buffer.alloc(headerLength + entryLength + pngBytes.length)
  result.writeUInt16LE(0, 0)
  result.writeUInt16LE(1, 2)
  result.writeUInt16LE(1, 4)
  result[6] = 0
  result[7] = 0
  result[8] = 0
  result[9] = 0
  result.writeUInt16LE(1, 10)
  result.writeUInt16LE(32, 12)
  result.writeUInt32LE(pngBytes.length, 14)
  result.writeUInt32LE(headerLength + entryLength, 18)
  pngBytes.copy(result, headerLength + entryLength)
  return result
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

const generatedAssets = () => {
  const pngBytes = png(rasterize())
  return new Map([
    [resolveProjectOutput(outputs.svg), Buffer.from(svg(), 'utf8')],
    [resolveProjectOutput(outputs.png), pngBytes],
    [resolveProjectOutput(outputs.ico), ico(pngBytes)]
  ])
}

const checkAssets = (assets) => {
  for (const [assetPath, expected] of assets) {
    if (!existsSync(assetPath)) {
      throw new Error(`Missing generated asset: ${relative(repositoryRoot, assetPath)}`)
    }
    const actual = readFileSync(assetPath)
    if (!actual.equals(expected)) {
      throw new Error(`Generated asset does not match: ${relative(repositoryRoot, assetPath)}`)
    }
  }
}

const writeAssets = (assets) => {
  for (const [assetPath, contents] of assets) {
    mkdirSync(dirname(assetPath), { recursive: true })
    writeFileSync(assetPath, contents)
  }
}

const argumentsList = process.argv.slice(2)
if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== '--check')) {
  throw new Error('Usage: node scripts/assets/build-lattice-icon.mjs [--check]')
}

const assets = generatedAssets()
if (argumentsList[0] === '--check') {
  checkAssets(assets)
} else {
  writeAssets(assets)
}

console.log(`lattice-icon-256.png SHA-256 ${sha256(assets.get(resolveProjectOutput(outputs.png)))}`)
console.log(`lattice.ico SHA-256 ${sha256(assets.get(resolveProjectOutput(outputs.ico)))}`)
