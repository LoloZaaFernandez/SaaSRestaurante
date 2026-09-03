"use client";

import { useEffect, useState } from "react";
import { apiFetch, type Branch, type Invoice, type Order, type Payment, type Shift } from "@/lib/api";

const METHODS = [
  ["cash", "Efectivo"], ["card", "Tarjeta"], ["transfer", "Transferencia"], ["yape", "Yape"], ["plin", "Plin"],
] as const;

function money(value: string | number) {
  return `S/ ${Number(value).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CajaPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [branchId, setBranchId] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>("cash");
  const [received, setReceived] = useState("");
  const [tip, setTip] = useState("0.00");
  const [receipt, setReceipt] = useState<"boleta" | "factura">("boleta");
  const [docNumber, setDocNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [openingCash, setOpeningCash] = useState("0.00");
  const [closingCash, setClosingCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function load() {
    Promise.all([
      apiFetch<{ branches: Branch[] }>("/branches"),
      apiFetch<{ orders: Order[] }>("/orders?status=open"),
    ]).then(([branchData, orderData]) => {
      setBranches(branchData.branches);
      setOrders(orderData.orders);
      const nextBranch = branchId || branchData.branches[0]?.id || orderData.orders[0]?.branchId || "";
      setBranchId(nextBranch);
      return apiFetch<{ shift: Shift | null }>(`/shifts/current${nextBranch ? `?branchId=${nextBranch}` : ""}`);
    }).then((data) => setShift(data.shift)).catch(() => setMessage("No se pudo cargar la información de Caja."));
  }

  useEffect(() => { load(); }, []);

  const totalDue = selected ? Number(selected.total) + Number(tip || 0) : 0;
  const change = method === "cash" ? Math.max(Number(received || 0) - totalDue, 0) : 0;

  async function openShift() {
    if (!branchId) return setMessage("Seleccioná una sucursal para abrir la caja.");
    setBusy(true); setMessage("");
    try { const data = await apiFetch<{ shift: Shift }>("/shifts", { method: "POST", body: JSON.stringify({ branchId, openingCash }) }); setShift(data.shift); }
    catch { setMessage("No se pudo abrir la caja."); } finally { setBusy(false); }
  }

  async function closeShift() {
    if (!shift || closingCash === "") return;
    setBusy(true); setMessage("");
    try { const data = await apiFetch<{ shift: Shift }>(`/shifts/${shift.id}/close`, { method: "POST", body: JSON.stringify({ closingCash }) }); setShift(data.shift); setMessage("Caja cerrada correctamente."); }
    catch { setMessage("No se pudo cerrar la caja."); } finally { setBusy(false); }
  }

  async function collect() {
    if (!selected || (method === "cash" && Number(received || 0) < totalDue)) return setMessage("El monto recibido no alcanza para cubrir el total.");
    if (receipt === "factura" && !docNumber.trim()) return setMessage("La factura requiere un RUC.");
    setBusy(true); setMessage("");
    let paymentCompleted = false;
    try {
      const payment = await apiFetch<{ payment: Payment }>(`/orders/${selected.id}/payments`, { method: "POST", body: JSON.stringify({ method, amount: selected.total, tip: tip || "0.00", amountReceived: method === "cash" ? received : null }) });
      paymentCompleted = true;
      const invoice = await apiFetch<{ invoice: Invoice }>("/invoices", { method: "POST", body: JSON.stringify({ orderId: selected.id, comprobanteType: receipt, customerDoc: receipt === "factura" ? "ruc" : docNumber ? "dni" : null, customerDocNumber: docNumber || null, customerName: customerName || null }) });
      setMessage(`Cobro confirmado. Comprobante ${invoice.invoice.serie}-${String(invoice.invoice.numero).padStart(8, "0")}. Vuelto: ${money(payment.payment.change ?? "0.00")}.`);
      setSelected(null); setReceived(""); setTip("0.00"); load();
    } catch { setMessage(paymentCompleted ? "Cobro confirmado, pero no se pudo emitir el comprobante. Verificá el estado del pedido antes de reintentar." : "No se pudo registrar el cobro. Verificá el estado del pedido."); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-6">
      <header><h1 className="text-2xl font-semibold text-stone-900">Caja</h1><p className="mt-1 text-sm text-stone-500">Cobros, comprobantes y arqueo del turno.</p></header>
      {message ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div> : null}

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="font-semibold text-stone-900">Turno de caja</h2><p className="mt-1 text-sm text-stone-500">Controlá el efectivo disponible de la sucursal.</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${shift?.closedAt ? "bg-stone-100 text-stone-600" : shift ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{shift?.closedAt ? "Cerrado" : shift ? "Abierto" : "Sin caja abierta"}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-stone-600">Sucursal<select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={Boolean(shift && !shift.closedAt)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          {!shift || shift.closedAt ? <><label className="text-sm text-stone-600">Monto inicial<input value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><button type="button" onClick={openShift} disabled={busy} className="self-end rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Abrir caja</button></> : <><label className="text-sm text-stone-600">Efectivo contado<input value={closingCash} onChange={(e) => setClosingCash(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><button type="button" onClick={closeShift} disabled={busy || closingCash === ""} className="self-end rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Cerrar y arquear</button></>}
        </div>
        {shift?.expectedTotal ? <p className="mt-3 text-sm text-stone-600">Total esperado: <strong>{money(shift.expectedTotal)}</strong> · Contado: {shift.closingCash ? money(shift.closingCash) : "pendiente"}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-stone-900">Pedidos pendientes de cobro</h2><div className="mt-4 space-y-2">{orders.length === 0 ? <p className="py-8 text-center text-sm text-stone-500">No hay pedidos abiertos.</p> : orders.map((order) => <button key={order.id} type="button" onClick={() => setSelected(order)} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${selected?.id === order.id ? "border-amber-400 bg-amber-50" : "border-stone-200 hover:border-amber-300"}`}><span><strong className="block text-sm text-stone-900">Pedido #{order.id.slice(0, 8)}</strong><span className="text-xs text-stone-500">{order.items.length} ítems</span></span><strong className="text-sm text-stone-900">{money(order.total)}</strong></button>)}</div></section>

        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-stone-900">Cobrar pedido</h2>{!selected ? <p className="py-10 text-center text-sm text-stone-500">Seleccioná un pedido para comenzar.</p> : <div className="mt-4 space-y-4"><div className="rounded-lg bg-stone-50 p-4"><div className="flex justify-between text-sm text-stone-600"><span>Total del pedido</span><strong className="text-lg text-stone-900">{money(selected.total)}</strong></div><label className="mt-3 block text-sm text-stone-600">Propina<input value={tip} onChange={(e) => setTip(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label><div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-sm font-semibold text-stone-900"><span>Total a cobrar</span><span>{money(totalDue)}</span></div></div>
          <div><p className="mb-2 text-sm font-medium text-stone-700">Método de pago</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{METHODS.map(([value, label]) => <button key={value} type="button" onClick={() => setMethod(value)} className={`rounded-lg border px-2 py-2 text-sm ${method === value ? "border-amber-400 bg-amber-50 text-amber-800" : "border-stone-300 text-stone-600"}`}>{label}</button>)}</div></div>
          {method === "cash" ? <div><label className="text-sm text-stone-600">Monto recibido<input value={received} onChange={(e) => setReceived(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label><p className="mt-2 text-right text-sm font-semibold text-emerald-700">Vuelto: {money(change)}</p></div> : null}
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-stone-600">Comprobante<select value={receipt} onChange={(e) => setReceipt(e.target.value as "boleta" | "factura")} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"><option value="boleta">Boleta (B001)</option><option value="factura">Factura (F001)</option></select></label><label className="text-sm text-stone-600">{receipt === "factura" ? "RUC" : "DNI"}<input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label></div><label className="block text-sm text-stone-600">Nombre / razón social<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label><button type="button" onClick={collect} disabled={busy || (method === "cash" && Number(received || 0) < totalDue)} className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Confirmar cobro y emitir comprobante</button>
        </div>}</section>
      </div>
    </section>
  );
}
