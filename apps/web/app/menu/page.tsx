"use client";

import { useEffect, useState } from "react";
import MenuItemRow from "@/components/MenuItemRow";
import { apiFetch, type MenuItem } from "@/lib/api";

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: MenuItem[] }>("/menu/items")
      .then((data) => setItems(data.items))
      .catch(() => setError("No se pudo cargar el menú."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Gestión de Menú</h1>
        <p className="mt-1 text-sm text-stone-500">Categorías, ítems y precios del catálogo.</p>
      </header>

      {loading ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          Cargando menú…
        </p>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          No hay ítems en esta categoría.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <MenuItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
