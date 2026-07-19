import { _electron as electron, expect, test } from '@playwright/test'

test('M0-T02 launches and closes the production Electron window', async () => {
  const application = await electron.launch({ args: ['.'] })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    await expect(page.getByText('Project bootstrap ready')).toBeVisible()
  } finally {
    await application.close()
  }
})
