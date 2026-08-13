export const TAX_RATE = 0.18

export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100)
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  return `${sign}${whole}.${fraction}`
}

export function addMoney(values: Array<string | number>): string {
  let total = 0
  for (const value of values) {
    total += toCents(value)
  }
  return fromCents(total)
}

export function multiplyByQuantity(value: string | number, quantity: number): string {
  return fromCents(toCents(value) * quantity)
}

export function applyTax(subtotal: string, taxRate = TAX_RATE): string {
  return fromCents(Math.round(toCents(subtotal) * taxRate))
}