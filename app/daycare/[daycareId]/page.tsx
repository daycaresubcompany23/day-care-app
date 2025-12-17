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

type DaycareRosterRow = {
  shift_id: string;
  daycare_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  notes: string | null;
  status: string;
  claimant_user_id: string | null;
  claimant_email: string | null;
  claimed_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
};

export default function DaycarePage() {
  const router = useRouter();
  const params = useParams<{ daycareId: string }>();
  const daycareId = params.daycareId;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [daycareName, setDaycareName] = useState("Daycare");

  const [userId, setUserId] = useState("");
  const [myRole, setMyRole] = useState<string | null>(null);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [rosterRows, setRosterRows] = useState<DaycareRosterRow[]>([]);

  const isManager = myRole === "admin" || myRole === "manager";
  const isSub = myRole === "substitute";

  const rosterByShiftId = useMemo(() => {
    const map = new Map<string, DaycareRosterRow>();
    for (const r of rosterRows) map.set(r.shift_id, r);
    return map;
  }, [rosterRows]);

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

    const role = roleRow?.role ?? null;
    setMyRole(role);

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

    if (role === "admin" || role === "manager") {
      const { data: rosterData, error: rosterErr } = await supabase.rpc("get_daycare_roster", {
        p_daycare_id: daycareId,
      });

      if (rosterErr) {
        setErrorMsg(rosterErr.message);
        setRosterRows([]);
        setLoading(false);
        return;
      }

      setRosterRows((rosterData ?? []) as DaycareRosterRow[]);
    } else {
      setRosterRows([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daycareId]);

  const myClaimedShiftIds = useMemo(() => {
    return new Set(claims.filter((c) => c.user_id === userId).map((c) => c.shift_id));
  }, [claims, userId]);

  // Base categories
  const verified = shifts.filter((s) => s.status === "verified");
  const needsVerification = shifts.filter((s) => s.status === "completed");

  // Sub categories
  const myShiftsSub = shifts.filter((s) => myClaimedShiftIds.has(s.id) && s.status !== "verified");
  const openForSub = shifts.filter((s) => s.status === "open" && !myClaimedShiftIds.has(s.id));

  // Manager categories
  const openForManager = shifts.filter((s) => s.status === "open");
  const claimedForManager = shifts.filter((s) => s.status === "claimed");

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{daycareName}</h1>
              {myRole && <RolePill role={myRole} />}
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {isManager
                ? "Manage shifts, view roster, and verify completed shifts."
                : "Claim shifts, check in/out, and track your assignments."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              ← Dashboard
            </button>

            <button
              onClick={load}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              Refresh
            </button>

            {isManager && (
              <button
                onClick={() => router.push(`/daycare/${daycareId}/create-shift`)}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:opacity-90"
              >
                + Create Shift
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            <b className="text-red-100">Error:</b> {errorMsg}
          </div>
        )}

        {/* Content */}
        <div className="mt-8 space-y-8">
          {isSub && (
            <>
              <ShiftSection
                title="Open Shifts"
                subtitle="Available shifts you can claim."
                emptyText="No open shifts right now."
                shifts={openForSub}
                onOpen={(id) => router.push(`/shift/${id}`)}
                isManager={false}
                rosterByShiftId={rosterByShiftId}
              />

              <ShiftSection
                title="My Shifts"
                subtitle="Shifts you’ve claimed (active + completed)."
                emptyText="You haven’t claimed any shifts yet."
                shifts={myShiftsSub}
                onOpen={(id) => router.push(`/shift/${id}`)}
                isManager={false}
                rosterByShiftId={rosterByShiftId}
              />

              <ShiftSection
                title="Verified"
                subtitle="Completed and verified shifts."
                emptyText="No verified shifts yet."
                shifts={verified.filter((s) => myClaimedShiftIds.has(s.id))}
                onOpen={(id) => router.push(`/shift/${id}`)}
                isManager={false}
                rosterByShiftId={rosterByShiftId}
              />
            </>
          )}

          {isManager && (
            <>
              <ShiftSection
                title="Needs Verification"
                subtitle="Completed shifts waiting for approval."
                emptyText="Nothing needs verification."
                shifts={needsVerification}
                onOpen={(id) => router.push(`/shift/${id}`)}
                isManager
                rosterByShiftId={rosterByShiftId}
              />

              <ShiftSection
                title="Claimed Shifts"
                subtitle="Shifts currently assigned to a substitute."
                emptyText="No claimed shifts."
                shifts={claimedForManager}
                onOpen={(id) => router.push(`/shift/${id}`)}
                isManager
                rosterByShiftId={rosterByShiftId}
              />

              <ShiftSection
                title="Open Shifts"
                subtitle="Unclaimed shifts available for substitutes."
                emptyText="No open shifts."
                shifts={openForManager}
                onOpen={(id) => router.push(`/shift/${id}`)}
                isManager
                rosterByShiftId={rosterByShiftId}
              />

              <ShiftSection
                title="Verified"
                subtitle="Shifts that have been verified."
                emptyText="No verified shifts yet."
                shifts={verified}
                onOpen={(id) => router.push(`/shift/${id}`)}
                isManager
                rosterByShiftId={rosterByShiftId}
              />
            </>
          )}

          {!isSub && !isManager && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
              You don’t have access to this daycare.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RolePill({ role }: { role: string }) {
  const label = role[0].toUpperCase() + role.slice(1);
  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200">
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: Shift["status"] }) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

  if (status === "open") return <span className={`${base} border-emerald-900/40 bg-emerald-950/40 text-emerald-200`}>Open</span>;
  if (status === "claimed") return <span className={`${base} border-sky-900/40 bg-sky-950/40 text-sky-200`}>Claimed</span>;
  if (status === "completed") return <span className={`${base} border-amber-900/40 bg-amber-950/40 text-amber-200`}>Completed</span>;
  return <span className={`${base} border-violet-900/40 bg-violet-950/40 text-violet-200`}>Verified</span>;
}

function ShiftSection({
  title,
  subtitle,
  emptyText,
  shifts,
  onOpen,
  isManager,
  rosterByShiftId,
}: {
  title: string;
  subtitle: string;
  emptyText: string;
  shifts: Shift[];
  onOpen: (id: string) => void;
  isManager: boolean;
  rosterByShiftId: Map<string, DaycareRosterRow>;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>
        <div className="text-sm text-zinc-500">{shifts.length} shift{shifts.length === 1 ? "" : "s"}</div>
      </div>

      {shifts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
          {emptyText}
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {shifts.map((s) => {
            const r = isManager ? rosterByShiftId.get(s.id) : null;
            const hasClaimant = !!r?.claimant_user_id;

            return (
              <button
                key={s.id}
                onClick={() => onOpen(s.id)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-left hover:bg-zinc-900/60"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm text-zinc-400">{s.shift_date}</div>
                      <div className="text-sm text-zinc-300">
                        <span className="font-medium text-zinc-100">
                          {s.start_time}–{s.end_time}
                        </span>
                        {s.title ? <span className="text-zinc-400"> • {s.title}</span> : null}
                      </div>
                    </div>

                    {s.notes ? (
                      <div className="mt-1 line-clamp-1 text-sm text-zinc-400">
                        {s.notes}
                      </div>
                    ) : null}

                    {isManager && hasClaimant ? (
                      <div className="mt-2 text-sm text-zinc-400">
                        <span className="text-zinc-500">Claimed by:</span>{" "}
                        <span className="text-zinc-300">{r?.claimant_email ?? r?.claimant_user_id}</span>
                        {r?.check_in_at ? (
                          <span className="text-zinc-500">
                            {" "}
                            • In:{" "}
                            <span className="text-zinc-300">{new Date(r.check_in_at).toLocaleString()}</span>
                          </span>
                        ) : null}
                        {r?.check_out_at ? (
                          <span className="text-zinc-500">
                            {" "}
                            • Out:{" "}
                            <span className="text-zinc-300">{new Date(r.check_out_at).toLocaleString()}</span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <StatusPill status={s.status} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}