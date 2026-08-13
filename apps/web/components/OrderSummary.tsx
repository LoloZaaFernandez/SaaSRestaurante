"use client";

export type OrderLine = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type OrderSummaryProps = {
  lines: OrderLine[];
  onChangeQuantity: (id: string, delta: number) => void;
};

export default function OrderSummary({ lines, onChangeQuantity }: OrderSummaryProps) {
  const itemCount = lines.reduce((acc, line) => acc + line.quantity, 0);
  const total = lines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0);

  return (
    <aside className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="font-semibold text-stone-900">Pedido en curso</h2>
        <p className="text-xs text-stone-500">Mesa 4 · Mozo: Carlos</p>
      </div>

      <ul className="divide-y divide-stone-100 px-5">
        {lines.length === 0 ? (
          <li className="py-6 text-center text-sm text-stone-400">Sin ítems todavía.</li>
        ) : (
          lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-900">{line.name}</p>
                <p className="text-xs text-stone-500">${line.unitPrice.toLocaleString("es-AR")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangeQuantity(line.id, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-300 text-sm font-semibold text-stone-600 transition hover:bg-stone-100"
                  aria-label={`Quitar uno de ${line.name}`}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-medium text-stone-900">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => onChangeQuantity(line.id, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                  aria-label={`Agregar uno de ${line.name}`}
                >
                  +
                </button>
              </div>
              <span className="w-20 shrink-0 text-right text-sm font-semibold text-stone-900">
                ${(line.unitPrice * line.quantity).toLocaleString("es-AR")}
              </span>
            </li>
          ))
        )}
      </ul>

      <div className="border-t border-stone-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">{itemCount} ítems</span>
          <span className="text-lg font-semibold text-stone-900">${total.toLocaleString("es-AR")}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={lines.length === 0}
            className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar pedido
          </button>
          <button
            type="button"
            disabled={lines.length === 0}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </aside>
  );
}