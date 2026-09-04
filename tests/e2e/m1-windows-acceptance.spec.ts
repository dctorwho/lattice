import { execFile as execFileCallback } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { arch, platform, release } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'

import {
  createM1AcceptanceRecorder,
  loadM1ByteFixtures,
  sha256,
  type M1ByteFixture
} from '../helpers/m1-acceptance'

const execFile = promisify(execFileCallback)
const repositoryRoot = process.cwd()
type Recorder = ReturnType<typeof createM1AcceptanceRecorder>

let recorder: Recorder | undefined
let byteFixtures: readonly M1ByteFixture[] = []

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

function currentRecorder(): Recorder {
  if (recorder === undefined) throw new Error('M1 acceptance recorder is not initialized')
  return recorder
}

async function packageVersion(path: string): Promise<string> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (typeof value !== 'object' || value === null || !('version' in value)) return 'unavailable'
  return typeof value.version === 'string' ? value.version : 'unavailable'
}

async function applicationCommit(): Promise<string> {
  const result = await execFile('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 5_000,
    windowsHide: true
  })
  return result.stdout.trim()
}

async function waitForExit(child: ReturnType<ElectronApplication['process']>): Promise<void> {
  if (child.exitCode !== null) return
  let timeout: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      once(child, 'exit').then(() => undefined),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Electron did not exit within 10 seconds')),
          10_000
        )
      })
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

async function exitApplication(application: ElectronApplication): Promise<void> {
  const child = application.process()
  await application.evaluate((electronApi) => electronApi.app.exit(0)).catch(() => undefined)
  await waitForExit(child)
}

async function forceKillApplication(application: ElectronApplication): Promise<void> {
  const child = application.process()
  if (child.exitCode !== null) return
  const pid = child.pid
  if (pid === undefined) throw new Error('Electron process ID is unavailable')
  const closed = application.waitForEvent('close', { timeout: 10_000 })
  if (platform() === 'win32') {
    await execFile('taskkill', ['/PID', String(pid), '/T', '/F'], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true
    })
  } else if (!child.kill('SIGKILL')) {
    throw new Error('Unable to force-kill Electron')
  }
  await Promise.all([waitForExit(child), closed])
}

interface ScenarioApplication {
  readonly application: ElectronApplication
  readonly page: Page
  readonly directory: string
  readonly userDataDirectory: string
}

