"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OrderHistory from "@/components/OrderHistory";
import OrderItemDialog, { type ItemSelection } from "@/components/OrderItemDialog";
import OrderReceipt, { shortOrderId } from "@/components/OrderReceipt";
import OrderSummary from "@/components/OrderSummary";
import {
  apiFetch,
  ApiError,
  errorMessage,
  type Branch,
  type CreateOrderPayload,
  type MenuCategory,
  type MenuItem,
  type ModifierCatalog,
  type OrderDto,
  type RestaurantTable,
  type StaffMember,
} from "@/lib/api";
import {
  cartTotals,
  clearDraft,
  groupsForItem,
  lineSignature,
  loadDraft,
  newLineKey,
  priceLine,
  saveDraft,
  validateSelection,
  type CartLine,
  type PricedLine,
} from "@/lib/cart";
import { formatCents, formatMoney, toCents } from "@/lib/money";

const TAKEAWAY = "__takeaway__";
const MAX_LINE_QUANTITY = 99;
const TABLE_STATUS_LABEL: Record<RestaurantTable["status"], string> = {
  free: "libre",
  occupied: "ocupada",
  reserved: "reservada",
  cleaning: "limpieza",
};

type Bootstrap = {
  branches: Branch[];
  items: MenuItem[];
  categories: MenuCategory[];
  catalog: ModifierCatalog;
  staff: StaffMember[];
};

type Confirmation = { order: OrderDto; estimateCents: number; tableLabel: string; waiterName: string };

