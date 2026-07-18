import type { JSX } from 'react'

export function App(): JSX.Element {
  return (
    <main className="bootstrap-shell">
      <section className="bootstrap-card" aria-labelledby="bootstrap-title">
        <p className="bootstrap-kicker">Electron + React + TypeScript</p>
        <h1 id="bootstrap-title">Lattice</h1>
        <p>Project bootstrap ready</p>
      </section>
    </main>
  )
}
