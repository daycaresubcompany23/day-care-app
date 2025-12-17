"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useRouter } from "next/navigation";

type Daycare = { id: string; name: string };

export default function Dashboard() {
  const router = useRouter();
  const [daycares, setDaycares] = useState<Daycare[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("daycares")
      .select("id, name")
      .order("created_at", { ascending: true });

    if (error) setErrorMsg(error.message);
    else setDaycares(data ?? []);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="animate-pulse text-zinc-400">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Daycares</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Select a daycare to view shifts and manage coverage.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            <b className="text-red-100">Error:</b> {errorMsg}
          </div>
        )}

        {/* Content */}
        <div className="mt-8">
          {daycares.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
              No daycares yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {daycares.map((d) => (
                <button
                  key={d.id}
                  onClick={() => router.push(`/daycare/${d.id}`)}
                  className="group w-full rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 text-left hover:bg-zinc-900/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-zinc-100">
                        {d.name}
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        View shifts →
                      </div>
                    </div>

                    <div className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 group-hover:bg-zinc-800">
                      Open
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