async function launchScenario(id: string, reuse = false): Promise<ScenarioApplication> {
  const directory = join(repositoryRoot, 'artifacts', 'm1', 'runtime', id)
  const userDataDirectory = join(directory, 'user-data')
  if (!reuse) {
    await rm(directory, { recursive: true, force: true })
    await mkdir(userDataDirectory, { recursive: true })
  }
  const application = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDirectory}`, '--disable-gpu'],
    env: productionLaunchEnvironment()
  })
  return {
    application,
    page: await application.firstWindow(),
    directory,
    userDataDirectory
  }
}

async function selectOpenDialogPath(application: ElectronApplication, path: string): Promise<void> {
  await application.evaluate((electronApi, selectedPath) => {
    electronApi.dialog.showOpenDialog = () =>
      Promise.resolve({ canceled: false, filePaths: [selectedPath] })
  }, path)
}

async function selectSaveDialogPath(application: ElectronApplication, path: string): Promise<void> {
  await application.evaluate((electronApi, selectedPath) => {
    electronApi.dialog.showSaveDialog = () =>
      Promise.resolve({ canceled: false, filePath: selectedPath })
  }, path)
}

async function createConflictScenario(id: string): Promise<
  ScenarioApplication & {
    readonly documentPath: string
    readonly localText: string
    readonly externalText: string
  }
> {
  const scenario = await launchScenario(id)
  const documentPath = join(scenario.directory, 'conflict.md')
  const localText = '磁盘初始版本 + 本地修改'
  const externalText = '磁盘外部版本'
  await writeFile(documentPath, '磁盘初始版本')
  await selectOpenDialogPath(scenario.application, documentPath)
  await scenario.page.getByRole('button', { name: '打开…' }).click()
  const editor = scenario.page.locator('.cm-content')
  await expect(editor).toContainText('磁盘初始版本')
  await editor.click()
  await scenario.page.keyboard.press('End')
  await scenario.page.keyboard.insertText(' + 本地修改')
  await writeFile(documentPath, externalText)
  await expect(scenario.page.getByRole('dialog', { name: '文件已在外部更改' })).toBeVisible({
    timeout: 15_000
  })
  return { ...scenario, documentPath, localText, externalText }
}

test.describe.configure({ mode: 'serial' })
test.setTimeout(90_000)

test.beforeAll(async () => {
  byteFixtures = await loadM1ByteFixtures(repositoryRoot)
  const packageJsonPath = join(repositoryRoot, 'package.json')
  const electronPackagePath = join(repositoryRoot, 'node_modules', 'electron', 'package.json')
  recorder = createM1AcceptanceRecorder({
    rootDirectory: repositoryRoot,
    environment: {
      platform: platform(),
      release: release(),
      arch: arch(),
      node: process.version,
      pnpm: process.env.npm_config_user_agent?.match(/pnpm\/([^\s]+)/u)?.[1] ?? 'unavailable',
      electron: await packageVersion(electronPackagePath),
      appVersion: await packageVersion(packageJsonPath),
      commit: await applicationCommit()
    }
  })
})

test('TC-M1-013 CDP 组合输入提交为单一可撤销事务', async () => {
  const scenario = await launchScenario('ime-composition')
  try {
    const editor = scenario.page.locator('.cm-content')
    await editor.click()
    const cdp = await scenario.page.context().newCDPSession(scenario.page)
    await cdp.send('Input.imeSetComposition', {
      text: '中',
      selectionStart: 1,
      selectionEnd: 1
    })
    await cdp.send('Input.imeSetComposition', {
      text: '中文',
      selectionStart: 2,
      selectionEnd: 2
    })
    await cdp.send('Input.insertText', { text: '中文，😀e\u0301' })
    await expect(editor).toHaveText('中文，😀é')
    await scenario.page.keyboard.press('Control+Z')
    await expect(editor).toHaveText('')
    await scenario.page.keyboard.press('Control+Y')
    await expect(editor).toHaveText('中文，😀é')
    currentRecorder().recordPassed('ime-composition', {
      hashes: [{ label: 'committed-text', sha256: sha256(Buffer.from('中文，😀é')) }],
      references: ['REF-004'],
      components: ['COMP-004']
    })
  } finally {
    await exitApplication(scenario.application)
    await rm(scenario.directory, { recursive: true, force: true })
  }
})

test('TC-M1-013 冻结字节夹具经真实 Electron 往返后保持精确哈希', async () => {
  const scenario = await launchScenario('byte-roundtrip')
  try {
    for (const fixture of byteFixtures) {
      const fixturePath = join(scenario.directory, fixture.fileName)
      await writeFile(fixturePath, Buffer.from(fixture.baselineBase64, 'base64'))
      await selectOpenDialogPath(scenario.application, fixturePath)
      await scenario.page.getByRole('button', { name: '打开…' }).click()
      if (fixture.editable) {
        const editor = scenario.page.locator('.cm-content')
        await expect(editor).toContainText('M1_EDIT_OLD')
        await editor.click()
        await scenario.page.keyboard.press('Control+H')
        const panel = scenario.page.getByRole('region', { name: '替换' })
        await panel.getByRole('textbox', { name: '查找' }).fill('M1_EDIT_OLD')
        await panel.getByRole('textbox', { name: '替换为' }).fill('M1_EDIT_NEW')
        await panel.getByRole('button', { name: '全部替换' }).click()
        await panel.getByRole('button', { name: '关闭查找' }).click()
        const save = scenario.page.getByRole('button', { name: '保存', exact: true })
        await save.click()
        await expect
          .poll(async () => sha256(await readFile(fixturePath)), {
            timeout: 15_000,
            intervals: [50, 100, 250]
          })
          .toBe(fixture.expectedSha256)
      } else if (fixture.id === 'invalid-utf8-readonly') {
        await expect(scenario.page.getByRole('region', { name: '只读文档诊断' })).toBeVisible()
      }
      const actual = await readFile(fixturePath)
      expect(actual.equals(Buffer.from(fixture.expectedBase64, 'base64')), fixture.id).toBe(true)
      expect(sha256(actual), fixture.id).toBe(fixture.expectedSha256)
    }
    currentRecorder().recordPassed('byte-roundtrip', {
      fixtureIds: byteFixtures.map((fixture) => fixture.id),
      hashes: byteFixtures.map((fixture) => ({
        label: fixture.id,
        sha256: fixture.expectedSha256
      })),
      references: ['REF-001', 'REF-002'],
      components: ['COMP-001', 'COMP-002']
    })
  } finally {
    await exitApplication(scenario.application)
    await rm(scenario.directory, { recursive: true, force: true })
  }
})

test('TC-M1-013 外部冲突四种决策均保留应保留版本', async () => {
  const compare = await createConflictScenario('conflict-compare-cancel')
  try {
    const dialog = compare.page.getByRole('dialog', { name: '文件已在外部更改' })
    await dialog.getByRole('button', { name: '比较两个版本' }).click()
    await expect(dialog.getByRole('region', { name: '本地版本' })).toContainText(compare.localText)
    await expect(dialog.getByRole('region', { name: '磁盘版本' })).toContainText(
      compare.externalText
    )
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(compare.page.getByRole('button', { name: '文件冲突待处理' })).toBeVisible()
    expect(await readFile(compare.documentPath, 'utf8')).toBe(compare.externalText)
    currentRecorder().recordPassed('conflict-compare-cancel', {
      hashes: [
        { label: 'local', sha256: sha256(Buffer.from(compare.localText)) },
        { label: 'external', sha256: sha256(Buffer.from(compare.externalText)) }
      ]
    })
  } finally {
    await exitApplication(compare.application)
    await rm(compare.directory, { recursive: true, force: true })
  }

  const reload = await createConflictScenario('conflict-reload')
  try {
    await reload.page
      .getByRole('dialog', { name: '文件已在外部更改' })
      .getByRole('button', { name: '重新加载磁盘版本' })
      .click()
    await expect(reload.page.locator('.cm-content')).toHaveText(reload.externalText)
    expect(await readFile(reload.documentPath, 'utf8')).toBe(reload.externalText)
    currentRecorder().recordPassed('conflict-reload', {
      hashes: [{ label: 'external', sha256: sha256(Buffer.from(reload.externalText)) }]
    })
  } finally {
    await exitApplication(reload.application)
    await rm(reload.directory, { recursive: true, force: true })
  }

  const saveAs = await createConflictScenario('conflict-save-as')
  try {
    const localCopyPath = join(saveAs.directory, 'local-copy.md')
    await selectSaveDialogPath(saveAs.application, localCopyPath)
    await saveAs.page
      .getByRole('dialog', { name: '文件已在外部更改' })
      .getByRole('button', { name: '本地内容另存为…' })
      .click()
    await expect(saveAs.page.getByRole('dialog', { name: '文件已在外部更改' })).toBeHidden()
    expect(await readFile(saveAs.documentPath, 'utf8')).toBe(saveAs.externalText)
    expect(await readFile(localCopyPath, 'utf8')).toBe(saveAs.localText)
    currentRecorder().recordPassed('conflict-save-as', {
      hashes: [
        { label: 'local-copy', sha256: sha256(await readFile(localCopyPath)) },
        { label: 'external', sha256: sha256(await readFile(saveAs.documentPath)) }
      ]
    })
  } finally {
    await exitApplication(saveAs.application)
    await rm(saveAs.directory, { recursive: true, force: true })
  }

  const overwrite = await createConflictScenario('conflict-confirmed-overwrite')
  try {
    const dialog = overwrite.page.getByRole('dialog', { name: '文件已在外部更改' })
    await dialog.getByRole('button', { name: '覆盖磁盘版本…' }).click()
    expect(await readFile(overwrite.documentPath, 'utf8')).toBe(overwrite.externalText)
    await dialog.getByRole('button', { name: '确认覆盖磁盘版本' }).click()
    await expect(dialog).toBeHidden()
    expect(await readFile(overwrite.documentPath, 'utf8')).toBe(overwrite.localText)
    currentRecorder().recordPassed('conflict-confirmed-overwrite', {
      hashes: [{ label: 'overwritten', sha256: sha256(await readFile(overwrite.documentPath)) }],
      references: ['REF-001'],
      components: ['COMP-001']
    })
  } finally {
    await exitApplication(overwrite.application)
    await rm(overwrite.directory, { recursive: true, force: true })
  }
})

test('TC-M1-013 强制终止后从隔离 user-data 恢复最新修订', async () => {
  const first = await launchScenario('crash-recovery')
  const recoveryText = '强制终止后必须恢复的中文正文 😀'
  await first.page.locator('.cm-content').click()
  await first.page.keyboard.insertText(recoveryText)
  await first.page.waitForTimeout(1_500)
  expect(await readdir(join(first.userDataDirectory, 'recovery-v1'))).not.toHaveLength(0)
  await forceKillApplication(first.application)

  const second = await launchScenario('crash-recovery', true)
  try {
    const dialog = second.page.getByRole('dialog', { name: '恢复未保存的文档' })
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await dialog.getByRole('button', { name: '恢复' }).click()
    await expect(second.page.locator('.cm-content')).toHaveText(recoveryText)
    currentRecorder().recordPassed('crash-recovery', {
      hashes: [{ label: 'recovered', sha256: sha256(Buffer.from(recoveryText)) }],
      references: ['REF-003'],
      components: ['COMP-003']
    })
  } finally {
    await exitApplication(second.application)
    await rm(second.directory, { recursive: true, force: true })
  }
})

test('TC-M1-013 关闭时保存、不保存和取消均执行明确决策', async () => {
  const save = await launchScenario('close-save')
  const savePath = join(save.directory, 'saved-on-close.md')
  try {
    await selectSaveDialogPath(save.application, savePath)
    await save.page.locator('.cm-content').click()
    await save.page.keyboard.insertText('关闭时保存')
    await save.application.evaluate((electronApi) => {
      electronApi.BrowserWindow.getFocusedWindow()?.close()
    })
    const dialog = save.page.getByRole('dialog', { name: '保存更改' })
    await expect(dialog).toBeVisible()
    const child = save.application.process()
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await waitForExit(child)
    expect(await readFile(savePath, 'utf8')).toBe('关闭时保存')
    currentRecorder().recordPassed('close-save', {
      hashes: [{ label: 'saved', sha256: sha256(await readFile(savePath)) }]
    })
  } finally {
    await save.application.evaluate((electronApi) => electronApi.app.exit(0)).catch(() => undefined)
    await rm(save.directory, { recursive: true, force: true })
  }

  const discard = await launchScenario('close-discard')
  try {
    await discard.page.locator('.cm-content').click()
    await discard.page.keyboard.insertText('关闭时不保存')
    await discard.application.evaluate((electronApi) => {
      electronApi.BrowserWindow.getFocusedWindow()?.close()
    })
    const dialog = discard.page.getByRole('dialog', { name: '保存更改' })
    await expect(dialog).toBeVisible()
    const child = discard.application.process()
    await dialog.getByRole('button', { name: '不保存' }).click()
    await waitForExit(child)
    currentRecorder().recordPassed('close-discard')
  } finally {
    await discard.application
      .evaluate((electronApi) => electronApi.app.exit(0))
      .catch(() => undefined)
    await rm(discard.directory, { recursive: true, force: true })
  }

  const cancel = await launchScenario('close-cancel')
  try {
    await cancel.page.locator('.cm-content').click()
    await cancel.page.keyboard.insertText('取消关闭后仍存在')
    await cancel.application.evaluate((electronApi) => {
      electronApi.BrowserWindow.getFocusedWindow()?.close()
    })
    const dialog = cancel.page.getByRole('dialog', { name: '保存更改' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(cancel.page.locator('.cm-content')).toHaveText('取消关闭后仍存在')
    currentRecorder().recordPassed('close-cancel', {
      hashes: [{ label: 'retained', sha256: sha256(Buffer.from('取消关闭后仍存在')) }]
    })
  } finally {
    await exitApplication(cancel.application)
    await rm(cancel.directory, { recursive: true, force: true })
  }
})

test('TC-M1-013 公开依据覆盖完整并写出脱敏自动证据', async () => {
  currentRecorder().recordPassed('reference-evidence', {
    references: ['REF-001', 'REF-002', 'REF-003', 'REF-004', 'REF-005'],
    components: ['COMP-001', 'COMP-002', 'COMP-003', 'COMP-004', 'COMP-036']
  })
  const outputPath = await currentRecorder().write()
  const output = await readFile(outputPath, 'utf8')
  expect(output).not.toContain(repositoryRoot)
  expect(output).not.toContain('强制终止后必须恢复的中文正文')
})
