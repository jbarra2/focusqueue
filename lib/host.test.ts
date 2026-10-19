import { describe, expect, it } from "vitest";
import { isAllowedHost } from "./host";

describe("isAllowedHost", () => {
  it.each([
    "127.0.0.1",
    "127.0.0.1:3000",
    "127.0.0.1:3100",
    "127.0.0.1:80",
    "localhost",
    "localhost:3000",
    "LocalHost:3000",
  ])("answers %s", (host) => {
    expect(isAllowedHost(host)).toBe(true);
  });

  it.each([
    ["a missing header", null],
    ["no header at all", undefined],
    ["an empty header", ""],
    ["another site", "evil.example"],
    ["another site with a port", "evil.example:3000"],
    ["a site that starts with localhost", "localhost.evil.example"],
    ["a site that starts with the address", "127.0.0.1.evil.example"],
    ["a site that ends with localhost", "evil-localhost"],
    ["a user name before the host", "evil.example@localhost"],
    ["a user name after the host", "localhost@evil.example"],
    ["another address on this computer", "127.0.0.2"],
    ["the all-interfaces address", "0.0.0.0:3000"],
    ["a name in the local network", "my-computer.local:3000"],
    ["an IPv6 loopback address, which the app does not listen on", "[::1]:3000"],
    ["a port that is empty", "localhost:"],
    ["a port that is not a number", "localhost:abc"],
    ["a port with too many digits", "localhost:123456"],
    ["two ports", "localhost:3000:3000"],
    ["a space before the name", " localhost"],
    ["a space after the name", "localhost "],
    ["a list of hosts", "localhost, evil.example"],
    ["a name with a path", "localhost/evil"],
    ["a trailing dot", "localhost."],
  ])("refuses %s", (_label, host) => {
    expect(isAllowedHost(host)).toBe(false);
  });
});
