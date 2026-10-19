import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function ask(headers: Record<string, string>, path = "/") {
  return proxy(new NextRequest(`http://127.0.0.1:3000${path}`, { headers }));
}

// NextResponse.next() tells Next to carry on with the request. Next marks that with this header.
function carriesOn(response: Response): boolean {
  return response.status === 200 && response.headers.get("x-middleware-next") === "1";
}

describe("proxy", () => {
  it.each(["127.0.0.1:3000", "localhost:3000", "localhost:3100"])(
    "lets a request for %s through",
    (host) => {
      expect(carriesOn(ask({ host }))).toBe(true);
    },
  );

  it("answers 403 to another Host name, with no detail", async () => {
    const response = ask({ host: "evil.example" });
    expect(response.status).toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(await response.text()).toBe("Forbidden");
  });

  it("answers 403 when there is no Host header", () => {
    expect(ask({}).status).toBe(403);
  });

  it("checks every path, including static files and the page's Server Function posts", () => {
    for (const path of ["/", "/_next/static/chunks/app.js", "/?task=abc", "/favicon.ico"]) {
      expect(ask({ host: "evil.example" }, path).status, path).toBe(403);
      expect(carriesOn(ask({ host: "localhost:3000" }, path)), path).toBe(true);
    }
  });

  it("refuses a forwarded host that is not this computer, even with a good Host", () => {
    expect(ask({ host: "localhost:3000", "x-forwarded-host": "evil.example" }).status).toBe(403);
  });

  it("lets a forwarded host through when it is this computer", () => {
    expect(carriesOn(ask({ host: "localhost:3000", "x-forwarded-host": "127.0.0.1:3000" }))).toBe(
      true,
    );
  });

  it("does not accept a good forwarded host in place of a bad Host", () => {
    expect(ask({ host: "evil.example", "x-forwarded-host": "localhost" }).status).toBe(403);
  });
});
