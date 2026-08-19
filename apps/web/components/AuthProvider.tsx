"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const authed = isAuthenticated();
    if (pathname !== "/login" && !authed) {
      router.replace("/login");
    } else if (pathname === "/login" && authed) {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  return <>{children}</>;
}