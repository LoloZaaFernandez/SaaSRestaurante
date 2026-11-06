"use client";

import { useState } from "react";
import type { CartTotals, PricedLine } from "@/lib/cart";
import { formatAdjustment, formatCents } from "@/lib/money";
import { NOTES_MAX_LENGTH } from "@/components/OrderItemDialog";

type OrderSummaryProps = {
  lines: PricedLine[];
  totals: CartTotals;
  /** Texto de contexto: sucursal · mesa · mesero */
  context: string;
  submitting: boolean;
  error: string | null;
  /** Motivo por el que no se puede confirmar todavía (p. ej. falta elegir mesa). */
  blockedReason: string | null;
  onChangeQuantity: (key: string, delta: number) => void;
  onChangeNotes: (key: string, notes: string) => void;
  onRemove: (key: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function OrderSummary({
  lines,
  totals,
  context,
  submitting,
  error,
  blockedReason,
  onChangeQuantity,
  onChangeNotes,
  onRemove,
  onConfirm,
  onCancel,
}: OrderSummaryProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const empty = lines.length === 0;

  function showNotes(key: string) {
    setOpenNotes((prev) => new Set(prev).add(key));
  }

  return (
    <aside className="rounded-xl border border-stone-200 bg-white shadow-sm" aria-busy={submitting}>
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="font-semibold text-stone-900">Pedido en curso</h2>
        <p className="text-xs text-stone-500">{context}</p>
      </div>

      <ul className="divide-y divide-stone-100 px-5">
        {empty ? (
          <li className="py-6 text-center text-sm text-stone-400">Sin ítems todavía.</li>
        ) : (
          lines.map(({ line, item, modifiers, unitCents, lineCents }) => {
            const notesVisible = line.notes !== "" || openNotes.has(line.key);
            return (
              <li key={line.key} className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{item.name}</p>
                    {modifiers.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {modifiers.map((modifier) => (
                          <li key={modifier.id} className="text-xs text-stone-500">
                            + {modifier.name}
                            {formatAdjustment(modifier.priceAdjustment) && (
                              <span className="ml-1 text-stone-400">({formatAdjustment(modifier.priceAdjustment)})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-0.5 text-xs text-stone-500">{formatCents(unitCents)} c/u</p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-semibold text-stone-900">
                    {formatCents(lineCents)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => onChangeQuantity(line.key, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-300 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 disabled:opacity-50"
                      aria-label={`Quitar uno de ${item.name}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-stone-900">{line.quantity}</span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => onChangeQuantity(line.key, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                      aria-label={`Agregar uno de ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {!notesVisible && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => showNotes(line.key)}
                        className="text-amber-700 hover:underline disabled:opacity-50"
                      >
                        + Nota
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => onRemove(line.key)}
                      className="text-stone-500 hover:text-red-600 hover:underline disabled:opacity-50"
                      aria-label={`Eliminar ${item.name} del pedido`}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {notesVisible && (
                  <input
                    type="text"
                    value={line.notes}
                    disabled={submitting}
                    maxLength={NOTES_MAX_LENGTH}
                    onChange={(event) => onChangeNotes(line.key, event.target.value)}
                    placeholder="Nota para cocina (ej. sin cebolla)"
                    aria-label={`Nota para ${item.name}`}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:bg-stone-50"
                  />
                )}
              </li>
            );
          })
        )}
      </ul>

      <div className="border-t border-stone-100 px-5 py-4">
        <dl className="space-y-1 text-sm">
          <div className="flex items-center justify-between text-stone-500">
            <dt>{totals.itemCount} ítems · Subtotal</dt>
            <dd>{formatCents(totals.subtotalCents)}</dd>
          </div>
          <div className="flex items-center justify-between text-stone-500">
            <dt>IGV (18 %)</dt>
            <dd>{formatCents(totals.taxCents)}</dd>
          </div>
          <div className="flex items-center justify-between pt-1 text-stone-900">
            <dt className="font-medium">Total estimado</dt>
            <dd className="text-lg font-semibold">{formatCents(totals.totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-1 text-xs text-stone-400">El total definitivo lo calcula el servidor al confirmar.</p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {blockedReason && !empty && <p className="mt-3 text-xs text-amber-700">{blockedReason}</p>}

        {confirmingCancel ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-sm text-stone-700">¿Vaciar el pedido en curso?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingCancel(false);
                  setOpenNotes(new Set());
                  onCancel();
                }}
                className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Sí, vaciar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Seguir editando
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={empty || submitting || blockedReason !== null}
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Enviando…" : "Confirmar pedido"}
            </button>
            <button
              type="button"
              disabled={empty || submitting}
              onClick={() => setConfirmingCancel(true)}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
