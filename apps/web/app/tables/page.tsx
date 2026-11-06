"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TableCard, { TABLE_LEGEND } from "@/components/TableCard";
import { apiFetch, errorMessage, type Branch, type RestaurantTable } from "@/lib/api";

export default function TablesPage() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [branchId, setBranchId] = useState("");
  const [tables, setTables] = useState<RestaurantTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setError(null);
    try {
      const result = await apiFetch<{ branches: Branch[] }>("/branches");
      setBranches(result.branches);
      setBranchId((current) => current || (result.branches[0]?.id ?? ""));
    } catch (err) {
      setError(errorMessage(err, "No se pudieron cargar las sucursales."));
    }
  }, []);

  const loadTables = useCallback(async (forBranch: string) => {
    setError(null);
    setTables(null);
    try {
      const result = await apiFetch<{ tables: RestaurantTable[] }>(`/tables?branchId=${encodeURIComponent(forBranch)}`);
      setTables(result.tables);
    } catch (err) {
      setError(errorMessage(err, "No se pudieron cargar las mesas."));
    }
  }, []);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (branchId) void loadTables(branchId);
  }, [branchId, loadTables]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Plano de Mesas</h1>
          <p className="mt-1 text-sm text-stone-500">Estado actual del salón, por mesa.</p>
        </div>
        <div className="flex items-center gap-2">
          {branches && branches.length > 1 && (
            <select
              aria-label="Sucursal"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => (branchId ? void loadTables(branchId) : void loadBranches())}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Actualizar
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-stone-200 bg-white px-5 py-3 shadow-sm">
        {TABLE_LEGEND.map((entry) => (
          <div key={entry.status} className="flex items-center gap-2 text-sm text-stone-600">
            <span className={`h-2.5 w-2.5 rounded-full ${entry.dotClass}`} aria-hidden="true" />
            {entry.label}
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </p>
      ) : branches && branches.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          No hay sucursales activas.
        </p>
      ) : tables === null ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          Cargando mesas…
        </p>
      ) : tables.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          Esta sucursal todavía no tiene mesas.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              label={table.label}
              seats={table.seats}
              status={table.status}
              orderHref={`/orders?branchId=${table.branchId}&tableId=${table.id}`}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-stone-400">
        Para cargar un pedido sin elegir mesa, usá <Link href="/orders" className="underline">Toma de Pedido</Link>.
      </p>
    </section>
  );
}
