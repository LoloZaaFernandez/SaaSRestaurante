"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage, type OrderDto, type OrderStatus, type RestaurantTable, type StaffMember } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import OrderReceipt, { shortOrderId } from "@/components/OrderReceipt";

const STATUS_FILTERS: Array<{ value: OrderStatus; label: string }> = [
  { value: "open", label: "Abiertos" },
  { value: "paid", label: "Pagados" },
  { value: "cancelled", label: "Cancelados" },
];

const STATUS_BADGE: Record<OrderStatus, string> = {
  open: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-stone-200 text-stone-600",
};

type OrderHistoryProps = {
  branchId: string | null;
  tables: RestaurantTable[];
  staff: StaffMember[];
  /** Cambia cuando se confirma un pedido nuevo, para refrescar el listado. */
  refreshToken: number;
};

export default function OrderHistory({ branchId, tables, staff, refreshToken }: OrderHistoryProps) {
  const [status, setStatus] = useState<OrderStatus>("open");
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setOrders(null);
    try {
      const params = new URLSearchParams({ status, limit: "50" });
      if (branchId) params.set("branchId", branchId);
      const data = await apiFetch<{ orders: OrderDto[] }>(`/orders?${params.toString()}`);
      setOrders(data.orders);
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar el historial."));
    }
  }, [status, branchId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const tableLabel = (id: string | null) =>
    id ? (tables.find((table) => table.id === id)?.label ?? "Mesa desconocida") : "Para llevar";
  const staffName = (id: string | null) => (id ? (staff.find((member) => member.id === id)?.fullName ?? "—") : "—");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por estado" className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={status === filter.value}
              onClick={() => setStatus(filter.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                status === filter.value ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          Actualizar
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </p>
      ) : orders === null ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          Cargando pedidos…
        </p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          No hay pedidos {STATUS_FILTERS.find((f) => f.value === status)?.label.toLowerCase()}.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            return (
              <li key={order.id} className="rounded-xl border border-stone-200 bg-white shadow-sm">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">
                      #{shortOrderId(order.id)} · {tableLabel(order.tableId)}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {new Date(order.openedAt).toLocaleString("es-AR")} · {order.items.reduce((n, i) => n + i.quantity, 0)} ítems ·
                      Mesero: {staffName(order.waiterId)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[order.status]}`}>
                      {STATUS_FILTERS.find((f) => f.value === order.status)?.label.replace(/s$/, "")}
                    </span>
                    <span className="text-sm font-semibold text-stone-900">{formatMoney(order.total)}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-stone-100 px-4 py-3">
                    <OrderReceipt order={order} tableLabel={tableLabel(order.tableId)} waiterName={staffName(order.waiterId)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
