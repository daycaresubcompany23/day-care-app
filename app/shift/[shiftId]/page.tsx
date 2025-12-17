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

  const [roster, setRoster] = useState<RosterRow | null>(null);

  const isManager = myRole === "admin" || myRole === "manager";
  const isSub = myRole === "substitute";

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

  const iClaimedThis = useMemo(() => {
    return !!claim && claim.user_id === userId;
  }, [claim, userId]);

  const canClaim = !!shift && shift.status === "open" && !claim;

  const canStart =
    isSub &&
    iClaimedThis &&
    !!claim &&
    !claim.check_in_at &&
    shift?.status !== "completed" &&
    shift?.status !== "verified";

  const canEnd =
    isSub &&
    iClaimedThis &&
    !!claim &&
    !!claim.check_in_at &&
    !claim.check_out_at &&
    shift?.status !== "completed" &&
    shift?.status !== "verified";

  const canVerify = isManager && shift?.status === "completed";

  const canCancel =
    !!claim &&
    claim.check_in_at === null &&
    (iClaimedThis || isManager) &&
    shift?.status !== "completed" &&
    shift?.status !== "verified";

  const cancelLabel = iClaimedThis ? "Cancel Claim" : "Unclaim Substitute";

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

    const { error } = await supabase.from("shift_claims").delete().eq("id", claim.id);

    if (error) {
      setErrorMsg(error.message);
      setBusy(false);
      return;
    }

    await load();
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="animate-pulse text-zinc-400">Loading…</div>
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            Shift not found.
          </div>
        </div>
      </div>
    );
  }

  const statusLabel =
    shift.status === "open"
      ? "Open"
      : shift.status === "claimed"
      ? "Claimed"
      : shift.status === "completed"
      ? "Completed"
      : "Verified";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              ← Back
            </button>

            <button
              onClick={load}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              Refresh
            </button>
          </div>

          <div className="flex items-center gap-2">
            <StatusChip status={shift.status} />
            <span className="text-xs text-zinc-500">Shift ID: {shift.id.slice(0, 8)}…</span>
          </div>
        </div>

        {/* Header */}
        <div className="mt-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {shift.title ?? "Shift"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1">
              {shift.shift_date}
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1">
              {shift.start_time}–{shift.end_time}
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400">{statusLabel}</span>
          </div>

          {shift.notes && (
            <p className="mt-2 max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-300">
              <span className="font-medium text-zinc-200">Notes:</span> {shift.notes}
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            <b className="text-red-100">Error:</b> {errorMsg}
          </div>
        )}

        {/* Main grid */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {/* Left: Actions */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <h2 className="text-sm font-semibold text-zinc-200">Actions</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Complete the shift workflow from claim → start → end → verify.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {canClaim && (
                  <PrimaryButton onClick={claimShift} disabled={busy}>
                    {busy ? "Working…" : "Claim Shift"}
                  </PrimaryButton>
                )}

                {canStart && (
                  <PrimaryButton onClick={startShift} disabled={busy}>
                    {busy ? "Working…" : "Start Shift"}
                  </PrimaryButton>
                )}

                {canEnd && (
                  <PrimaryButton onClick={endShift} disabled={busy}>
                    {busy ? "Working…" : "End Shift"}
                  </PrimaryButton>
                )}

                {canVerify && (
                  <PrimaryButton onClick={verifyShift} disabled={busy}>
                    {busy ? "Working…" : "Verify Shift"}
                  </PrimaryButton>
                )}

                {canCancel && (
                  <DangerButton onClick={cancelOrUnclaim} disabled={busy}>
                    {busy ? "Working…" : cancelLabel}
                  </DangerButton>
                )}

                {!canClaim && !canStart && !canEnd && !canVerify && !canCancel && (
                  <div className="text-sm text-zinc-500">
                    No actions available for your role right now.
                  </div>
                )}
              </div>
            </div>

            {/* Claim timeline */}
            {claim && (
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
                <h2 className="text-sm font-semibold text-zinc-200">
                  {iClaimedThis ? "Your Claim" : "Claim Details"}
                </h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <TimelineItem
                    label="Claimed"
                    value={formatDateTime(claim.claimed_at)}
                    hint="Claim created"
                  />
                  <TimelineItem
                    label="Check-in"
                    value={claim.check_in_at ? formatDateTime(claim.check_in_at) : "—"}
                    hint="Start time"
                  />
                  <TimelineItem
                    label="Check-out"
                    value={claim.check_out_at ? formatDateTime(claim.check_out_at) : "—"}
                    hint="End time"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Manager roster */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <h2 className="text-sm font-semibold text-zinc-200">Details</h2>

              <div className="mt-4 grid gap-3 text-sm">
                <InfoRow label="Role" value={myRole ?? "—"} />
                <InfoRow label="Status" value={<StatusChip status={shift.status} />} />
                {shift.status === "verified" && (
                  <InfoRow
                    label="Verified at"
                    value={shift.verified_at ? formatDateTime(shift.verified_at) : "—"}
                  />
                )}
              </div>
            </div>

            {isManager && (
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
                <h2 className="text-sm font-semibold text-zinc-200">Roster</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Claimant info (manager/admin only).
                </p>

                {!roster || !roster.claimant_user_id ? (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
                    No one has claimed this shift yet.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 text-sm">
                    <InfoRow
                      label="Claimant"
                      value={roster.claimant_email ?? roster.claimant_user_id ?? "—"}
                    />
                    <InfoRow
                      label="Claimed at"
                      value={roster.claimed_at ? formatDateTime(roster.claimed_at) : "—"}
                    />
                    <InfoRow
                      label="Check-in"
                      value={roster.check_in_at ? formatDateTime(roster.check_in_at) : "—"}
                    />
                    <InfoRow
                      label="Check-out"
                      value={roster.check_out_at ? formatDateTime(roster.check_out_at) : "—"}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function StatusChip({ status }: { status: Shift["status"] }) {
  const styles =
    status === "open"
      ? "border-emerald-500/40 bg-emerald-600/20 text-emerald-300"
      : status === "claimed"
      ? "border-blue-500/40 bg-blue-600/20 text-blue-300"
      : status === "completed"
      ? "border-amber-500/40 bg-amber-600/20 text-amber-300"
      : "border-purple-500/40 bg-purple-600/20 text-purple-300";

  const label =
    status === "open"
      ? "Open"
      : status === "claimed"
      ? "Claimed"
      : status === "completed"
      ? "Completed"
      : "Verified";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:opacity-90 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function DangerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-200 hover:bg-red-950/50 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const isString = typeof value === "string";

  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-x-3 gap-y-1">
      <div className="text-zinc-500">{label}</div>

      <div
        className={[
          "min-w-0 text-right text-zinc-200",      // min-w-0 is the key
          isString ? "break-words" : "",           // wrap long strings like emails
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}


function TimelineItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}