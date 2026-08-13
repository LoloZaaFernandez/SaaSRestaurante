import { describe, expect, it } from 'vitest'
import { nextCorrelativo } from './modules/invoices/correlativo.js'

describe('correlativo allocation', () => {
  it('starts an empty serie at 1', () => {
    expect(nextCorrelativo([])).toBe(1)
  })

  it('allocates max + 1 preserving gaps', () => {
    expect(nextCorrelativo([1, 2, 3])).toBe(4)
    expect(nextCorrelativo([1, 3])).toBe(4)
    expect(nextCorrelativo([5])).toBe(6)
  })

  it('is independent per serie (branch/serie rows are isolated)', () => {
    const boleta = [1, 2]
    const factura: number[] = []
    expect(nextCorrelativo(boleta)).toBe(3)
    expect(nextCorrelativo(factura)).toBe(1)
  })
})