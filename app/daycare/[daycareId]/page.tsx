"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useParams, useRouter } from "next/navigation";

type Shift = {
  id: string;
  daycare_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  notes: string | null;
  status: "open" | "claimed" | "completed" | "verified";
};

type Claim = {
  shift_id: string;
  user_id: string;
};

export default function DaycarePage() {
  const router = useRouter();
  const params = useParams<{ daycareId: string }>();
  const daycareId = params.daycareId;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [daycareName, setDaycareName] = useState<string>("");

  const [userId, setUserId] = useState<string>("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setUserId(userData.user.id);

      // Daycare name
      const { data: daycare, error: daycareErr } = await supabase
        .from("daycares")
        .select("name")
        .eq("id", daycareId)
        .single();

      if (daycareErr) {
        setErrorMsg(daycareErr.message);
        setLoading(false);
        return;
      }
      setDaycareName(daycare?.name ?? "Daycare");

      // Shifts for this daycare
      const { data: shiftsData, error: shiftsErr } = await supabase
        .from("shifts")
        .select("id, daycare_id, shift_date, start_time, end_time, title, notes, status")
        .eq("daycare_id", daycareId)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (shiftsErr) {
        setErrorMsg(shiftsErr.message);
        setLoading(false);
        return;
      }
      setShifts((shiftsData ?? []) as Shift[]);

      // Claims (you’ll only see your own via RLS right now — that’s OK for “My Claimed”)
      const { data: claimsData, error: claimsErr } = await supabase
        .from("shift_claims")
        .select("shift_id, user_id");

      if (claimsErr) {
        setErrorMsg(claimsErr.message);
        setLoading(false);
        return;
      }
      setClaims((claimsData ?? []) as Claim[]);

      setLoading(false);
    };

    load();
  }, [daycareId, router]);

  const myClaimedShiftIds = useMemo(() => {
    return new Set(claims.filter((c) => c.user_id === userId).map((c) => c.shift_id));
  }, [claims, userId]);

  const openShifts = shifts.filter((s) => s.status === "open" && !myClaimedShiftIds.has(s.id));
  const myClaimed = shifts.filter((s) => myClaimedShiftIds.has(s.id));
  const other = shifts.filter((s) => !openShifts.includes(s) && !myClaimed.includes(s));

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: 40 }}>
      <button onClick={() => router.push("/dashboard")} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <h1>{daycareName}</h1>

      {errorMsg && (
        <p style={{ marginTop: 12, color: "crimson" }}>
          Error: {errorMsg}
        </p>
      )}

      <Section
        title="Open Shifts"
        emptyText="No open shifts yet."
        shifts={openShifts}
        onOpen={(id) => router.push(`/shift/${id}`)}
      />

      <Section
        title="My Claimed"
        emptyText="You haven't claimed any shifts."
        shifts={myClaimed}
        onOpen={(id) => router.push(`/shift/${id}`)}
      />

      <Section
        title="Other"
        emptyText="Nothing else here yet."
        shifts={other}
        onOpen={(id) => router.push(`/shift/${id}`)}
      />
    </div>
  );
}

function Section({
  title,
  emptyText,
  shifts,
  onOpen,
}: {
  title: string;
  emptyText: string;
  shifts: Shift[];
  onOpen: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2>{title}</h2>
      {shifts.length === 0 ? (
        <p style={{ marginTop: 8 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginTop: 8 }}>
          {shifts.map((s) => (
            <li
              key={s.id}
              style={{ cursor: "pointer", marginTop: 8 }}
              onClick={() => onOpen(s.id)}
            >
              <b>{s.shift_date}</b> — {s.start_time}–{s.end_time}
              {s.title ? ` • ${s.title}` : ""} • <i>{s.status}</i>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
