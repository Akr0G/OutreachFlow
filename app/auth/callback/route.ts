import { NextRequest, NextResponse } from "next/server";
import { assertAllowedOwnerEmail } from "@/lib/auth/owner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user?.email) {
        return NextResponse.redirect(new URL("/login?error=no-user", request.url));
      }
      try {
        assertAllowedOwnerEmail(user.email);
      } catch {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/login?error=not-allowed", request.url));
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth-callback", request.url));
}
