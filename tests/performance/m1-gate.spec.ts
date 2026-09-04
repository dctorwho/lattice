import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import {
  createDocumentSession,
  decodeSourceBuffer,
  encodeSourceBuffer
} from '../../src/domain/documents'
import { CodeMirrorDocumentController } from '../../src/renderer/src/editor/code-mirror-document-controller'

interface Measurement {
  readonly sizeMiB: number
  readonly openMs: number
  readonly inputMs: number
  readonly saveMs: number
}

describe('M1 数据安全与源码编辑器性能门禁（TC-M1-010）', () => {
  it('1/5/10 MiB 文档保持可编辑，5 MiB 满足预算，10 MiB 进入可接受降级范围', () => {
    const measurements: Measurement[] = []
    for (const sizeMiB of [1, 5, 10]) {
      const bytes = new TextEncoder().encode(
        '# 标题\n' +
          '正文 abcdefghijklmnopqrstuvwxyz\n'.repeat(Math.ceil((sizeMiB * 1024 * 1024) / 34))
      )
      const boundedBytes = bytes.slice(0, sizeMiB * 1024 * 1024)
      const openStarted = performance.now()
      const decoded = decodeSourceBuffer(boundedBytes, 'a'.repeat(64))
      if (decoded.status !== 'editable') throw new Error('性能夹具必须可编辑')
      const controller = new CodeMirrorDocumentController(
        createDocumentSession({
          id: `00000000-0000-4000-8000-0000000008${String(sizeMiB).padStart(2, '0')}`,
          path: null,
          buffer: decoded.buffer,
          diskVersion: null
        })
      )
      const openMs = performance.now() - openStarted
      const inputStarted = performance.now()
      controller.dispatch({ changes: { from: controller.state.doc.length, insert: '中' } })
      const inputMs = performance.now() - inputStarted
      const saveStarted = performance.now()
      const savedBytes = encodeSourceBuffer(controller.session.buffer)
      const saveMs = performance.now() - saveStarted
      expect(savedBytes.length).toBeGreaterThanOrEqual(boundedBytes.length)
      measurements.push({ sizeMiB, openMs, inputMs, saveMs })
    }

    const five = measurements.find((measurement) => measurement.sizeMiB === 5)
    const ten = measurements.find((measurement) => measurement.sizeMiB === 10)
    expect(five).toBeDefined()
    expect(ten).toBeDefined()
    if (five === undefined || ten === undefined) return
    expect(five.openMs).toBeLessThan(5_000)
    expect(five.inputMs).toBeLessThan(1_000)
    expect(five.saveMs).toBeLessThan(3_000)
    expect(ten.openMs).toBeLessThan(12_000)
    expect(ten.inputMs).toBeLessThan(2_000)
    expect(ten.saveMs).toBeLessThan(6_000)
    console.info('M1 性能测量', measurements)
  })
})
