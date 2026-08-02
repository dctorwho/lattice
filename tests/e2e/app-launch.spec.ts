import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('M0-T05 launches and closes the production Electron window shell', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('工程基础已就绪')
    await expect(page.getByRole('complementary', { name: '侧栏' })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)
    expect(new URL(page.url()).protocol).toBe('file:')
  } finally {
    await application.close()
  }
})
