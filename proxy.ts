import { NextResponse, type NextRequest } from "next/server";
import { isAllowedHost } from "@/lib/host";

// Runs before every request, including static files and Server Function calls, which are POSTs to
// the page. There is no matcher on purpose, so nothing is left out. The one exception is the dev
// server's own hot-reload paths, which Next answers before the proxy runs. `npm start` has none.
export function proxy(request: NextRequest) {
  // Server Actions compare the Origin with x-forwarded-host when it is present, so it is held to
  // the same rule as Host. Nothing on this computer sets it, so a request that has it is odd.
  const forwarded = request.headers.get("x-forwarded-host");
  if (
    isAllowedHost(request.headers.get("host")) &&
    (forwarded === null || isAllowedHost(forwarded))
  ) {
    return NextResponse.next();
  }
  return new NextResponse("Forbidden", { status: 403 });
}
