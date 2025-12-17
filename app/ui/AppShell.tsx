"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { usePathname, useRouter } from "next/navigation";

type Role =
  | "platform_admin"
  | "admin"
  | "manager"
  | "substitute"
  | null;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      // 1️⃣ Platform admin check
      const { data: pa } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pa) {
        setRole("platform_admin");
        setLoading(false);
        return;
      }

      // 2️⃣ Otherwise get first membership role
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      setRole((membership?.role as Role) ?? null);
      setLoading(false);
    };

    load();
  }, []);

  const logout = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const hideShell =
    pathname === "/login" ||
    pathname === "/set-password" ||
    pathname === "/auth/callback";

  if (hideShell) return <>{children}</>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm font-semibold tracking-tight hover:opacity-80"
          >
            Daycare Scheduling
          </button>

          {!loading && loggedIn && (
            <div className="flex items-center gap-3">
              {role && <RoleBadge role={role} />}

              <button
                onClick={logout}
                disabled={busy}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Logging out…" : "Logout"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}

/* ====================== */
/* Role badge component   */
/* ====================== */

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<string, string> = {
    platform_admin: "bg-purple-600/20 text-purple-300 border-purple-500/40",
    admin: "bg-blue-600/20 text-blue-300 border-blue-500/40",
    manager: "bg-emerald-600/20 text-emerald-300 border-emerald-500/40",
    substitute: "bg-zinc-700/30 text-zinc-300 border-zinc-600",
  };

  const labels: Record<string, string> = {
    platform_admin: "Platform Admin",
    admin: "Admin",
    manager: "Manager",
    substitute: "Substitute",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${styles[role!]}`}
    >
      {labels[role!]}
    </span>
  );
}
