import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

async function clickNativeMenu(
  application: ElectronApplication,
  id: 'app.about' | 'view.toggleSidebar'
): Promise<void> {
  await application.evaluate((electronApi, commandId) => {
    const menu = electronApi.Menu.getApplicationMenu()
    if (menu === null) throw new Error('Expected the Lattice application menu')
    const item = menu.getMenuItemById(commandId)
    if (item === null) throw new Error(`Expected native menu item ${commandId}`)
    const window = electronApi.BrowserWindow.getFocusedWindow()
    if (window === null) throw new Error('Expected a focused Lattice window')
    Reflect.apply(item.click, item, [item, window, {}])
  }, id)
}

async function closeAbout(page: Page): Promise<void> {
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByRole('dialog', { name: '关于 Lattice' })).toHaveCount(0)
}

test('TC-M0-006 routes native menu, button, context menu, and shortcuts through the real shell', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    const page = await application.firstWindow()
    await page.waitForURL((url) => url.protocol === 'file:', { waitUntil: 'commit' })
    await page.bringToFront()
    const sidebar = page.getByRole('complementary', { name: '侧栏' })
    await expect(sidebar).toBeVisible()

    await page.getByRole('button', { name: '切换侧栏' }).click()
    await expect(sidebar).toHaveCount(0)
    await page.getByRole('button', { name: '切换侧栏' }).click()
    await expect(sidebar).toBeVisible()

    await page.getByRole('main').click({ button: 'right', position: { x: 24, y: 24 } })
    await expect(page.getByRole('menu', { name: '命令菜单' })).toBeVisible()
    await page.getByRole('menuitemcheckbox', { name: '切换侧栏' }).click()
    await expect(sidebar).toHaveCount(0)

    await page.keyboard.press('Control+Shift+L')
    await expect(sidebar).toBeVisible()

    await clickNativeMenu(application, 'view.toggleSidebar')
    await expect(sidebar).toHaveCount(0)

    await clickNativeMenu(application, 'app.about')
    const dialog = page.getByRole('dialog', { name: '关于 Lattice' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Lattice')
    await expect(dialog).toContainText('0.0.0')
    await expect(dialog).toContainText('win32')
    await expect(dialog).toContainText('1')
    await closeAbout(page)

    await page.keyboard.press('F1')
    await expect(dialog).toBeVisible()
    await closeAbout(page)
  } finally {
    await application.close()
  }
})
