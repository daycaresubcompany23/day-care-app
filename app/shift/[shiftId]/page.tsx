"use client";

import { useEffect, useState } from "react";
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
  id: string;
  shift_id: string;
  user_id: string;
  claimed_at: string;
  check_in_at: string | null;
  check_out_at: string | null;
};

export default function ShiftPage() {
  const router = useRouter();
  const { shiftId } = useParams<{ shiftId: string }>();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [myClaim, setMyClaim] = useState<Claim | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    setUserId(userData.user.id);

    const { data: shiftData, error: shiftErr } = await supabase
      .from("shifts")
      .select("id, daycare_id, shift_date, start_time, end_time, title, notes, status")
      .eq("id", shiftId)
      .single();

    if (shiftErr) {
      setErrorMsg(shiftErr.message);
      setLoading(false);
      return;
    }
    setShift(shiftData as Shift);

    // With your current RLS:
    // - subs can read only their own claim
    // - managers/admins can read claims for their daycare
    const { data: claimData, error: claimErr } = await supabase
      .from("shift_claims")
      .select("id, shift_id, user_id, claimed_at, check_in_at, check_out_at")
      .eq("shift_id", shiftId)
      .maybeSingle();

    if (claimErr) {
      setErrorMsg(claimErr.message);
      setLoading(false);
      return;
    }

    setMyClaim(claimData ? (claimData as Claim) : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const claimShift = async () => {
    if (!shift) return;

    setBusy(true);
    setErrorMsg(null);

    // DB trigger will flip shifts.status to "claimed"
    const { error } = await supabase.from("shift_claims").insert({
      shift_id: shift.id,
      user_id: userId,
    });

    if (error) {
      setErrorMsg(error.message);
      setBusy(false);
      return;
    }

    await load();
    setBusy(false);
  };

  const startShift = async () => {
    if (!myClaim) return;
    if (myClaim.check_in_at) return;

    setBusy(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("shift_claims")
      .update({ check_in_at: new Date().toISOString() })
      .eq("id", myClaim.id);

    if (error) setErrorMsg(error.message);

    await load();
    setBusy(false);
  };

  const endShift = async () => {
    if (!myClaim) return;
    if (!myClaim.check_in_at || myClaim.check_out_at) return;

    setBusy(true);
    setErrorMsg(null);

    // DB trigger will flip shifts.status to "completed"
    const { error } = await supabase
      .from("shift_claims")
      .update({ check_out_at: new Date().toISOString() })
      .eq("id", myClaim.id);

    if (error) {
      setErrorMsg(error.message);
      setBusy(false);
      return;
    }

    await load();
    setBusy(false);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!shift) return <div style={{ padding: 40 }}>Shift not found.</div>;

  const iClaimedThis = !!myClaim && myClaim.user_id === userId;

  const canClaim = shift.status === "open" && !myClaim;
  const canStart =
    iClaimedThis &&
    !myClaim?.check_in_at &&
    shift.status !== "completed" &&
    shift.status !== "verified";

  const canEnd =
    iClaimedThis &&
    !!myClaim?.check_in_at &&
    !myClaim?.check_out_at &&
    shift.status !== "completed" &&
    shift.status !== "verified";

  return (
    <div style={{ padding: 40 }}>
      <button onClick={() => router.back()} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <h1>{shift.title ?? "Shift"}</h1>

      <p style={{ marginTop: 8 }}>
        <b>Date:</b> {shift.shift_date}
      </p>
      <p>
        <b>Time:</b> {shift.start_time}–{shift.end_time}
      </p>

      {shift.notes && (
        <p style={{ marginTop: 8 }}>
          <b>Notes:</b> {shift.notes}
        </p>
      )}

      <p style={{ marginTop: 8 }}>
        <b>Status:</b> {shift.status}
      </p>

      {myClaim && (
        <div style={{ marginTop: 12 }}>
          <p>
            <b>Claimed:</b> {new Date(myClaim.claimed_at).toLocaleString()}
          </p>
          <p>
            <b>Start:</b>{" "}
            {myClaim.check_in_at ? new Date(myClaim.check_in_at).toLocaleString() : "—"}
          </p>
          <p>
            <b>End:</b>{" "}
            {myClaim.check_out_at ? new Date(myClaim.check_out_at).toLocaleString() : "—"}
          </p>
        </div>
      )}

      {errorMsg && (
        <p style={{ marginTop: 12, color: "crimson" }}>
          Error: {errorMsg}
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {canClaim && (
          <button onClick={claimShift} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Working…" : "Claim Shift"}
          </button>
        )}

        {canStart && (
          <button onClick={startShift} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Working…" : "Start Shift"}
          </button>
        )}

        {canEnd && (
          <button onClick={endShift} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Working…" : "End Shift"}
          </button>
        )}
      </div>
    </div>
  );
}
