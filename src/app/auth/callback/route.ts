import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Only the flows this app actually issues links for. Accepting an arbitrary
// `type` from the query string would let a caller redeem a token through an
// unintended verification flow.
//
// `magiclink` is required by the customised Supabase "Magic Link" template,
// which is used as the account-approval email.
const ALLOWED_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "recovery",
  "email_change",
  "invite",
  "magiclink",
];

// Post-verification destinations, allow-listed to prevent an attacker-supplied
// `next` from turning the callback into an open redirect.
const ALLOWED_NEXT_PATHS = new Set([
  "/dashboard",
  "/pending-approval",
  "/reset-password",
  "/admin/products",
]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type") as EmailOtpType | null;
  const type = typeParam && ALLOWED_OTP_TYPES.includes(typeParam) ? typeParam : null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = ALLOWED_NEXT_PATHS.has(nextParam) ? nextParam : "/dashboard";
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  const supabase = await createClient();
  const redirectUrl = `${origin}${next}${next === "/pending-approval" ? "?verified=true" : ""}`;

  // 1. Flow via PKCE auth code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }
    console.error("[AUTH CALLBACK] exchangeCodeForSession failed:", error.message);
  }

  // 2. Flow via token_hash (Standard OTP / Recovery link)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }
    console.error("[AUTH CALLBACK] verifyOtp failed:", error.message);
  }

  // If Supabase returned an explicit error in query parameters
  if (errorParam || errorDesc) {
    console.error("[AUTH CALLBACK] Supabase returned error in URL:", { errorParam, errorDesc });
  }

  // Fallback to login with descriptive error
  return NextResponse.redirect(
    `${origin}/login?error=invalid-or-expired-link`
  );
}

