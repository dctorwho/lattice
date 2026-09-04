import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('TC-M1-007 新建与窗口关闭均经过保存/不保存/取消门禁', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  const page = await application.firstWindow()
  const editor = page.getByRole('textbox')
  await editor.click()
  await page.keyboard.insertText('不可静默丢失')

  await page.getByRole('button', { name: '新建' }).click()
  let dialog = page.getByRole('dialog', { name: '保存更改' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(editor).toContainText('不可静默丢失')

  await application.evaluate((electronApi) => {
    electronApi.BrowserWindow.getFocusedWindow()?.close()
  })
  dialog = page.getByRole('dialog', { name: '保存更改' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible()

  await page.getByRole('button', { name: '新建' }).click()
  dialog = page.getByRole('dialog', { name: '保存更改' })
  await dialog.getByRole('button', { name: '不保存' }).click()
  await expect(page.getByRole('textbox')).toHaveText('')
  await application.close()
})
