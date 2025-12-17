import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

function getOrigin(req: Request) {
  return req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    // Verify caller identity
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userRes, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const callerId = userRes.user.id;

    // Check platform admin
    const { data: pa, error: paErr } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (paErr) return NextResponse.json({ error: paErr.message }, { status: 500 });
    if (!pa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const daycare_id = String(body.daycare_id ?? "").trim();
    const role = String(body.role ?? "").trim();

    if (!email || !daycare_id) {
      return NextResponse.json({ error: "Missing email or daycare_id" }, { status: 400 });
    }
    if (!["admin", "manager", "substitute"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const origin = getOrigin(req);
    const redirectTo = origin ? `${origin}/auth/callback` : undefined;

    // Invite/create auth user
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );

    if (inviteErr || !inviteData?.user) {
      return NextResponse.json({ error: inviteErr?.message ?? "Invite failed" }, { status: 400 });
    }

    const invitedUserId = inviteData.user.id;

    // Ensure profile exists (password_set=false by default)
    await supabaseAdmin.from("profiles").upsert({ user_id: invitedUserId });

    // Create membership
    const { error: memErr } = await supabaseAdmin.from("memberships").upsert({
      daycare_id,
      user_id: invitedUserId,
      role,
    });

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, invited_user_id: invitedUserId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
