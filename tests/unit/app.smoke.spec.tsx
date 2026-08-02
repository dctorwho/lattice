import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/renderer/src/app'

describe('M0-T05 renderer shell smoke', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'lattice', {
      configurable: true,
      value: Object.freeze({
        app: Object.freeze({
          getInfo: () =>
            Promise.resolve({
              ok: true,
              value: {
                contractVersion: 1,
                name: 'Lattice',
                version: '0.0.0',
                platform: 'win32'
              }
            })
        }),
        commands: Object.freeze({
          onInvoke: () => () => {},
          updateStates: () =>
            Promise.resolve({ ok: true, value: { contractVersion: 1, applied: true } })
        })
      })
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'lattice')
  })

  it('renders the accessible non-editable foundation shell', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('工程基础已就绪')
    expect(screen.getByRole('complementary', { name: '侧栏' })).toBeVisible()
    expect(screen.getByRole('main')).toBeVisible()
    expect(screen.getByRole('status')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /打开|保存|导出/u })).not.toBeInTheDocument()
  })
})
