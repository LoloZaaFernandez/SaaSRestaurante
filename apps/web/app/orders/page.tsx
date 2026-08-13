"use client";

import { useEffect, useState } from "react";
import OrderSummary, { type OrderLine } from "@/components/OrderSummary";
import { apiFetch, type MenuItem } from "@/lib/api";

export default function OrdersPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);

  useEffect(() => {
    apiFetch<{ items: MenuItem[] }>("/api/menu")
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  const menuItems = items.filter((item) => item.available);

  function addToOrder(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((line) => line.id === item.id);
      if (existing) {
        return prev.map((line) => (line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...prev, { id: item.id, name: item.name, unitPrice: item.price, quantity: 1 }];
    });
  }

  function handleChangeQuantity(id: string, delta: number) {
    setLines((prev) =>
      prev.flatMap((line) => {
        if (line.id !== id) return [line];
        const quantity = line.quantity + delta;
        return quantity <= 0 ? [] : [{ ...line, quantity }];
      }),
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Toma de Pedido</h1>
        <p className="mt-1 text-sm text-stone-500">Elegí los ítems del menú y confirmá el pedido.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">Ítems del menú</h2>
          {menuItems.length === 0 ? (
            <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
              Cargando menú…
            </p>
          ) : (
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{item.name}</p>
                    <p className="text-xs text-stone-500">${item.price.toLocaleString("es-AR")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToOrder(item)}
                    className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                  >
                    Agregar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <OrderSummary lines={lines} onChangeQuantity={handleChangeQuantity} />
      </div>
    </section>
  );
}