export default function OrdersPage() {
  const [view, setView] = useState<"new" | "history">("new");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [tables, setTables] = useState<RestaurantTable[] | null>(null);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tableChoice, setTableChoice] = useState("");
  const [waiterId, setWaiterId] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);

  const [dialogItem, setDialogItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyToken, setHistoryToken] = useState(0);

  const hydrated = useRef(false);
  const submittingRef = useRef(false);
  const pendingTable = useRef<string | null>(null);

  // ---- carga inicial: sucursales, menú, modificadores, personal -------------------------------
  const bootstrap = useCallback(async () => {
    setLoadError(null);
    try {
      const [branches, items, categories, catalog, staff] = await Promise.all([
        apiFetch<{ branches: Branch[] }>("/branches"),
        apiFetch<{ items: MenuItem[] }>("/menu/items"),
        apiFetch<{ categories: MenuCategory[] }>("/menu/categories"),
        apiFetch<ModifierCatalog>("/menu/modifier-catalog"),
        apiFetch<{ users: StaffMember[] }>("/users"),
      ]);
      const loaded: Bootstrap = {
        branches: branches.branches,
        items: items.items.filter((item) => item.active),
        categories: categories.categories,
        catalog,
        staff: staff.users,
      };
      setData(loaded);
      restoreDraft(loaded);
    } catch (err) {
      setLoadError(errorMessage(err, "No se pudo cargar el menú."));
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  /** Restaura el borrador guardado (o los parámetros ?branchId&tableId de Mesas) validándolo contra datos vigentes. */
  function restoreDraft(loaded: Bootstrap) {
    const params = new URLSearchParams(window.location.search);
    const draft = loadDraft();
    const wantedBranch = params.get("branchId") ?? draft?.branchId ?? "";
    const branch = loaded.branches.find((b) => b.id === wantedBranch) ?? loaded.branches[0];
    setBranchId(branch?.id ?? "");

    const wantedTable = params.get("tableId") ?? draft?.tableId ?? "";
    pendingTable.current = wantedTable || null;

    if (draft?.waiterId && loaded.staff.some((s) => s.id === draft.waiterId && s.role === "waiter")) {
      setWaiterId(draft.waiterId);
    }

    if (draft && !params.get("branchId") && draft.lines.length > 0) {
      const itemsById = new Map(loaded.items.map((item) => [item.id, item]));
      const known = new Set(loaded.catalog.groups.flatMap((g) => g.modifiers.map((m) => m.id)));
      let dropped = 0;
      const restored: CartLine[] = [];
      for (const line of draft.lines) {
        const item = itemsById.get(line.menuItemId);
        const modifierIds = line.modifierIds.filter((id) => known.has(id));
        const valid =
          item &&
          modifierIds.length === line.modifierIds.length &&
          validateSelection(groupsForItem(loaded.catalog, item.id), modifierIds).length === 0;
        if (valid) restored.push({ ...line, key: newLineKey(), quantity: Math.min(line.quantity, MAX_LINE_QUANTITY) });
        else dropped += 1;
      }
      setLines(restored);
      setNotice(
        dropped > 0
          ? `Se recuperó tu pedido en curso. ${dropped} ítem(s) ya no están disponibles o cambiaron sus opciones y se quitaron.`
          : "Se recuperó tu pedido en curso.",
      );
    }
    hydrated.current = true;
  }

  // ---- mesas de la sucursal elegida ------------------------------------------------------------
  const loadTables = useCallback(async (forBranch: string) => {
    setTables(null);
    setTablesError(null);
    try {
      const result = await apiFetch<{ tables: RestaurantTable[] }>(`/tables?branchId=${encodeURIComponent(forBranch)}`);
      setTables(result.tables);
      // se lee fuera del updater: React puede ejecutarlo dos veces (StrictMode)
      const requested = pendingTable.current;
      pendingTable.current = null;
      setTableChoice((current) => {
        const wanted = requested ?? current;
        if (wanted === TAKEAWAY || result.tables.some((table) => table.id === wanted)) return wanted;
        return "";
      });
    } catch (err) {
      setTablesError(errorMessage(err, "No se pudieron cargar las mesas."));
    }
  }, []);

  useEffect(() => {
    if (branchId) void loadTables(branchId);
  }, [branchId, loadTables]);

  // ---- persistencia del borrador (sólo ids, cantidades y notas) ------------------------------------
  useEffect(() => {
    if (!hydrated.current) return;
    saveDraft({
      branchId: branchId || null,
      tableId: tableChoice || null,
      waiterId: waiterId || null,
      lines: lines.map(({ key: _key, ...rest }) => rest),
    });
  }, [branchId, tableChoice, waiterId, lines]);

  // ---- derivados ---------------------------------------------------------------------------------------
  const itemsById = useMemo(() => new Map((data?.items ?? []).map((item) => [item.id, item])), [data]);
  const priced = useMemo<PricedLine[]>(() => {
    if (!data) return [];
    return lines.flatMap((line) => {
      const item = itemsById.get(line.menuItemId);
      return item ? [priceLine(line, item, data.catalog)] : [];
    });
  }, [data, lines, itemsById]);
  const totals = useMemo(() => cartTotals(priced), [priced]);

  const waiters = useMemo(() => (data?.staff ?? []).filter((member) => member.role === "waiter"), [data]);
  const branch = data?.branches.find((b) => b.id === branchId);
  const selectedTable = tables?.find((table) => table.id === tableChoice);
  const tableLabel = tableChoice === TAKEAWAY ? "Para llevar" : (selectedTable?.label ?? "Sin mesa elegida");
  const waiterName = waiterId ? (waiters.find((w) => w.id === waiterId)?.fullName ?? "—") : "Yo (usuario actual)";

  const blockedReason = !branchId
    ? "Elegí una sucursal."
    : tables === null
      ? "Cargando mesas…"
      : tableChoice === ""
        ? "Elegí una mesa (o “Para llevar”) para confirmar."
        : null;

  const itemsByCategory = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    for (const item of data?.items ?? []) {
      const list = groups.get(item.categoryId) ?? [];
      list.push(item);
      groups.set(item.categoryId, list);
    }
    const ordered = [...(data?.categories ?? [])]
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      .flatMap((category) => {
        const list = groups.get(category.id);
        groups.delete(category.id);
        return list ? [{ id: category.id, name: category.name, items: list }] : [];
      });
    const rest = [...groups.values()].flat();
    return rest.length > 0 ? [...ordered, { id: "other", name: "Otros", items: rest }] : ordered;
  }, [data]);

  // ---- acciones sobre el carrito ---------------------------------------------------------------------
  function addLine(item: MenuItem, selection: ItemSelection) {
    setConfirmation(null);
    setNotice(null);
    setLines((prev) => {
      const candidate = { menuItemId: item.id, modifierIds: selection.modifierIds, notes: selection.notes };
      const signature = lineSignature(candidate);
      const existing = prev.find((line) => lineSignature(line) === signature);
      if (existing) {
        return prev.map((line) =>
          line.key === existing.key
            ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + selection.quantity) }
            : line,
        );
      }
      return [...prev, { key: newLineKey(), ...candidate, quantity: selection.quantity }];
    });
  }

  function handleAdd(item: MenuItem) {
    if (!data) return;
    if (groupsForItem(data.catalog, item.id).length > 0) setDialogItem(item);
    else addLine(item, { modifierIds: [], notes: "", quantity: 1 });
  }

  function changeQuantity(key: string, delta: number) {
    setLines((prev) =>
      prev.flatMap((line) => {
        if (line.key !== key) return [line];
        const quantity = Math.min(MAX_LINE_QUANTITY, line.quantity + delta);
        return quantity <= 0 ? [] : [{ ...line, quantity }];
      }),
    );
  }

  function changeNotes(key: string, notes: string) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, notes } : line)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  function resetOrder() {
    setLines([]);
    setTableChoice("");
    setWaiterId("");
    setSubmitError(null);
    setNotice(null);
    clearDraft();
  }

  // ---- confirmar pedido ---------------------------------------------------------------------------------
  async function confirmOrder() {
    if (submittingRef.current || blockedReason || priced.length === 0) return; // evita doble envío
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const payload: CreateOrderPayload = {
      branchId,
      tableId: tableChoice === TAKEAWAY ? null : tableChoice,
      ...(waiterId ? { waiterId } : {}),
      items: priced.map(({ line }) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        modifiers: line.modifierIds,
        ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
      })),
    };
    try {
      const result = await apiFetch<{ order: OrderDto }>("/orders", { method: "POST", body: JSON.stringify(payload) });
      setConfirmation({
        order: result.order,
        estimateCents: totals.totalCents,
        tableLabel,
        waiterName,
      });
      resetOrder();
      setHistoryToken((token) => token + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError(
          "No se pudo contactar con el servidor. Antes de reintentar, revisá el Historial: el pedido podría haberse registrado.",
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // ---- render ------------------------------------------------------------------------------------------------
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Toma de Pedido</h1>
          <p className="mt-1 text-sm text-stone-500">Elegí mesa, agregá ítems con sus opciones y confirmá el pedido.</p>
        </div>
        <div role="tablist" aria-label="Vista" className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
          {(
            [
              ["new", "Nuevo pedido"],
              ["history", "Historial"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === value ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void bootstrap()}
            className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      ) : !data ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          Cargando menú…
        </p>
      ) : data.branches.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
          No hay sucursales activas. Creá una sucursal para tomar pedidos.
        </p>
      ) : view === "history" ? (
        <OrderHistory branchId={branchId || null} tables={tables ?? []} staff={data.staff} refreshToken={historyToken} />
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-stone-700">Sucursal</span>
              <select
                value={branchId}
                disabled={submitting}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setTableChoice("");
                }}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
              >
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-stone-700">Mesa</span>
              <select
                value={tableChoice}
                disabled={submitting || tables === null}
                onChange={(event) => setTableChoice(event.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
              >
                <option value="">{tables === null && !tablesError ? "Cargando mesas…" : "Elegí una mesa…"}</option>
                <option value={TAKEAWAY}>Para llevar (sin mesa)</option>
                {(tables ?? []).map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label} · {table.seats} pers. · {TABLE_STATUS_LABEL[table.status]}
                  </option>
                ))}
              </select>
              {tablesError && (
                <span role="alert" className="block text-xs text-red-600">
                  {tablesError}{" "}
                  <button type="button" className="underline" onClick={() => void loadTables(branchId)}>
                    Reintentar
                  </button>
                </span>
              )}
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-stone-700">Mesero</span>
              <select
                value={waiterId}
                disabled={submitting}
                onChange={(event) => setWaiterId(event.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
              >
                <option value="">Yo (usuario actual)</option>
                {waiters.map((waiter) => (
                  <option key={waiter.id} value={waiter.id}>
                    {waiter.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {notice && (
            <p role="status" className="rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-800">
              {notice}
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              {itemsByCategory.length === 0 ? (
                <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
                  No hay ítems activos en el menú.
                </p>
              ) : (
                itemsByCategory.map((category) => (
                  <div key={category.id}>
                    <h2 className="mb-3 text-lg font-semibold text-stone-900">{category.name}</h2>
                    <ul className="space-y-2">
                      {category.items.map((item) => {
                        const customizable = groupsForItem(data.catalog, item.id).length > 0;
                        return (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-stone-900">{item.name}</p>
                              <p className="text-xs text-stone-500">
                                {formatMoney(item.price)}
                                {customizable && <span className="ml-2 text-amber-700">· con opciones</span>}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleAdd(item)}
                              className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                            >
                              {customizable ? "Elegir" : "Agregar"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4">
              {confirmation && (
                <ConfirmationCard confirmation={confirmation} onDismiss={() => setConfirmation(null)} />
              )}
              <OrderSummary
                lines={priced}
                totals={totals}
                context={`${branch?.name ?? "—"} · ${tableLabel} · Mesero: ${waiterName}`}
                submitting={submitting}
                error={submitError}
                blockedReason={blockedReason}
                onChangeQuantity={changeQuantity}
                onChangeNotes={changeNotes}
                onRemove={removeLine}
                onConfirm={() => void confirmOrder()}
                onCancel={resetOrder}
              />
            </div>
          </div>
        </>
      )}

      {dialogItem && data && (
        <OrderItemDialog
          item={dialogItem}
          groups={groupsForItem(data.catalog, dialogItem.id)}
          onClose={() => setDialogItem(null)}
          onConfirm={(selection) => {
            addLine(dialogItem, selection);
            setDialogItem(null);
          }}
        />
      )}
    </section>
  );
}

function ConfirmationCard({ confirmation, onDismiss }: { confirmation: Confirmation; onDismiss: () => void }) {
  const { order, estimateCents, tableLabel, waiterName } = confirmation;
  const mismatch = toCents(order.total) !== estimateCents;
  return (
    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-900">Pedido #{shortOrderId(order.id)} confirmado</p>
          <p className="text-xs text-emerald-800">Estos son los importes definitivos calculados por el servidor.</p>
        </div>
        <button type="button" onClick={onDismiss} className="text-xs text-emerald-800 underline">
          Cerrar
        </button>
      </div>
      {mismatch && (
        <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
          El total del servidor ({formatMoney(order.total)}) difiere de la estimación mostrada ({formatCents(estimateCents)}).
          Vale el del servidor.
        </p>
      )}
      <div className="mt-3 rounded-lg bg-white p-3">
        <OrderReceipt order={order} tableLabel={tableLabel} waiterName={waiterName} />
      </div>
    </div>
  );
}
