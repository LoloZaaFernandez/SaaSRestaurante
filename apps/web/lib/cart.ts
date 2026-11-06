import type { MenuItem, Modifier, ModifierCatalog, ModifierGroupDetail } from "@/lib/api";
import { taxCents, toCents } from "@/lib/money";

/** Línea del carrito: sólo ids y datos escritos por el mesero; los precios se derivan del menú vigente. */
export type CartLine = {
  key: string;
  menuItemId: string;
  quantity: number;
  modifierIds: string[];
  notes: string;
};

export type PricedLine = {
  line: CartLine;
  item: MenuItem;
  modifiers: Modifier[];
  unitCents: number;
  lineCents: number;
};

export type CartTotals = { subtotalCents: number; taxCents: number; totalCents: number; itemCount: number };

export function newLineKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function groupsForItem(catalog: ModifierCatalog, menuItemId: string): ModifierGroupDetail[] {
  const ids = new Set(catalog.itemGroups[menuItemId] ?? []);
  return catalog.groups.filter((group) => ids.has(group.id));
}

/** Mínimo efectivo: un grupo obligatorio exige al menos una opción (misma regla que la API). */
export function effectiveMin(group: ModifierGroupDetail): number {
  return group.required ? Math.max(group.min, 1) : group.min;
}

/** Devuelve un mensaje por cada grupo que incumple su mínimo o máximo. */
export function validateSelection(groups: ModifierGroupDetail[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  const problems: string[] = [];
  for (const group of groups) {
    const count = group.modifiers.filter((modifier) => selected.has(modifier.id)).length;
    const min = effectiveMin(group);
    if (count < min) problems.push(`"${group.name}": elegí al menos ${min}.`);
    if (count > group.max) problems.push(`"${group.name}": elegí como máximo ${group.max}.`);
  }
  return problems;
}

export function priceLine(line: CartLine, item: MenuItem, catalog: ModifierCatalog): PricedLine {
  const byId = new Map<string, Modifier>();
  for (const group of catalog.groups) for (const modifier of group.modifiers) byId.set(modifier.id, modifier);
  const modifiers = line.modifierIds.flatMap((id) => {
    const modifier = byId.get(id);
    return modifier ? [modifier] : [];
  });
  const unitCents = toCents(item.price) + modifiers.reduce((acc, modifier) => acc + toCents(modifier.priceAdjustment), 0);
  return { line, item, modifiers, unitCents, lineCents: unitCents * line.quantity };
}

export function cartTotals(priced: PricedLine[]): CartTotals {
  const subtotalCents = priced.reduce((acc, entry) => acc + entry.lineCents, 0);
  const tax = taxCents(subtotalCents);
  return {
    subtotalCents,
    taxCents: tax,
    totalCents: subtotalCents + tax,
    itemCount: priced.reduce((acc, entry) => acc + entry.line.quantity, 0),
  };
}

/** Clave estable para fusionar líneas idénticas (mismo plato, mismos modificadores y misma nota). */
export function lineSignature(line: Pick<CartLine, "menuItemId" | "modifierIds" | "notes">): string {
  return JSON.stringify([line.menuItemId, [...line.modifierIds].sort(), line.notes.trim()]);
}

// ---------------------------------------------------------------------------
// Persistencia en localStorage (sin tokens, emails ni precios: sólo ids, cantidades y notas)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "lunaris.order-draft.v1";

export type OrderDraft = {
  branchId: string | null;
  tableId: string | null;
  waiterId: string | null;
  lines: Array<Omit<CartLine, "key">>;
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function loadDraft(): OrderDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<OrderDraft>;
    const lines = Array.isArray(data.lines) ? data.lines : [];
    return {
      branchId: isString(data.branchId) ? data.branchId : null,
      tableId: isString(data.tableId) ? data.tableId : null,
      waiterId: isString(data.waiterId) ? data.waiterId : null,
      lines: lines.flatMap((line) =>
        line &&
        isString(line.menuItemId) &&
        Number.isInteger(line.quantity) &&
        line.quantity > 0 &&
        Array.isArray(line.modifierIds) &&
        line.modifierIds.every(isString)
          ? [
              {
                menuItemId: line.menuItemId,
                quantity: line.quantity,
                modifierIds: line.modifierIds,
                notes: isString(line.notes) ? line.notes : "",
              },
            ]
          : [],
      ),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: OrderDraft): void {
  try {
    if (draft.lines.length === 0 && !draft.tableId && !draft.waiterId) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // almacenamiento no disponible (modo privado, cuota): el carrito sigue funcionando en memoria
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorado
  }
}
