import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

/**
 * Login proxy hacia POST /auth/login del backend (Fastify).
 *
 * Antes esto devolvía un token falso (`mock-...`) que el backend rechaza. Ahora
 * se delega en la API real y la cookie de sesión guarda el JWT válido, que es el
 * que el dashboard usa para pedir métricas. Se mantiene `httpOnly: false` para no
 * romper los guardas de ruta del cliente (isAuthenticated); el token no se expone
 * en la UI.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son obligatorios." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el servidor. Reintentá en unos segundos." },
      { status: 503 },
    );
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      { error: data.message ?? "Credenciales inválidas." },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { token: string; user: { email: string; role: string } };

  const response = NextResponse.json({ token: data.token, user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
