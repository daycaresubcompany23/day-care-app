"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useParams, useRouter } from "next/navigation";

export default function CreateShiftPage() {
  const router = useRouter();
  const { daycareId } = useParams<{ daycareId: string }>();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState("");
  const [myRole, setMyRole] = useState<string | null>(null);

  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setUserId(userData.user.id);

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

      const role = roleRow?.role ?? null;
      setMyRole(role);

      const isManager = role === "admin" || role === "manager";
      if (!isManager) {
        router.replace(`/daycare/${daycareId}`);
        return;
      }

      setLoading(false);
    };

    init();
  }, [daycareId, router]);

  const createShift = async () => {
    setErrorMsg(null);

    if (!shiftDate || !startTime || !endTime) {
      setErrorMsg("Please enter date, start time, and end time.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.from("shifts").insert({
      daycare_id: daycareId,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      title: title.trim() ? title.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      status: "open",
      created_by: userId,
    });

    if (error) {
      setErrorMsg(error.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    router.push(`/daycare/${daycareId}`);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 520 }}>
      <button onClick={() => router.push(`/daycare/${daycareId}`)} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <h1>Create Shift</h1>

      {errorMsg && (
        <p style={{ marginTop: 12, color: "crimson" }}>
          Error: {errorMsg}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <label>Date</label>
        <input
          type="date"
          value={shiftDate}
          onChange={(e) => setShiftDate(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Start Time</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>End Time</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Pre-K"
          style={{ width: "100%", padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions..."
          style={{ width: "100%", padding: 10, marginTop: 6, minHeight: 90 }}
        />
      </div>

      <button
        onClick={createShift}
        disabled={busy}
        style={{ marginTop: 18, padding: 12, width: "100%" }}
      >
        {busy ? "Creating…" : "Create Shift"}
      </button>
    </div>
  );
}