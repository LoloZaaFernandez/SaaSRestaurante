import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Proxy same-origin hacia GET /analytics/report del backend (Fastify).
 *
 * Reenvía el query param `range` (today | week | month) y agrega el JWT de la
 * cookie de sesión como `Authorization: Bearer`. Mismo patrón que /api/dashboard.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get("range") ?? "today";

  try {
    const res = await fetch(`${API_BASE}/analytics/report?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { error: body.message ?? `El backend respondió ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el servidor." },
      { status: 503 },
    );
  }
}