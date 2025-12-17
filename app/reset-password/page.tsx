"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // When user clicks the reset link, Supabase should create a session for recovery.
      // We just verify we have a user/session; otherwise this page doesn't make sense.
      const { data: userRes } = await supabase.auth.getUser();

      if (!userRes.user) {
        setErrorMsg("This reset link is invalid or expired. Please request a new one.");
        setLoading(false);
        return;
      }

      setLoading(false);
    })();
  }, []);

  const canSubmit = useMemo(() => {
    return (
      !busy &&
      password.length >= 8 &&
      confirm.length >= 8 &&
      password === confirm
    );
  }, [busy, password, confirm]);

  const submit = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setBusy(false);
      setErrorMsg(error.message);
      return;
    }

    setBusy(false);
    setInfoMsg("Password updated! Redirecting…");

    // Send them to login (or dashboard if you prefer).
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="animate-pulse text-zinc-400">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              Password reset
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Create a new password
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Enter a new password below. After saving, you’ll sign in again.
            </p>
          </div>

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

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
              </div>

              <button
                onClick={submit}
                disabled={!canSubmit || !!errorMsg}
                className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Update password"}
              </button>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-400">
                If your link expired, go back to the login page and request another reset email.
              </div>

              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                Back to login
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-zinc-500">
            Security note: password reset links are single-use and time-limited.
          </div>
        </div>
      </div>
    </div>
  );
}
