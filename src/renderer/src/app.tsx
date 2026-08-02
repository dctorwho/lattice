import { useRef, type JSX } from 'react'

import { useCommandController } from './commands/use-command-controller'
import { AppShell } from './components/app-shell'

export function App(): JSX.Element {
  const mainRef = useRef<HTMLElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const controller = useCommandController({ mainRef, sidebarRef })
  return (
    <AppShell locale="zh-CN" controller={controller} mainRef={mainRef} sidebarRef={sidebarRef} />
  )
}
