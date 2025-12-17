"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseclient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    (async () => {
      try {
        const code = params.get("code");
        const error = params.get("error");

        // If Supabase sent an error, bail out
        if (error) {
          router.replace("/login");
          return;
        }

        // Exchange magic-link code for a session
        if (code) {
          const { error: exchangeErr } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeErr) {
            router.replace("/login");
            return;
          }
        }

        // Get the logged-in user
        const { data: userRes, error: userErr } =
          await supabase.auth.getUser();

        if (userErr || !userRes.user) {
          router.replace("/login");
          return;
        }

        const uid = userRes.user.id;

        // Check if user has set a password
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("password_set")
          .eq("user_id", uid)
          .maybeSingle();

        // If profile exists and password is not set → force set-password
        if (profileErr || !profile || profile.password_set === false) {
          router.replace("/set-password");
          return;
        }

        // Otherwise go to dashboard
        router.replace("/dashboard");
      } catch {
        // Catch-all safety net
        router.replace("/login");
      }
    })();
  }, [params, router]);

  return <div style={{ padding: 40 }}>Signing you in…</div>;
}
