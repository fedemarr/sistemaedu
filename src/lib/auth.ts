import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
export async function supabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Proxy refreshes read-only Server Component cookies. */
          }
        },
      },
    },
  );
}
export async function requireAdmin() {
  const s = await supabase();
  const {
    data: { user },
    error,
  } = await s.auth.getUser();
  if (error || !user) redirect("/login");
  const profile =
    await db`select full_name from public.profiles where id=${user.id} and role='admin'`;
  const allowed = profile[0];
  if (!allowed) redirect("/login?error=Acceso%20no%20autorizado");
  return { id: user.id, email: user.email, name: String(allowed.full_name) };
}
