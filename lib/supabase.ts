import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para uso en el servidor (usa la secret key).
// NUNCA exponer la secret key al cliente.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "reportes";

export function getSupabaseAdmin() {
  if (!url || !secret) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en el .env"
    );
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
