/** Misma tasa y redondeo que la API (apps/api/src/shared/money.ts) para que la estimación coincida. */
export const TAX_RATE = 0.18;

export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function taxCents(subtotalCents: number): number {
  return Math.round(subtotalCents * TAX_RATE);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMoney(value: string | number): string {
  return formatCents(toCents(value));
}

/** Ajuste de precio con signo explícito, p. ej. "+$1,50". Devuelve null si es cero. */
export function formatAdjustment(value: string | number): string | null {
  const cents = toCents(value);
  if (cents === 0) return null;
  return `${cents > 0 ? "+" : "−"}${formatCents(Math.abs(cents))}`;
}
