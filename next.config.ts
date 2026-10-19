import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No reason to tell every visitor which framework answered.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No page may show this app inside a frame, so a page on another site cannot cover it
          // with its own controls. X-Frame-Options is the same rule for older browsers.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          // The address can hold a task id or a search, so it is never sent to another site. Not
          // no-referrer: that makes a browser send "Origin: null" on a plain form post, which the
          // check on Server Actions would refuse.
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
