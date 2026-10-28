import { NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { markEmailVerified } from "@/lib/services/account";
import { appUrl } from "@/lib/util";

export async function GET(_request: Request, { params }: RouteContext<"/verify-email/[token]">) {
  const { token } = await params;
  const userId = await consumeAuthToken(token, "verify_email");
  if (userId) await markEmailVerified(userId);
  return NextResponse.redirect(appUrl(`/app?verified=${userId ? 1 : 0}`));
}
