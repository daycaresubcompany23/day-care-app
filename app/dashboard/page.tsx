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

  useEffect(() => {
    const load = async () => {
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

    load();
  }, [router]);

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: 40 }}>
      <h1>My Daycares</h1>

      {errorMsg && (
        <p style={{ marginTop: 12, color: "crimson" }}>
          Error: {errorMsg}
        </p>
      )}

      {daycares.length === 0 ? (
        <p style={{ marginTop: 12 }}>No daycares yet.</p>
      ) : (
        <ul style={{ marginTop: 12 }}>
          {daycares.map((d) => (
            <li
              key={d.id}
              style={{ cursor: "pointer", marginTop: 8 }}
              onClick={() => router.push(`/daycare/${d.id}`)}
            >
              {d.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
