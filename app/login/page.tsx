"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseclient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) window.location.href = "/dashboard";
    });
  }, []);

  const canSignIn = useMemo(() => {
    return !!email.trim() && !!password && !busy;
  }, [email, password, busy]);

  const signIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    const e = email.trim().toLowerCase();
    if (!e || !password) {
      setErrorMsg("Enter your email and password.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: e,
      password,
    });
    setBusy(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    window.location.href = "/dashboard";
  };

  const forgotPassword = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    const e = email.trim().toLowerCase();
    if (!e) {
      setErrorMsg("Enter your email first, then click 'Forgot password'.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });
    setBusy(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setInfoMsg("Password reset email sent. Check your inbox.");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Top heading */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              Daycare App V1
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Use your email + password. If you’re new, use the invite link you were emailed.
            </p>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
              <b className="text-red-100">Error:</b> {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">
              {infoMsg}
            </div>
          )}

          {/* Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  inputMode="email"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={forgotPassword}
                    disabled={busy}
                    className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-60"
                  >
                    Forgot password?
                  </button>
                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") signIn();
                  }}
                />
              </div>

              <button
                onClick={signIn}
                disabled={!canSignIn}
                className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-400">
                <b className="text-zinc-200">New hire?</b> Open the invite email and follow that link
                to enroll (one-time), then you can sign in here normally.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-zinc-500">
            Having trouble? Double-check your email, or use{" "}
            <span className="text-zinc-300">Forgot password</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
