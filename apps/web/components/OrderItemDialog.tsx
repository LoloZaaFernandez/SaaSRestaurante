"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MenuItem, ModifierGroupDetail } from "@/lib/api";
import { effectiveMin, validateSelection } from "@/lib/cart";
import { formatAdjustment, formatCents, toCents } from "@/lib/money";

export const NOTES_MAX_LENGTH = 200;

export type ItemSelection = { modifierIds: string[]; notes: string; quantity: number };

type OrderItemDialogProps = {
  item: MenuItem;
  groups: ModifierGroupDetail[];
  onConfirm: (selection: ItemSelection) => void;
  onClose: () => void;
};

export default function OrderItemDialog({ item, groups, onConfirm, onClose }: OrderItemDialogProps) {
  const titleId = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [attempted, setAttempted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const problems = useMemo(() => validateSelection(groups, selected), [groups, selected]);

  const unitCents = useMemo(() => {
    const chosen = new Set(selected);
    const adjustment = groups
      .flatMap((group) => group.modifiers)
      .filter((modifier) => chosen.has(modifier.id))
      .reduce((acc, modifier) => acc + toCents(modifier.priceAdjustment), 0);
    return toCents(item.price) + adjustment;
  }, [groups, item.price, selected]);

  function toggle(group: ModifierGroupDetail, modifierId: string) {
    setSelected((prev) => {
      const inGroup = new Set(group.modifiers.map((modifier) => modifier.id));
      const isSelected = prev.includes(modifierId);
      if (group.max === 1) {
        const others = prev.filter((id) => !inGroup.has(id));
        if (isSelected) return effectiveMin(group) === 0 ? others : prev;
        return [...others, modifierId];
      }
      if (isSelected) return prev.filter((id) => id !== modifierId);
      const count = prev.filter((id) => inGroup.has(id)).length;
      return count >= group.max ? prev : [...prev, modifierId];
    });
  }

  function submit() {
    setAttempted(true);
    if (problems.length > 0) return;
    onConfirm({ modifierIds: selected, notes: notes.trim(), quantity });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl outline-none"
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 id={titleId} className="font-semibold text-stone-900">
            {item.name}
          </h2>
          <p className="text-xs text-stone-500">Precio base {formatCents(toCents(item.price))}</p>
        </div>

        <div className="space-y-5 px-5 py-4">
          {groups.map((group) => {
            const min = effectiveMin(group);
            const count = group.modifiers.filter((modifier) => selected.includes(modifier.id)).length;
            const invalid = attempted && (count < min || count > group.max);
            const single = group.max === 1;
            return (
              <fieldset key={group.id} className="space-y-2">
                <legend className="flex w-full items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-900">{group.name}</span>
                  <span className={`text-xs ${invalid ? "font-medium text-red-600" : "text-stone-500"}`}>
                    {min > 0 ? "Obligatorio · " : "Opcional · "}
                    {single ? "elegí 1" : `hasta ${group.max}${min > 0 ? `, mínimo ${min}` : ""}`}
                  </span>
                </legend>
                <ul className="space-y-1">
                  {group.modifiers.map((modifier) => {
                    const checked = selected.includes(modifier.id);
                    const atMax = !single && !checked && count >= group.max;
                    const adjustment = formatAdjustment(modifier.priceAdjustment);
                    return (
                      <li key={modifier.id}>
                        <label
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                            checked ? "border-amber-400 bg-amber-50" : "border-stone-200 hover:bg-stone-50"
                          } ${atMax ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type={single ? "radio" : "checkbox"}
                              name={`group-${group.id}`}
                              checked={checked}
                              disabled={atMax}
                              onChange={() => toggle(group, modifier.id)}
                              onClick={() => {
                                // un radio no se desmarca solo: permitimos quitar la opción en grupos opcionales
                                if (single && checked) toggle(group, modifier.id);
                              }}
                              className="h-4 w-4 accent-amber-500"
                            />
                            <span className="text-stone-900">{modifier.name}</span>
                          </span>
                          {adjustment && <span className="shrink-0 text-xs text-stone-600">{adjustment}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}

          <label className="block space-y-1">
            <span className="text-sm font-semibold text-stone-900">Nota para cocina</span>
            <textarea
              value={notes}
              maxLength={NOTES_MAX_LENGTH}
              rows={2}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ej.: sin cebolla, alergia a frutos secos"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <span className="block text-right text-xs text-stone-400">
              {notes.length}/{NOTES_MAX_LENGTH}
            </span>
          </label>

          {attempted && problems.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Menos cantidad"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-medium text-stone-900" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              aria-label="Más cantidad"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              +
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Agregar · {formatCents(unitCents * quantity)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
