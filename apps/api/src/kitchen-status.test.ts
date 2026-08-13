import { describe, expect, it } from 'vitest'
import { canTransition, KITCHEN_FLOW } from './modules/orders/kitchen-status.js'

describe('kitchen status transition matrix', () => {
  it('advances strictly one step at a time', () => {
    expect(canTransition('pending', 'preparing')).toBe(true)
    expect(canTransition('preparing', 'ready')).toBe(true)
    expect(canTransition('ready', 'served')).toBe(true)
  })

  it('rejects jumps', () => {
    expect(canTransition('pending', 'ready')).toBe(false)
    expect(canTransition('pending', 'served')).toBe(false)
    expect(canTransition('preparing', 'served')).toBe(false)
    expect(canTransition('preparing', 'preparing')).toBe(false)
  })

  it('rejects backwards moves and unknown states', () => {
    expect(canTransition('served', 'ready')).toBe(false)
    expect(canTransition('served', 'preparing')).toBe(false)
    expect(canTransition('ready', 'pending')).toBe(false)
  })

  it('defines the full expected flow', () => {
    expect(KITCHEN_FLOW).toEqual(['pending', 'preparing', 'ready', 'served'])
  })
})