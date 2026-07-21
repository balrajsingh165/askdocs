import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";

/**
 * Request proxy (the Next.js 16 replacement for `middleware`). Guards `/api/*`
 * except `/api/health`.
 *
 * In `developer` auth mode this is a pass-through — the route layer resolves
 * the seeded user via {@link requireUser}. In `full` mode (not implemented)
 * it fails the request, keeping the enforcement point in place.
 *
 * @param _request - The incoming request.
 * @returns The proxied response.
 */
export function proxy(_request: NextRequest): NextResponse {
  if (appConfig.authMode === "full") {
    return NextResponse.json(
      {
        error: {
          code: "not_implemented",
          message: "Full auth mode is not implemented yet.",
        },
      },
      { status: 501 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/((?!health).*)"],
};
