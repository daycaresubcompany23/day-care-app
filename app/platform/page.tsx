"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useRouter } from "next/navigation";

type Daycare = { id: string; name: string };

export default function PlatformAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [daycares, setDaycares] = useState<Daycare[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newDaycareName, setNewDaycareName] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "substitute">("substitute");
  const [inviteDaycareId, setInviteDaycareId] = useState<string>("");

  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { data: paRow, error: paErr } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (paErr) {
      setErrorMsg(paErr.message);
      setLoading(false);
      return;
    }

    const ok = !!paRow;
    setIsPlatformAdmin(ok);

    if (!ok) {
      router.replace("/dashboard");
      return;
    }

    const { data: d, error: dErr } = await supabase
      .from("daycares")
      .select("id, name")
      .order("created_at", { ascending: true });

    if (dErr) setErrorMsg(dErr.message);

    setDaycares(d ?? []);
    setInviteDaycareId(d?.[0]?.id ?? "");

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Always return a concrete string->string map to satisfy fetch HeadersInit typing
  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    return headers;
  };

  const createDaycare = async () => {
    setErrorMsg(null);
    const name = newDaycareName.trim();
    if (!name) return;

    setBusy(true);

    const res = await fetch("/api/platform/create-daycare", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ name }),
    });

    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setErrorMsg(json?.error ?? "Failed to create daycare");
      return;
    }

    setNewDaycareName("");
    await load();
  };

  const invite = async () => {
    setErrorMsg(null);
    const email = inviteEmail.trim();
    if (!email || !inviteDaycareId) return;

    setBusy(true);

    const res = await fetch("/api/platform/invite", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        email,
        daycare_id: inviteDaycareId,
        role: inviteRole,
      }),
    });

    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setErrorMsg(json?.error ?? "Invite failed");
      return;
    }

    setInviteEmail("");
    alert("Invite sent!");
  };

  const daycareOptions = useMemo(() => daycares, [daycares]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="animate-pulse text-zinc-400">Loading…</div>
        </div>
      </div>
    );
  }

  if (!isPlatformAdmin) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Platform Admin</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Create daycares and invite admins/managers/substitutes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:opacity-90"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            <b className="text-red-100">Error:</b> {errorMsg}
          </div>
        )}

        {/* Cards */}
        <div className="mt-8 grid gap-4">
          {/* Create Daycare */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Create Daycare</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Add a new daycare to the platform.
                </p>
              </div>
              <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                Admin-only
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={newDaycareName}
                onChange={(e) => setNewDaycareName(e.target.value)}
                placeholder="e.g., Test Daycare"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
              <button
                onClick={createDaycare}
                disabled={busy || !newDaycareName.trim()}
                className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Working…" : "Create"}
              </button>
            </div>
          </div>

          {/* Invite User */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Invite User</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Sends an enrollment link and assigns them to a daycare with a role.
                </p>
              </div>
              <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                Enrollment
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* Daycare */}
              <div className="sm:col-span-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Daycare
                </label>
                <select
                  value={inviteDaycareId}
                  onChange={(e) => setInviteDaycareId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                >
                  {daycareOptions.length === 0 ? (
                    <option value="">No daycares yet</option>
                  ) : (
                    daycareOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Role */}
              <div className="sm:col-span-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                >
                  <option value="substitute">substitute</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Email
                </label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="person@email.com"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">
                Tip: use role <b className="text-zinc-300">manager</b> for day-to-day operations.
              </div>

              <button
                onClick={invite}
                disabled={busy || !inviteEmail.trim() || !inviteDaycareId}
                className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Working…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
