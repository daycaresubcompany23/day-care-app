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
  verified_at?: string | null;
  verified_by?: string | null;
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

  const [userId, setUserId] = useState("");
  const [myRole, setMyRole] = useState<string | null>(null);

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
      .select("id, daycare_id, shift_date, start_time, end_time, title, notes, status, verified_at, verified_by")
      .eq("id", shiftId)
      .single();

    if (shiftErr) {
      setErrorMsg(shiftErr.message);
      setLoading(false);
      return;
    }

    const loadedShift = shiftData as Shift;
    setShift(loadedShift);

    // Role lookup (current RLS policy lets users read their own membership rows)
    const { data: roleRow, error: roleErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("daycare_id", loadedShift.daycare_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (roleErr) {
      setErrorMsg(roleErr.message);
      setLoading(false);
      return;
    }
    setMyRole(roleRow?.role ?? null);

    // Claim lookup (subs read their own; managers/admins can read within daycare)
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

    // Trigger will flip shift -> claimed
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

    // Trigger will flip shift -> completed
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

  const verifyShift = async () => {
    if (!shift) return;

    setBusy(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("shifts")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: userId,
      })
      .eq("id", shift.id);

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

  const isManager = myRole === "admin" || myRole === "manager";
  const iClaimedThis = !!myClaim && myClaim.user_id === userId;

  const canClaim = shift.status === "open" && !myClaim;
  const canStart = iClaimedThis && !myClaim?.check_in_at && shift.status !== "completed" && shift.status !== "verified";
  const canEnd =
    iClaimedThis &&
    !!myClaim?.check_in_at &&
    !myClaim?.check_out_at &&
    shift.status !== "completed" &&
    shift.status !== "verified";

  const canVerify = isManager && shift.status === "completed";

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={() => router.back()}>← Back</button>
        <button onClick={load}>Refresh</button>
      </div>

      <h1 style={{ marginTop: 16 }}>{shift.title ?? "Shift"}</h1>

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

      {shift.status === "verified" && (
        <p style={{ marginTop: 8 }}>
          <b>Verified:</b>{" "}
          {shift.verified_at ? new Date(shift.verified_at).toLocaleString() : "—"}
        </p>
      )}

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

        {canVerify && (
          <button onClick={verifyShift} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Working…" : "Verify Shift"}
          </button>
        )}
      </div>
    </div>
  );
}
