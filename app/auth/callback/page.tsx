"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      const code = params.get("code");
      const error = params.get("error");

      if (error) {
        router.replace("/login");
        return;
      }

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      router.replace("/dashboard");
    })();
  }, [params, router]);

  return <div style={{ padding: 40 }}>Signing you in…</div>;
}
