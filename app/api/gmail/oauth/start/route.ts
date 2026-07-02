import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { getGmailAuthorizationUrl } from "@/lib/gmail/client";

export async function GET() {
  await getOwnerContext();
  try {
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(getGmailAuthorizationUrl(state));
    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/"
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/settings?gmail=not-configured", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }
}
