import { describe, expect, it } from 'vitest'
import { addMoney, applyTax, fromCents, multiplyByQuantity, toCents } from './shared/money.js'

describe('money helpers', () => {
  it('converts decimal strings to cents without float drift', () => {
    expect(toCents('12.50')).toBe(1250)
    expect(toCents('0.10')).toBe(10)
    expect(toCents('29.5')).toBe(2950)
  })

  it('formats cents back to two-decimal strings', () => {
    expect(fromCents(1250)).toBe('12.50')
    expect(fromCents(4)).toBe('0.04')
    expect(fromCents(-550)).toBe('-5.50')
  })

  it('sums money in cents', () => {
    expect(addMoney(['12.50', '12.50', '4.50'])).toBe('29.50')
    expect(addMoney(['0.05', '0.05', '0.05'])).toBe('0.15')
  })

  it('multiplies unit prices by quantity', () => {
    expect(multiplyByQuantity('12.50', 2)).toBe('25.00')
    expect(multiplyByQuantity('0.50', 3)).toBe('1.50')
  })

  it('applies a flat 18% tax rounded to cents', () => {
    expect(applyTax('25.00')).toBe('4.50')
    expect(applyTax('1.00')).toBe('0.18')
    expect(applyTax('3.33')).toBe('0.60')
    expect(applyTax('24.00')).toBe('4.32')
  })
})