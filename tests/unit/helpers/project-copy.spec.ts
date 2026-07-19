import { execFile } from 'node:child_process'
import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyProject, listProjectFiles, removeWithRetry } from '../../helpers/project-copy'

const execFileAsync = promisify(execFile)

describe('project copy isolation', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-copy-'))
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  it('copies only the supplied safe relative paths', async () => {
    const source = join(root, 'source')
    const target = join(root, 'target')
    await mkdir(join(source, 'src'), { recursive: true })
    await mkdir(join(source, 'node_modules'), { recursive: true })
    await writeFile(join(source, 'src/index.ts'), 'export {}\n')
    await writeFile(join(source, 'node_modules/secret'), 'excluded')

    await copyProject(source, target, ['src/index.ts'])

    await expect(access(join(target, 'src/index.ts'))).resolves.toBeUndefined()
    await expect(access(join(target, 'node_modules/secret'))).rejects.toThrow()
  })

  it('lists Git project files while excluding generated top-level paths', async () => {
    const source = join(root, 'source')
    await mkdir(join(source, 'src'), { recursive: true })
    await mkdir(join(source, 'node_modules'), { recursive: true })
    await writeFile(join(source, 'src/index.ts'), 'export {}\n')
    await writeFile(join(source, 'node_modules/secret'), 'excluded')
    await execFileAsync('git', ['init', '--quiet'], { cwd: source, windowsHide: true })

    const files = await listProjectFiles(source)

    expect(files).toContain('src/index.ts')
    expect(files).not.toContain('node_modules/secret')
  })

  it('rejects parent-traversal paths', async () => {
    const source = join(root, 'source')
    const target = join(root, 'target')
    await mkdir(source)

    await expect(copyProject(source, target, ['../outside.ts'])).rejects.toThrow('relative path')
  })

  it('rejects an absolute copy path', async () => {
    const source = join(root, 'source')
    const target = join(root, 'target')
    await mkdir(source)

    await expect(copyProject(source, target, [join(root, 'outside.ts')])).rejects.toThrow(
      'Unsafe relative path'
    )
  })

  it('rejects an explicitly supplied excluded top-level path', async () => {
    const source = join(root, 'source')
    const target = join(root, 'target')
    await mkdir(join(source, 'node_modules'), { recursive: true })
    await writeFile(join(source, 'node_modules/secret.txt'), 'excluded')

    await expect(copyProject(source, target, ['node_modules/secret.txt'])).rejects.toThrow(
      'Excluded project path'
    )
  })

  it.each(['./node_modules/secret.txt', '.\\out\\result.js'])(
    'rejects an excluded path with a dot prefix: %s',
    async (relativePath) => {
      const source = join(root, 'source')
      const target = join(root, 'target')
      await mkdir(join(source, 'node_modules'), { recursive: true })
      await mkdir(join(source, 'out'), { recursive: true })
      await writeFile(join(source, 'node_modules/secret.txt'), 'excluded')
      await writeFile(join(source, 'out/result.js'), 'excluded')

      await expect(copyProject(source, target, [relativePath])).rejects.toThrow(
        'Unsafe relative path'
      )
    }
  )

  it('rejects a copy target inside the source tree', async () => {
    const source = join(root, 'source')
    await mkdir(join(source, 'src'), { recursive: true })
    await writeFile(join(source, 'src/index.ts'), 'export {}\n')

    await expect(copyProject(source, join(source, 'copy'), ['src/index.ts'])).rejects.toThrow(
      'inside the source'
    )
  })

  it('rejects a source path that escapes through a junction', async () => {
    const source = join(root, 'source')
    const target = join(root, 'target')
    const external = join(root, 'external')
    await mkdir(source)
    await mkdir(external)
    await writeFile(join(external, 'secret.txt'), 'private')
    await symlink(external, join(source, 'linked'), 'junction')

    await expect(copyProject(source, target, ['linked/secret.txt'])).rejects.toThrow(
      'outside the source'
    )
  })

  it('rejects a target path that escapes through a junction', async () => {
    const source = join(root, 'source')
    const target = join(root, 'target')
    const external = join(root, 'external')
    await mkdir(join(source, 'linked'), { recursive: true })
    await mkdir(target)
    await mkdir(external)
    await writeFile(join(source, 'linked/index.ts'), 'export {}\n')
    await symlink(external, join(target, 'linked'), 'junction')

    await expect(copyProject(source, target, ['linked/index.ts'])).rejects.toThrow(
      'outside the target'
    )
  })

  it('reports the exact target and diagnostic after cleanup attempts are exhausted', async () => {
    const target = '\0'

    const error = await removeWithRetry(target, 1).catch((failure: unknown) => failure)

    expect(error).toBeInstanceOf(Error)
    if (error instanceof Error) {
      expect(error.message).toContain(target)
      expect(error.message).toContain('null bytes')
    }
  })

  it('removes a copied tree', async () => {
    const target = join(root, 'target')
    await mkdir(target)
    await removeWithRetry(target)
    await expect(access(target)).rejects.toThrow()
  })
})
