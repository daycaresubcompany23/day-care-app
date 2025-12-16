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
  const [daycareName, setDaycareName] = useState("");

  const [userId, setUserId] = useState("");
  const [myRole, setMyRole] = useState<string | null>(null);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    setUserId(userData.user.id);

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

    const { data: roleRow, error: roleErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("daycare_id", daycareId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (roleErr) {
      setErrorMsg(roleErr.message);
      setLoading(false);
      return;
    }
    setMyRole(roleRow?.role ?? null);

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daycareId]);

  const myClaimedShiftIds = useMemo(() => {
    return new Set(claims.filter((c) => c.user_id === userId).map((c) => c.shift_id));
  }, [claims, userId]);

  const needsVerification = shifts.filter((s) => s.status === "completed");
  const verified = shifts.filter((s) => s.status === "verified");
  const myClaimed = shifts.filter(
    (s) => myClaimedShiftIds.has(s.id) && s.status !== "completed" && s.status !== "verified"
  );
  const openShifts = shifts.filter(
    (s) => s.status === "open" && !myClaimedShiftIds.has(s.id)
  );

  const other = shifts.filter(
    (s) =>
      !openShifts.some((x) => x.id === s.id) &&
      !myClaimed.some((x) => x.id === s.id) &&
      !needsVerification.some((x) => x.id === s.id) &&
      !verified.some((x) => x.id === s.id)
  );

  const isManager = myRole === "admin" || myRole === "manager";

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={() => router.push("/dashboard")}>← Back</button>
        <button onClick={load}>Refresh</button>

        {isManager && (
          <button onClick={() => router.push(`/daycare/${daycareId}/create-shift`)}>
            + Create Shift
          </button>
        )}
      </div>

      <h1 style={{ marginTop: 16 }}>{daycareName}</h1>

      {errorMsg && (
        <p style={{ marginTop: 12, color: "crimson" }}>
          Error: {errorMsg}
        </p>
      )}

      <Section title="Open Shifts" emptyText="No open shifts yet." shifts={openShifts} onOpen={(id) => router.push(`/shift/${id}`)} />
      <Section title="My Claimed" emptyText="You haven't claimed any shifts." shifts={myClaimed} onOpen={(id) => router.push(`/shift/${id}`)} />
      <Section title="Needs Verification" emptyText="No shifts need verification." shifts={needsVerification} onOpen={(id) => router.push(`/shift/${id}`)} />
      <Section title="Verified" emptyText="No verified shifts yet." shifts={verified} onOpen={(id) => router.push(`/shift/${id}`)} />
      <Section title="Other" emptyText="Nothing else here yet." shifts={other} onOpen={(id) => router.push(`/shift/${id}`)} />
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
  shifts: any[];
  onOpen: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2>{title}</h2>
      {shifts.length === 0 ? (
        <p style={{ marginTop: 8 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginTop: 8 }}>
          {shifts.map((s: any) => (
            <li key={s.id} style={{ cursor: "pointer", marginTop: 8 }} onClick={() => onOpen(s.id)}>
              <b>{s.shift_date}</b> — {s.start_time}–{s.end_time}
              {s.title ? ` • ${s.title}` : ""} • <i>{s.status}</i>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
