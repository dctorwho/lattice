import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('M0-T02 launches and closes the production Electron window', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    await expect(page.getByText('Project bootstrap ready')).toBeVisible()
    expect(new URL(page.url()).protocol).toBe('file:')
  } finally {
    await application.close()
  }
})
