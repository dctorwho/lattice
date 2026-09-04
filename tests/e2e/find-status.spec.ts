import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('TC-M1-009 查找替换、非法正则与状态栏保持源码一致', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    const page = await application.firstWindow()
    const editor = page.locator('.cm-content')
    await editor.click()
    await page.keyboard.insertText('alpha alpha\n中文')
    await page.keyboard.press('Control+H')
    const panel = page.getByRole('region', { name: '替换' })
    await panel.getByRole('textbox', { name: '查找' }).fill('alpha')
    await panel.getByRole('textbox', { name: '替换为' }).fill('beta')
    await expect(panel).toContainText('2 个匹配项')
    await panel.getByRole('button', { name: '全部替换' }).click()
    await expect(editor).toContainText('beta beta')
    await page.keyboard.press('Control+Z')
    await expect(editor).toContainText('alpha alpha')

    await panel.getByLabel('正则表达式').check()
    await panel.getByRole('textbox', { name: '查找' }).fill('[')
    await expect(panel).toContainText('查找表达式无效')
    await expect(editor).toContainText('alpha alpha')
    await expect(page.locator('footer.status-bar')).toContainText('2 行')
  } finally {
    await application.evaluate((electronApi) => electronApi.app.exit(0))
  }
})
