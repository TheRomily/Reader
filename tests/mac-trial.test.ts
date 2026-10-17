// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  assertMac,
  trialConfig,
  assertAdHocSignature,
} from "../scripts/mac-trial.mjs";

describe("local Mac trial signing", () => {
  it("requires a real Mac before doing any build or signing work", () => {
    expect(() => assertMac("darwin")).not.toThrow();
    expect(() => assertMac("linux")).toThrow("必须在你的 Mac 本机运行");
    expect(() => assertMac("win32")).toThrow("必须在你的 Mac 本机运行");
  });
  it("overrides disabled signing while preserving project packaging settings", () => {
    const base = {
      appId: "com.yuejing.reader",
      files: ["dist/**"],
      directories: { output: "release", buildResources: "desktop" },
      mac: {
        identity: null,
        category: "public.app-category.books",
        target: ["dmg", "zip"],
      },
    };
    const config = trialConfig(base, "arm64");
    expect(config.mac.identity).toBe("-");
    expect(config.forceCodeSigning).toBe(true);
    expect(config.mac.notarize).toBe(false);
    expect(config.mac.hardenedRuntime).toBe(false);
    expect(config.mac.category).toBe(base.mac.category);
    expect(config.files).toEqual(base.files);
    expect(config.directories).toEqual({
      output: "release/mac-trial",
      buildResources: "desktop",
    });
    expect(config.mac.target).toEqual([{ target: "dir", arch: ["arm64"] }]);
    expect(base.mac.identity).toBeNull();
    expect(trialConfig(base, "x64").mac.target[0].arch).toEqual(["x64"]);
  });
  it("rejects unsupported architectures instead of generating the wrong app", () => {
    expect(() => trialConfig({}, "ia32")).toThrow("仅支持");
  });
  it("only accepts the explicit ad-hoc signature marker", () => {
    expect(() =>
      assertAdHocSignature(
        "Executable=/app/阅境\nSignature=adhoc\nTeamIdentifier=not set\n",
      ),
    ).not.toThrow();
    expect(() =>
      assertAdHocSignature("code object is not signed at all"),
    ).toThrow("未检测到");
    expect(() =>
      assertAdHocSignature("Authority=Developer ID Application: Other\n"),
    ).toThrow("未检测到");
  });
});
