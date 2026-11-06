import { clearSession, readCookie, SESSION_COOKIE } from "@/lib/auth";

export type MenuItem = {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  active: boolean;
  sortOrder: number;
};

export type MenuCategory = {
  id: string;
  tenantId: string;
  name: string;
  position: number;
};

export type ModifierGroup = {
  id: string;
  tenantId: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
};

export type Branch = {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
};

export type TableStatus = "free" | "occupied" | "reserved" | "cleaning";

export type RestaurantTable = {
  id: string;
  tenantId: string;
  branchId: string;
  label: string;
  seats: number;
  status: TableStatus;
  kind: "mesa" | "barra";
};

export type Modifier = {
  id: string;
  tenantId: string;
  groupId: string;
  name: string;
  priceAdjustment: string;
};

export type ModifierGroupDetail = ModifierGroup & { modifiers: Modifier[] };

export type ModifierCatalog = {
  groups: ModifierGroupDetail[];
  itemGroups: Record<string, string[]>;
};

export type StaffMember = {
  id: string;
  fullName: string;
  role: "owner" | "admin" | "waiter" | "kitchen" | "cashier";
};

export type OrderStatus = "open" | "paid" | "cancelled";

export type OrderItemDto = {
  id: string;
  orderId: string;
  menuItemId: string | null;
  name: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  modifiers: Array<{ modifierId: string; name: string; priceAdjustment: string }>;
  notes: string | null;
};

export type OrderDto = {
  id: string;
  branchId: string;
  tableId: string | null;
  status: OrderStatus;
  createdBy: string;
  waiterId: string | null;
  subtotal: string;
  tax: string;
  total: string;
  openedAt: string;
  closedAt: string | null;
  items: OrderItemDto[];
};

export type CreateOrderPayload = {
  branchId: string;
  tableId?: string | null;
  waiterId?: string;
  items: Array<{ menuItemId: string; quantity: number; modifiers: string[]; notes?: string }>;
};

export type AnalyticsPeriod = { from: string; to: string };

export type AnalyticsTableOccupancy = {
  total: number;
  occupied: number;
  free: number;
  reserved: number;
  cleaning: number;
};

export type AnalyticsDashboard = {
  period: AnalyticsPeriod;
  metrics: {
    salesToday: string;
    ordersToday: number;
    averageTicket: string;
    openOrders: number;
    tables: AnalyticsTableOccupancy;
  };
  topItems: Array<{ name: string; quantity: number; revenue: string }>;
};

export type AnalyticsDailySales = {
  date: string;
  sales: string;
  orders: number;
  payments: number;
};

export type AnalyticsReport = {
  period: AnalyticsPeriod;
  dailySales: AnalyticsDailySales[];
  topItems: Array<{ name: string; quantity: number; revenue: string }>;
  salesByHour: Array<{ hour: number; sales: string; orders: number }>;
  totals: { sales: string; orders: number; averageTicket: string };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Error de la API: conserva el estado HTTP y el `code`/`message` que devuelve el servidor. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function errorMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const token = readCookie(SESSION_COOKIE);
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  const res = await fetch(url, {
    ...init,
    headers,
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    let code: string | null = null;
    let message = `API ${path} respondió ${res.status}`;
    try {
      const body = (await res.json()) as { code?: unknown; message?: unknown };
      if (typeof body.code === "string") code = body.code;
      if (typeof body.message === "string" && body.message) message = body.message;
    } catch {
      // respuesta sin JSON: se conserva el mensaje genérico
    }
    throw new ApiError(message, res.status, code);
  }
  return (await res.json()) as T;
}
