"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, type MenuCategory, type MenuItem, type ModifierGroup } from "@/lib/api";

type ItemForm = { name: string; description: string; price: string; categoryId: string; active: boolean };

const emptyItem: ItemForm = { name: "", description: "", price: "", categoryId: "", active: true };

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [form, setForm] = useState<ItemForm>(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  useEffect(() => {
    void loadData();
  }, []);

  function updateForm<K extends keyof ItemForm>(key: K, value: ItemForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(item: MenuItem) {
    setEditingId(item.id);
    setForm({ name: item.name, description: item.description ?? "", price: item.price, categoryId: item.categoryId, active: item.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm({ ...emptyItem, categoryId: categories[0]?.id ?? "" });
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiFetch(`/menu/items/${editingId}`, { method: "PATCH", body: JSON.stringify({ name: form.name.trim(), price: form.price, active: form.active }) });
        setMessage("Ítem actualizado correctamente.");
      } else {
        await apiFetch("/menu/items", { method: "POST", body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, price: form.price, categoryId: form.categoryId, active: form.active }) });
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
    if (!name || name === category.name) {
      setRenamingCategoryId(null);
      return;
    }
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
    const matchesSearch = item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    const matchesCategory = categoryFilter === "all" || item.categoryId === categoryFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? item.active : !item.active);
    return matchesSearch && matchesCategory && matchesStatus;
  }), [items, search, categoryFilter, statusFilter]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Gestión de Menú</h1>
        <p className="mt-1 text-sm text-stone-500">Administra ítems, categorías y grupos modificadores.</p>
      </header>

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      <form onSubmit={saveItem} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-stone-900">{editingId ? "Editar ítem" : "Crear ítem"}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Nombre" aria-label="Nombre del ítem" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <input value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Descripción" aria-label="Descripción del ítem" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="Precio (ej. 12.50)" aria-label="Precio del ítem" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <select required disabled={Boolean(editingId)} value={form.categoryId} onChange={(event) => updateForm("categoryId", event.target.value)} aria-label="Categoría del ítem" className="rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-100">
            <option value="">Selecciona categoría</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={form.active} onChange={(event) => updateForm("active", event.target.checked)} /> Activo</label>
          <div className="flex gap-2"><button type="submit" disabled={saving || !categories.length} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear ítem"}</button>{editingId ? <button type="button" onClick={cancelEditing} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Cancelar</button> : null}</div>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-stone-900">Categorías</h2><form onSubmit={createCategory} className="mt-3 flex gap-2"><input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nueva categoría" aria-label="Nueva categoría" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" /><button className="rounded-lg bg-stone-800 px-3 py-2 text-sm font-medium text-white">Crear</button></form><ul className="mt-4 space-y-2">{categories.map((category) => <li key={category.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">{renamingCategoryId === category.id ? <form onSubmit={(event) => void renameCategory(event, category)} className="flex gap-2"><input autoFocus required value={renamingCategoryName} onChange={(event) => setRenamingCategoryName(event.target.value)} className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1" /><button className="text-amber-700">Guardar</button><button type="button" onClick={() => setRenamingCategoryId(null)} className="text-stone-500">Cancelar</button></form> : <div className="flex items-center justify-between"><span>{category.name}</span><button type="button" onClick={() => startRenaming(category)} className="text-amber-700">Renombrar</button></div>}</li>)}</ul></section>
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-stone-900">Grupos modificadores</h2><form onSubmit={createGroup} className="mt-3 grid gap-3 sm:grid-cols-2"><input required value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="Nombre del grupo" aria-label="Nombre del grupo" className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2" /><label className="text-sm text-stone-600">Mínimo<input required type="number" min="0" value={groupForm.min} onChange={(event) => setGroupForm({ ...groupForm, min: event.target.value })} className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><label className="text-sm text-stone-600">Máximo<input required type="number" min="1" value={groupForm.max} onChange={(event) => setGroupForm({ ...groupForm, max: event.target.value })} className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={groupForm.required} onChange={(event) => setGroupForm({ ...groupForm, required: event.target.checked })} /> Obligatorio</label><button className="rounded-lg bg-stone-800 px-3 py-2 text-sm font-medium text-white">Crear grupo</button></form><ul className="mt-4 space-y-2">{groups.map((group) => <li key={group.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">{group.name} · {group.min}–{group.max} opciones{group.required ? " · obligatorio" : ""}</li>)}</ul></section>
      </div>

      <section><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold text-stone-900">Ítems del menú <span className="text-sm font-normal text-stone-500">({visibleItems.length})</span></h2><div className="flex flex-wrap gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ítem" aria-label="Buscar ítem" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoría" className="rounded-lg border border-stone-300 px-3 py-2 text-sm"><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filtrar por estado" className="rounded-lg border border-stone-300 px-3 py-2 text-sm"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div></div>{loading ? <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">Cargando…</p> : visibleItems.length === 0 ? <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">No hay ítems con esos filtros.</p> : <ul className="space-y-3">{visibleItems.map((item) => <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="font-medium text-stone-900">{item.name}</p>{item.description ? <p className="mt-1 text-sm text-stone-500">{item.description}</p> : null}<p className="mt-1 text-sm text-stone-500">{categoryNameById.get(item.categoryId) ?? "Sin categoría"} · ${Number(item.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p></div><div className="flex shrink-0 flex-wrap items-center gap-3"><span className={`rounded-full px-2 py-1 text-xs ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>{item.active ? "Activo" : "Inactivo"}</span><button type="button" onClick={() => startEditing(item)} className="text-sm text-amber-700">Editar</button><button type="button" onClick={() => void toggleItem(item)} className="text-sm text-stone-600">{item.active ? "Desactivar" : "Activar"}</button><button type="button" onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">{expandedItemId === item.id ? "Ocultar grupos" : "Configurar grupos"}</button></div></div>{expandedItemId === item.id ? <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3 text-sm text-stone-600">{groups.length ? groups.map((group) => <label key={group.id} className="flex items-center gap-1"><input type="checkbox" checked={(assignedGroups[item.id] ?? []).includes(group.id)} onChange={(event) => setAssignedGroups((current) => ({ ...current, [item.id]: event.target.checked ? [...new Set([...(current[item.id] ?? []), group.id])] : (current[item.id] ?? []).filter((id) => id !== group.id) }))} />{group.name}</label>) : <span>No hay grupos modificadores.</span>}{groups.length ? <button type="button" onClick={() => void saveGroups(item.id)} className="rounded-md border border-amber-300 px-3 py-1 text-amber-700">Guardar grupos</button> : null}</div> : null}</li>)}</ul>}</section>
    </section>
  );
}
