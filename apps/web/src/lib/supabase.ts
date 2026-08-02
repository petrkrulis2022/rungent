import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Loud in dev console rather than a silent blank screen — the most common
  // M0 failure mode is "forgot to copy .env.example to .env".
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Copy apps/web/.env.example to .env and fill in your project's values."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");
