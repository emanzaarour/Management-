import { NextResponse } from "next/server";
export function middleware(request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return NextResponse.json(
        { error: "Cross-origin request denied" },
        { status: 403 },
      );
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: "/api/:path*" };
