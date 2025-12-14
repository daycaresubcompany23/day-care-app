export default function EnvCheck() {
  return (
    <pre>
      {JSON.stringify(
        {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          urlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 25),
        },
        null,
        2
      )}
    </pre>
  );
}
