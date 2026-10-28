import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic check only: real authorization happens in requireUser() next to the data.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("pc_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
