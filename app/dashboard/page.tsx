"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? null);
    };
    load();
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>
      <p>Signed in as: {email ?? "Loading..."}</p>
      <button onClick={logout} style={{ marginTop: 12, padding: 10 }}>
        Log out
      </button>
    </div>
  );
}
