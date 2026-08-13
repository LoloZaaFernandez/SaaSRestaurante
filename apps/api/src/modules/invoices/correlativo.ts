export function nextCorrelativo(existing: number[]): number {
  let max = 0
  for (const value of existing) {
    if (value > max) max = value
  }
  return max + 1
}