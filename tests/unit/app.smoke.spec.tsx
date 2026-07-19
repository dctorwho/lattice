import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/renderer/src/app'

describe('M0-T02 renderer smoke', () => {
  it('renders the existing M0-T01 bootstrap status', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    expect(screen.getByText('Project bootstrap ready')).toBeVisible()
  })
})
