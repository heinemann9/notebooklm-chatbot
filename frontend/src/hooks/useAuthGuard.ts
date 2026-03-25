"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthStatus } from "@/lib/api";

export function useAuthGuard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (!status.authenticated) {
          router.replace("/login");
        } else {
          setAuthenticated(true);
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setChecking(false));
  }, [router]);

  return { checking, authenticated };
}
