import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureDataDir } from "./db";

let scratch: string;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "focusqueue-test-"));
});

afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe("ensureDataDir", () => {
  it("creates the folder and the folders above it", () => {
    const dir = path.join(scratch, "one", "data");
    ensureDataDir(dir);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it("is fine when the folder is already there, and leaves what is in it", () => {
    const dir = path.join(scratch, "data");
    ensureDataDir(dir);
    fs.writeFileSync(path.join(dir, "keep.txt"), "made-up");
    ensureDataDir(dir);
    expect(fs.readFileSync(path.join(dir, "keep.txt"), "utf8")).toBe("made-up");
  });

  // Windows has no owner-only mode for folders, so this can only be checked elsewhere (CI runs it).
  it.skipIf(process.platform === "win32")("makes the new folder readable by its owner only", () => {
    const dir = path.join(scratch, "data");
    ensureDataDir(dir);
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
  });

  it.skipIf(process.platform === "win32")("does not change a folder that already exists", () => {
    const dir = path.join(scratch, "data");
    fs.mkdirSync(dir, { mode: 0o755 });
    fs.chmodSync(dir, 0o755);
    ensureDataDir(dir);
    expect(fs.statSync(dir).mode & 0o777).toBe(0o755);
  });
});
