import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createCycloneDxBom, stableJson } from './audit-core.mjs'

function fail(code) {
  throw new Error(code)
}

async function readJson(path) {
  let contents
  try {
    contents = await readFile(path, 'utf8')
  } catch {
    fail('M0_SBOM_INPUT_MISSING')
  }
  try {
    return JSON.parse(contents)
  } catch {
    fail('M0_SBOM_INPUT_INVALID')
  }
}

async function writeAtomic(path, value) {
  const temporary = `${path}.tmp-${randomUUID()}`
  try {
    await writeFile(temporary, stableJson(value), { encoding: 'utf8', flag: 'wx' })
    await rename(temporary, path)
  } catch {
    fail('M0_SBOM_WRITE_FAILED')
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function generateSbom(options) {
  const [inventory, licenses, audit] = await Promise.all([
    readJson(join(options.inputDirectory, 'dependency-inventory.json')),
    readJson(join(options.inputDirectory, 'licenses.json')),
    readJson(join(options.inputDirectory, 'audit.json'))
  ])
  const bom = createCycloneDxBom(
    { inventory, licenses, audit },
    options.generatedAt ?? new Date().toISOString()
  )
  await writeAtomic(join(options.inputDirectory, 'sbom.cdx.json'), bom)
  return bom
}

async function main() {
  await generateSbom({ inputDirectory: resolve('artifacts', 'm0') })
  process.stdout.write('CycloneDX 1.6 production SBOM generated and validated.\n')
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'M0_SBOM_UNKNOWN_FAILURE'}\n`)
    process.exitCode = 1
  })
}
