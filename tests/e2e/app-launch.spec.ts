import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('M1 launches the production Electron window with an editable source session', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('0 词')
    await expect(page.getByRole('status')).toContainText('UTF-8')
    await expect(page.getByRole('complementary', { name: '侧栏' })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('textbox')).toBeVisible()
    expect(new URL(page.url()).protocol).toBe('file:')
    const closed = page.waitForEvent('close', { timeout: 5_000 })
    await application.evaluate((electronApi) => {
      electronApi.BrowserWindow.getFocusedWindow()?.close()
    })
    await closed
  } finally {
    await application.close()
  }
})
