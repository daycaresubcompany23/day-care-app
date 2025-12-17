"use client";

import { useEffect, useMemo, useState } from "react";
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

  const canSubmit = useMemo(() => {
    return !!shiftDate && !!startTime && !!endTime && !busy;
  }, [shiftDate, startTime, endTime, busy]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <div className="animate-pulse text-zinc-400">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push(`/daycare/${daycareId}`)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            ← Back
          </button>

          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
            {myRole === "admin" ? "Admin" : "Manager"}
          </span>
        </div>

        {/* Title */}
        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight">Create Shift</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Add coverage for a specific day and time window.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            <b className="text-red-100">Error:</b> {errorMsg}
          </div>
        )}

        {/* Form card */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Date */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Date
              </label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>

            {/* Start */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Start time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>

            {/* End */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                End time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>

            {/* Title */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Title (optional)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Pre-K"
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions..."
                className="mt-2 min-h-[110px] w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => router.push(`/daycare/${daycareId}`)}
              disabled={busy}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm hover:bg-zinc-800 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              onClick={createShift}
              disabled={!canSubmit}
              className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create Shift"}
            </button>
          </div>
        </div>

        {/* Small helper */}
        <div className="mt-4 text-xs text-zinc-500">
          Shifts start as <span className="text-zinc-300">open</span> and can be claimed by substitutes.
        </div>
      </div>
    </div>
  );
}