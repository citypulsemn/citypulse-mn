import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkAuth } from "./lib/admin-auth";

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD;
  const user = process.env.ADMIN_USER || "admin";

  const deny = () =>
    new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="City Pulse Admin", charset="UTF-8"' },
    });

  // If no password is configured, the admin area stays locked (fail closed).
  if (!pass) return deny();

  if (!checkAuth(req.headers.get("authorization"), user, pass)) return deny();

  return NextResponse.next();
}
