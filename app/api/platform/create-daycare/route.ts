import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userRes, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const callerId = userRes.user.id;

    const { data: pa } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (!pa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const { data: daycare, error: daycareErr } = await supabaseAdmin
      .from("daycares")
      .insert({ name, created_by: callerId })
      .select("id, name")
      .single();

    if (daycareErr) return NextResponse.json({ error: daycareErr.message }, { status: 400 });

    // Optional: give platform admin membership so they can see/test it
    await supabaseAdmin.from("memberships").upsert({
      daycare_id: daycare.id,
      user_id: callerId,
      role: "admin",
    });

    return NextResponse.json({ ok: true, daycare });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
