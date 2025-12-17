"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseclient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // 👇 ADD THIS HERE
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.href = "/dashboard";
      }
    });
  }, []);

  const sendLink = async () => {
  setLoading(true);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined,
    },
  });

  setLoading(false);

  if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
  };


  return (
    <div style={{ padding: 40, maxWidth: 420 }}>
      <h1>Login</h1>
      <p>Enter your email to receive a magic link.</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        style={{ width: "100%", padding: 10, marginTop: 10 }}
      />

      <button
        onClick={sendLink}
        disabled={!email || loading}
        style={{ marginTop: 12, padding: 10, width: "100%" }}
      >
        {loading ? "Sending..." : "Send Magic Link"}
      </button>

      {sent && <p style={{ marginTop: 12 }}>Link sent — check your email.</p>}
    </div>
  );
}