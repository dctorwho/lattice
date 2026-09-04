import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('TC-M1-006 CodeMirror 源码输入、撤销与重做保持同一会话', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    const page = await application.firstWindow()
    const editor = page.getByRole('textbox')
    await editor.click()
    await page.keyboard.insertText('中文😀\n第二行')
    await expect(editor).toContainText('中文😀')
    await expect(page.getByRole('status')).toContainText('2 行')

    await application.evaluate((electronApi) => {
      const item = electronApi.Menu.getApplicationMenu()?.getMenuItemById('edit.undo')
      const window = electronApi.BrowserWindow.getFocusedWindow()
      if (item === null || item === undefined || window === null || !item.enabled) {
        throw new Error('撤销命令必须可用')
      }
      Reflect.apply(item.click, item, [item, window, {}])
    })
    await expect(editor).not.toContainText('中文😀')
    await application.evaluate((electronApi) => {
      const item = electronApi.Menu.getApplicationMenu()?.getMenuItemById('edit.redo')
      const window = electronApi.BrowserWindow.getFocusedWindow()
      if (item === null || item === undefined || window === null || !item.enabled) {
        throw new Error('重做命令必须可用')
      }
      Reflect.apply(item.click, item, [item, window, {}])
    })
    await expect(editor).toContainText('中文😀')
  } finally {
    await application.evaluate((electronApi) => electronApi.app.exit(0))
  }
})
