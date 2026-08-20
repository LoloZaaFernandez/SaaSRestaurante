import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son obligatorios." }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const apiResponse = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch(() => null);

  if (!apiResponse) {
    return NextResponse.json({ error: "No se pudo conectar con la API." }, { status: 503 });
  }

  const data = (await apiResponse.json().catch(() => ({}))) as {
    token?: string;
    user?: unknown;
    message?: string;
  };

  if (!apiResponse.ok || !data.token) {
    return NextResponse.json(
      { error: data.message ?? "Credenciales inválidas." },
      { status: apiResponse.status || 401 },
    );
  }

  const { token, user } = data;
  const response = NextResponse.json({ token, user });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
