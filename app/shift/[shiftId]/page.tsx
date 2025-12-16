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

type RosterRow = {
  shift_id: string;
  daycare_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  claimant_user_id: string | null;
  claimant_email: string | null;
  claimed_at: string | null;
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
  const [claim, setClaim] = useState<Claim | null>(null);

  // Manager-only roster info (email etc.)
  const [roster, setRoster] = useState<RosterRow | null>(null);

  const isManager = myRole === "admin" || myRole === "manager";

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
      .select(
        "id, daycare_id, shift_date, start_time, end_time, title, notes, status, verified_at, verified_by"
      )
      .eq("id", shiftId)
      .single();

    if (shiftErr) {
      setErrorMsg(shiftErr.message);
      setLoading(false);
      return;
    }

    const loadedShift = shiftData as Shift;
    setShift(loadedShift);

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

    const role = roleRow?.role ?? null;
    setMyRole(role);

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
    setClaim(claimData ? (claimData as Claim) : null);

    // Load roster (manager/admin only) via RPC to safely get claimant email
    if (role === "admin" || role === "manager") {
      const { data: rosterRows, error: rosterErr } = await supabase.rpc("get_shift_roster", {
        p_shift_id: shiftId,
      });

      if (rosterErr) {
        setErrorMsg(rosterErr.message);
        setRoster(null);
        setLoading(false);
        return;
      }

      setRoster((rosterRows?.[0] as RosterRow) ?? null);
    } else {
      setRoster(null);
    }

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
    if (!claim) return;
    if (claim.check_in_at) return;

    setBusy(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("shift_claims")
      .update({ check_in_at: new Date().toISOString() })
      .eq("id", claim.id);

    if (error) setErrorMsg(error.message);

    await load();
    setBusy(false);
  };

  const endShift = async () => {
    if (!claim) return;
    if (!claim.check_in_at || claim.check_out_at) return;

    setBusy(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("shift_claims")
      .update({ check_out_at: new Date().toISOString() })
      .eq("id", claim.id);

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

  const cancelOrUnclaim = async () => {
    if (!claim) return;

    setBusy(true);
    setErrorMsg(null);

    // DELETE claim row; trigger will set shift back to open
    const { error } = await supabase.from("shift_claims").delete().eq("id", claim.id);

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

  const iClaimedThis = !!claim && claim.user_id === userId;

  const canClaim = shift.status === "open" && !claim;

  const isSub = myRole === "substitute";

  const canStart =
    isSub &&
    iClaimedThis &&
    !!claim &&
    !claim.check_in_at &&
    shift.status !== "completed" &&
    shift.status !== "verified";

  const canEnd =
    isSub &&
    iClaimedThis &&
    !!claim &&
    !!claim.check_in_at &&
    !claim.check_out_at &&
    shift.status !== "completed" &&
    shift.status !== "verified";

  const canVerify = isManager && shift.status === "completed";

  // Cancel/unclaim rules:
  // - Must exist a claim
  // - Must NOT be started (check_in_at null)
  // - Substitute can cancel their own
  // - Manager/admin can unclaim anyone (RLS enforces)
  const canCancel =
    !!claim &&
    claim.check_in_at === null &&
    (iClaimedThis || isManager) &&
    shift.status !== "completed" &&
    shift.status !== "verified";

  const cancelLabel = iClaimedThis ? "Cancel Claim" : "Unclaim Substitute";

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

      {claim && (
        <div style={{ marginTop: 12 }}>
          <h3>My Claim</h3>
          <p style={{ marginTop: 8 }}>
            <b>Claimed:</b> {new Date(claim.claimed_at).toLocaleString()}
          </p>
          <p>
            <b>Start:</b> {claim.check_in_at ? new Date(claim.check_in_at).toLocaleString() : "—"}
          </p>
          <p>
            <b>End:</b> {claim.check_out_at ? new Date(claim.check_out_at).toLocaleString() : "—"}
          </p>
        </div>
      )}

      {isManager && (
        <div style={{ marginTop: 16 }}>
          <h3>Roster</h3>
          {!roster || !roster.claimant_user_id ? (
            <p style={{ marginTop: 8 }}>No one has claimed this shift yet.</p>
          ) : (
            <div style={{ marginTop: 8 }}>
              <p>
                <b>Claimant:</b> {roster.claimant_email ?? roster.claimant_user_id}
              </p>
              <p>
                <b>Claimed At:</b>{" "}
                {roster.claimed_at ? new Date(roster.claimed_at).toLocaleString() : "—"}
              </p>
              <p>
                <b>Check-in:</b>{" "}
                {roster.check_in_at ? new Date(roster.check_in_at).toLocaleString() : "—"}
              </p>
              <p>
                <b>Check-out:</b>{" "}
                {roster.check_out_at ? new Date(roster.check_out_at).toLocaleString() : "—"}
              </p>
            </div>
          )}
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

        {canCancel && (
          <button onClick={cancelOrUnclaim} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Working…" : cancelLabel}
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
