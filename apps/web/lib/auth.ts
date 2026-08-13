export const SESSION_COOKIE = "lunaris.session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  for (const part of cookies) {
    const [key, ...rest] = part.split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function isAuthenticated(): boolean {
  return Boolean(readCookie(SESSION_COOKIE));
}

export function clearSession(): void {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0`;
}