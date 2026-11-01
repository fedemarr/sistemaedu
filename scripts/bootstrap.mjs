import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
});
try {
  const { data: existing, error: listError } = await s.auth.admin.listUsers();
  if (listError) throw listError;
  let user = existing.users.find((u) => u.email === process.env.ADMIN_EMAIL);
  if (!user) {
    const { data, error } = await s.auth.admin.createUser({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Eduardo Martínez" },
    });
    if (error) throw error;
    user = data.user;
  }
  await sql`insert into public.profiles(id,full_name) values(${user.id},'Eduardo Martínez') on conflict(id) do nothing`;
  console.info("Administrador configurado:", user.email);
} finally {
  await sql.end();
}
