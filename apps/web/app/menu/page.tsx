"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, type MenuCategory, type MenuItem, type ModifierGroup } from "@/lib/api";

type Tab = "items" | "categories" | "groups";
type ItemForm = { name: string; description: string; price: string; categoryId: string; active: boolean };
const emptyItem: ItemForm = { name: "", description: "", price: "", categoryId: "", active: true };

function formatPrice(value: string) {
  return Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [form, setForm] = useState<ItemForm>(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renamingCategoryName, setRenamingCategoryName] = useState("");
  const [groupForm, setGroupForm] = useState({ name: "", required: false, min: "0", max: "1" });
  const [assignedGroups, setAssignedGroups] = useState<Record<string, string[]>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function loadData() {
    setLoading(true);
    try {
      const [itemsData, categoriesData, groupsData] = await Promise.all([
        apiFetch<{ items: MenuItem[] }>("/menu/items?includeInactive=true"),
        apiFetch<{ categories: MenuCategory[] }>("/menu/categories"),
        apiFetch<{ modifierGroups: ModifierGroup[] }>("/menu/modifier-groups"),
      ]);
      const assignments = await Promise.all(itemsData.items.map(async (item) => {
        const data = await apiFetch<{ modifierGroupIds: string[] }>(`/menu/items/${item.id}/modifier-groups`);
        return [item.id, data.modifierGroupIds] as const;
      }));
      setItems(itemsData.items);
      setCategories(categoriesData.categories);
      setGroups(groupsData.modifierGroups);
      setAssignedGroups(Object.fromEntries(assignments));
      setError(null);
    } catch {
      setError("No se pudo cargar la configuración del menú.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function updateForm<K extends keyof ItemForm>(key: K, value: ItemForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateItem() {
    setEditingId(null);
    setForm({ ...emptyItem, categoryId: categories[0]?.id ?? "" });
    setShowItemForm(true);
  }

  function startEditing(item: MenuItem) {
    setTab("items");
    setEditingId(item.id);
    setForm({ name: item.name, description: item.description ?? "", price: item.price, categoryId: item.categoryId, active: item.active });
    setShowItemForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setShowItemForm(false);
    setForm({ ...emptyItem, categoryId: categories[0]?.id ?? "" });
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiFetch(`/menu/items/${editingId}`, { method: "PATCH", body: JSON.stringify({ name: form.name.trim(), price: form.price.replace(",", "."), active: form.active }) });
        setMessage("Ítem actualizado correctamente.");
      } else {
        await apiFetch("/menu/items", { method: "POST", body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, price: form.price.replace(",", "."), categoryId: form.categoryId, active: form.active }) });
        setMessage("Ítem creado correctamente.");
      }
      cancelEditing();
      await loadData();
    } catch {
      setError("No se pudo guardar el ítem. Revisa los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(item: MenuItem) {
    if (item.active && !window.confirm(`¿Desactivar "${item.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/menu/items/${item.id}`, { method: item.active ? "DELETE" : "PATCH", ...(item.active ? {} : { body: JSON.stringify({ active: true }) }) });
      setMessage(item.active ? "Ítem desactivado." : "Ítem activado.");
      await loadData();
    } catch {
      setError("No se pudo cambiar el estado del ítem.");
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    try {
      await apiFetch("/menu/categories", { method: "POST", body: JSON.stringify({ name, position: categories.length }) });
      setCategoryName("");
      setMessage("Categoría creada correctamente.");
      await loadData();
    } catch {
      setError("No se pudo crear la categoría.");
    }
  }

  function startRenaming(category: MenuCategory) {
    setRenamingCategoryId(category.id);
    setRenamingCategoryName(category.name);
  }

  async function renameCategory(event: FormEvent<HTMLFormElement>, category: MenuCategory) {
    event.preventDefault();
    const name = renamingCategoryName.trim();
    if (!name || name === category.name) { setRenamingCategoryId(null); return; }
    try {
      await apiFetch(`/menu/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setRenamingCategoryId(null);
      setMessage("Categoría renombrada correctamente.");
      await loadData();
    } catch {
      setError("No se pudo renombrar la categoría.");
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const min = Number(groupForm.min);
    const max = Number(groupForm.max);
    if (!groupForm.name.trim() || min < 0 || max < 1 || min > max) {
      setError("El grupo debe tener un nombre y un rango válido de opciones.");
      return;
    }
    try {
      await apiFetch("/menu/modifier-groups", { method: "POST", body: JSON.stringify({ name: groupForm.name.trim(), required: groupForm.required, min, max }) });
      setGroupForm({ name: "", required: false, min: "0", max: "1" });
      setMessage("Grupo modificador creado correctamente.");
      await loadData();
    } catch {
      setError("No se pudo crear el grupo modificador.");
    }
  }

  async function saveGroups(itemId: string) {
    try {
      await apiFetch(`/menu/items/${itemId}/modifier-groups`, { method: "PUT", body: JSON.stringify({ modifierGroupIds: assignedGroups[itemId] ?? [] }) });
      setMessage("Grupos modificadores asignados.");
    } catch {
      setError("No se pudieron asignar los grupos modificadores.");
    }
  }

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const visibleItems = useMemo(() => items.filter((item) => {
    const normalizedSearch = search.toLocaleLowerCase();
    const matchesSearch = item.name.toLocaleLowerCase().includes(normalizedSearch) || (item.description ?? "").toLocaleLowerCase().includes(normalizedSearch);
    const matchesCategory = categoryFilter === "all" || item.categoryId === categoryFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? item.active : !item.active);
    return matchesSearch && matchesCategory && matchesStatus;
  }), [items, search, categoryFilter, statusFilter]);
  const activeCount = items.filter((item) => item.active).length;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Catálogo</span><span className="text-xs text-stone-400">Actualizado en tiempo real</span></div><h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">Gestión de menú</h1><p className="mt-1 text-sm text-stone-500">Administra ítems, categorías y grupos modificadores.</p></div>
        <button type="button" onClick={openCreateItem} className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600">+ Nuevo ítem</button>
      </header>

      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-stone-500">Ítems totales</p><p className="mt-2 text-2xl font-semibold text-stone-900">{items.length}</p><p className="mt-1 text-xs text-stone-500">En tu catálogo</p></div><div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-stone-500">Ítems activos</p><p className="mt-2 text-2xl font-semibold text-emerald-600">{activeCount}</p><p className="mt-1 text-xs text-stone-500">Disponibles para pedidos</p></div><div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-stone-500">Categorías</p><p className="mt-2 text-2xl font-semibold text-stone-900">{categories.length}</p><p className="mt-1 text-xs text-stone-500">Organizan tu menú</p></div></div>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-stone-100 p-1" aria-label="Secciones del menú">
        {([ ["items", "Ítems"], ["categories", "Categorías"], ["groups", "Grupos modificadores"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${tab === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>{label}</button>)}
      </nav>

      {tab === "items" ? <>
        {showItemForm ? <form onSubmit={saveItem} className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-stone-900">{editingId ? "Editar ítem" : "Nuevo ítem"}</h2><p className="mt-1 text-xs text-stone-500">Completa los datos principales del producto.</p></div><button type="button" onClick={cancelEditing} className="text-sm text-stone-500 hover:text-stone-900">Cerrar</button></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium text-stone-700">Nombre<input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-medium text-stone-700">Descripción<input value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-medium text-stone-700">Precio<input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="Ej. 12.50" className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-medium text-stone-700">Categoría<select required disabled={Boolean(editingId)} value={form.categoryId} onChange={(event) => updateForm("categoryId", event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal disabled:bg-stone-100">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={form.active} onChange={(event) => updateForm("active", event.target.checked)} /> Disponible para pedidos</label><button type="submit" disabled={saving || !categories.length} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear ítem"}</button></div></form> : null}

        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-stone-900">Ítems del menú</h2><p className="mt-1 text-xs text-stone-500">{visibleItems.length} resultado{visibleItems.length === 1 ? "" : "s"} de {items.length}</p></div><div className="flex flex-wrap gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre" aria-label="Buscar ítem" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoría" className="rounded-lg border border-stone-300 px-3 py-2 text-sm"><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filtrar por estado" className="rounded-lg border border-stone-300 px-3 py-2 text-sm"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div></div></section>

        {loading ? <p className="rounded-xl border border-stone-200 bg-white px-5 py-10 text-center text-sm text-stone-500">Cargando menú…</p> : visibleItems.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center"><p className="font-medium text-stone-800">No encontramos ítems</p><p className="mt-1 text-sm text-stone-500">Prueba otro filtro o crea un nuevo producto.</p></div> : <ul className="grid gap-3 xl:grid-cols-2">{visibleItems.map((item) => <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-stone-900">{item.name}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{item.active ? "Activo" : "Inactivo"}</span></div>{item.description ? <p className="mt-1 line-clamp-2 text-sm text-stone-500">{item.description}</p> : null}<p className="mt-2 text-sm text-stone-500">{categoryNameById.get(item.categoryId) ?? "Sin categoría"}</p></div><p className="shrink-0 text-lg font-semibold text-stone-900">${formatPrice(item.price)}</p></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3"><div className="flex items-center gap-3"><button type="button" onClick={() => startEditing(item)} className="text-sm font-medium text-amber-700 hover:text-amber-800">Editar</button><button type="button" onClick={() => void toggleItem(item)} className="text-sm text-stone-500 hover:text-stone-800">{item.active ? "Desactivar" : "Activar"}</button></div><button type="button" onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">{expandedItemId === item.id ? "Ocultar grupos" : `Grupos (${assignedGroups[item.id]?.length ?? 0})`}</button></div>{expandedItemId === item.id ? <div className="mt-3 rounded-lg bg-stone-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Asignar grupos modificadores</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{groups.length ? groups.map((group) => <label key={group.id} className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={(assignedGroups[item.id] ?? []).includes(group.id)} onChange={(event) => setAssignedGroups((current) => ({ ...current, [item.id]: event.target.checked ? [...new Set([...(current[item.id] ?? []), group.id])] : (current[item.id] ?? []).filter((id) => id !== group.id) }))} />{group.name}</label>) : <span className="text-sm text-stone-500">Crea un grupo primero.</span>}</div>{groups.length ? <button type="button" onClick={() => void saveGroups(item.id)} className="mt-3 rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700">Guardar asignación</button> : null}</div> : null}</li>)}</ul>}
      </> : null}

      {tab === "categories" ? <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="font-semibold text-stone-900">Nueva categoría</h2><p className="mt-1 text-sm text-stone-500">Agrupa tus productos para encontrarlos fácilmente.</p></div><form onSubmit={createCategory} className="space-y-3"><label className="text-sm font-medium text-stone-700">Nombre<input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ej. Entradas" className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><button className="w-full rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-700">Crear categoría</button></form></div><div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="font-semibold text-stone-900">Categorías existentes</h2><p className="mt-1 text-sm text-stone-500">Puedes renombrarlas sin afectar sus ítems.</p></div><ul className="space-y-2">{categories.map((category) => <li key={category.id} className="rounded-lg border border-stone-100 bg-stone-50 p-3">{renamingCategoryId === category.id ? <form onSubmit={(event) => void renameCategory(event, category)} className="flex flex-wrap gap-2"><input autoFocus required value={renamingCategoryName} onChange={(event) => setRenamingCategoryName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" /><button className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white">Guardar</button><button type="button" onClick={() => setRenamingCategoryId(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">Cancelar</button></form> : <div className="flex items-center justify-between gap-3"><span className="font-medium text-stone-800">{category.name}</span><button type="button" onClick={() => startRenaming(category)} className="text-sm font-medium text-amber-700">Renombrar</button></div>}</li>)}</ul></div></section> : null}

      {tab === "groups" ? <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="font-semibold text-stone-900">Nuevo grupo modificador</h2><p className="mt-1 text-sm text-stone-500">Define cuántas opciones puede elegir el cliente.</p></div><form onSubmit={createGroup} className="space-y-4"><label className="text-sm font-medium text-stone-700">Nombre<input required value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="Ej. Extras" className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-stone-700">Mínimo<input required type="number" min="0" value={groupForm.min} onChange={(event) => setGroupForm({ ...groupForm, min: event.target.value })} className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-stone-700">Máximo<input required type="number" min="1" value={groupForm.max} onChange={(event) => setGroupForm({ ...groupForm, max: event.target.value })} className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label></div><label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={groupForm.required} onChange={(event) => setGroupForm({ ...groupForm, required: event.target.checked })} /> La selección es obligatoria</label><button className="w-full rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-700">Crear grupo</button></form></div><div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="font-semibold text-stone-900">Grupos existentes</h2><p className="mt-1 text-sm text-stone-500">Así aparecen cuando configuras un ítem.</p></div><ul className="space-y-2">{groups.map((group) => <li key={group.id} className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 p-3"><div><p className="font-medium text-stone-800">{group.name}</p><p className="mt-1 text-xs text-stone-500">Elige entre {group.min} y {group.max} opción{group.max === 1 ? "" : "es"}{group.required ? " · obligatorio" : " · opcional"}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs text-stone-500">{items.filter((item) => (assignedGroups[item.id] ?? []).includes(group.id)).length} ítems</span></li>)}</ul></div></section> : null}
    </section>
  );
}
