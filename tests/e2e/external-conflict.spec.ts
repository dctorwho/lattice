import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('TC-M1-012 外部冲突重载后保持主进程修订同步并可继续保存', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lattice-e2e-conflict-'))
  const path = join(root, '冲突.md')
  await writeFile(path, '磁盘初始版本')
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    await application.evaluate((electronApi, selectedPath) => {
      electronApi.dialog.showOpenDialog = () =>
        Promise.resolve({ canceled: false, filePaths: [selectedPath] })
    }, path)
    const page = await application.firstWindow()
    await page.getByRole('button', { name: '打开…' }).click()
    const editor = page.getByRole('textbox')
    await expect(editor).toContainText('磁盘初始版本')
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.insertText(' + 本地修改')
    await writeFile(path, '磁盘外部版本')

    let dialog = page.getByRole('dialog', { name: '文件已在外部更改' })
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '比较两个版本' }).click()
    await expect(dialog.getByRole('region', { name: '本地版本' })).toContainText('本地修改')
    await expect(dialog.getByRole('region', { name: '磁盘版本' })).toContainText('磁盘外部版本')
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(page.getByRole('button', { name: '文件冲突待处理' })).toBeVisible()
    await page.getByRole('button', { name: '文件冲突待处理' }).click()
    dialog = page.getByRole('dialog', { name: '文件已在外部更改' })
    await dialog.getByRole('button', { name: '重新加载磁盘版本' }).click()
    await expect(page.getByRole('textbox')).toContainText('磁盘外部版本')
    await page.getByRole('textbox').click()
    await page.keyboard.press('End')
    await page.keyboard.insertText(' + 重载后修改')
    await page.getByRole('button', { name: '保存' }).click()
    await expect.poll(() => readFile(path, 'utf8')).toBe('磁盘外部版本 + 重载后修改')
  } finally {
    await application.close()
    await rm(root, { force: true, recursive: true })
  }
})

test('TC-M1-008 干净外部更新经主进程复核后自动重载并可继续保存', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lattice-e2e-clean-reload-'))
  const path = join(root, '干净重载.md')
  await writeFile(path, '初始版本')
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    await application.evaluate((electronApi, selectedPath) => {
      electronApi.dialog.showOpenDialog = () =>
        Promise.resolve({ canceled: false, filePaths: [selectedPath] })
    }, path)
    const page = await application.firstWindow()
    await page.getByRole('button', { name: '打开…' }).click()
    await expect(page.getByRole('textbox')).toContainText('初始版本')

    await writeFile(path, '外部干净版本')
    const editor = page.getByRole('textbox')
    await expect(editor).toContainText('外部干净版本', { timeout: 10_000 })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.insertText(' + 继续编辑')
    await page.getByRole('button', { name: '保存' }).click()

    await expect.poll(() => readFile(path, 'utf8')).toBe('外部干净版本 + 继续编辑')
  } finally {
    await application.close()
    await rm(root, { force: true, recursive: true })
  }
})
