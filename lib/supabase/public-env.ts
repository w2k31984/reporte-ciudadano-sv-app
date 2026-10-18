const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function publicSupabaseEnv() {
  const url = supabaseUrl?.trim();
  const key = (publishableKey || anonKey)?.trim();

  return {
    url: url || undefined,
    key: key || undefined,
  };
}
