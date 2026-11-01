import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/auth";
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (hash && type === "recovery") {
    const s = await supabase();
    const { error } = await s.auth.verifyOtp({
      token_hash: hash,
      type: "recovery",
    });
    if (!error)
      return NextResponse.redirect(
        new URL("/configuracion?recovery=1", request.url),
      );
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
