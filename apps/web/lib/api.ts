export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: "Entradas" | "Principales" | "Postres" | "Bebidas";
  price: number;
  available: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`API ${path} respondió ${res.status}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Dashboard / Analytics
// Espeja la respuesta de GET /analytics/dashboard (módulo analytics de la API).
// Los montos viajan como string decimal ("12.90") para evitar errores de punto flotante.
// ---------------------------------------------------------------------------

export type DashboardTotals = {
  salesToday: string; // ventas del día (suma de payments)
  ordersToday: number; // pedidos creados hoy (sin cancelados)
  paidOrders: number; // pedidos pagados hoy (base del ticket promedio)
  avgTicket: string; // ventas / pedidos pagados
};

export type DashboardOccupancy = {
  total: number;
  free: number;
  occupied: number;
  reserved: number;
  cleaning: number;
};

export type TopItem = {
  menuItemId: string | null;
  name: string;
  quantitySold: number;
  revenue: string;
};

export type DashboardResponse = {
  date: string; // fecha (día local) a la que responden los KPIs
  totals: DashboardTotals;
  activeOrders: number; // pedidos abiertos en este momento
  occupancy: DashboardOccupancy;
  topItems: TopItem[];
};

/** Trae los KPIs del dashboard vía el route handler `/api/dashboard` (mismo origen). */
export async function getDashboard(): Promise<DashboardResponse> {
  // No se usa apiFetch a propósito: esa función antepone NEXT_PUBLIC_API_URL,
  // y acá queremos el proxy same-origin de Next que agrega la auth del usuario.
  const res = await fetch("/api/dashboard", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `El dashboard respondió ${res.status}`);
  }
  return (await res.json()) as DashboardResponse;
}

// ---------------------------------------------------------------------------
// Reporte con rango (P2): ventas por día, top ítems y hora pico
// Espeja la respuesta de GET /analytics/report.
// ---------------------------------------------------------------------------

export type ReportRange = "today" | "week" | "month";

export type ReportTotals = {
  totalSales: string;
  totalOrders: number;
  avgTicket: string;
};

export type DailySales = {
  day: string;
  totalSales: string;
  orderCount: number;
};

export type WeekdaySales = {
  weekday: number; // 1 = lunes … 7 = domingo (ISO)
  totalSales: string;
  orderCount: number;
};

export type PeakHour = {
  hour: number; // 0–23
  orderCount: number;
};

export type ReportResponse = {
  range: ReportRange;
  from: string;
  to: string;
  totals: ReportTotals;
  salesByDay: DailySales[];
  salesByWeekday: WeekdaySales[];
  topItems: TopItem[];
  peakHours: PeakHour[];
};

/** Trae el reporte agregado vía el route handler `/api/report` (mismo origen). */
export async function getReport(range: ReportRange): Promise<ReportResponse> {
  const res = await fetch(`/api/report?range=${range}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `El reporte respondió ${res.status}`);
  }
  return (await res.json()) as ReportResponse;
}