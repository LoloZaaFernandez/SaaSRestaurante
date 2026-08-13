"use client";

import { useEffect, useState } from "react";
import MenuItemRow from "@/components/MenuItemRow";
import { apiFetch, type MenuItem } from "@/lib/api";

const CATEGORIES = ["Todos", "Entradas", "Principales", "Postres", "Bebidas"] as const;

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: MenuItem[] }>("/api/menu")
      .then((data) => setItems(data.items))
      .catch(() => setError("No se pudo cargar el menú."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = category === "Todos" ? items : items.filter((item) => item.category === category);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Gestión de Menú</h1>
        <p className="mt-1 text-sm text-stone-500">Categorías, ítems y precios del catálogo.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={
              cat === category
                ? "rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          Cargando menú…
        </p>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          No hay ítems en esta categoría.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <MenuItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}