import { describe, it, expect } from "vitest";
import { normalizeLicense, resolvePolicy, evaluatePackage } from "../policy.js";
import type { LicenseInfo } from "../types.js";

describe("normalizeLicense", () => {
  it("passes through valid SPDX identifiers", () => {
    expect(normalizeLicense("MIT")).toEqual({ normalized: "MIT", wasChanged: false });
    expect(normalizeLicense("Apache-2.0")).toEqual({ normalized: "Apache-2.0", wasChanged: false });
  });

  it("corrects common misspellings", () => {
    const result = normalizeLicense("Apache 2.0");
    expect(result.normalized).toBe("Apache-2.0");
    expect(result.wasChanged).toBe(true);
  });

  it("handles UNKNOWN as-is", () => {
    expect(normalizeLicense("UNKNOWN")).toEqual({ normalized: "UNKNOWN", wasChanged: false });
  });

  it("handles UNLICENSED as-is", () => {
    expect(normalizeLicense("UNLICENSED")).toEqual({ normalized: "UNLICENSED", wasChanged: false });
  });

  it("handles empty string", () => {
    expect(normalizeLicense("")).toEqual({ normalized: "UNKNOWN", wasChanged: false });
  });

  it("returns UNKNOWN for unrecoverable inputs", () => {
    const result = normalizeLicense("some-garbage-not-a-license-xyz");
    expect(result.normalized).toBe("UNKNOWN");
    expect(result.wasChanged).toBe(true);
  });

  it("passes through compound expressions", () => {
    expect(normalizeLicense("(MIT OR Apache-2.0)")).toEqual({
      normalized: "(MIT OR Apache-2.0)",
      wasChanged: false,
    });
  });
});

describe("resolvePolicy", () => {
  it("resolves permissive preset", () => {
    const licenses = resolvePolicy("permissive");
    expect(licenses).toContain("MIT");
    expect(licenses).toContain("ISC");
    expect(licenses).not.toContain("GPL-3.0-only");
  });

  it("resolves copyleft preset", () => {
    const licenses = resolvePolicy("copyleft");
    expect(licenses).toContain("MIT");
    expect(licenses).toContain("GPL-3.0-only");
    expect(licenses).toContain("AGPL-3.0-only");
  });

  it("extracts identifiers from custom SPDX expression", () => {
    const licenses = resolvePolicy("(MIT OR BSD-2-Clause)");
    expect(licenses).toContain("MIT");
    expect(licenses).toContain("BSD-2-Clause");
  });

  it("falls back to single license for non-parseable policy", () => {
    const licenses = resolvePolicy("CustomLicense");
    expect(licenses).toEqual(["CustomLicense"]);
  });
});

describe("evaluatePackage", () => {
  const allowed = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"];
  const chain = ["my-app", "some-dep"];

  function makePkg(overrides: Partial<LicenseInfo>): LicenseInfo {
    return {
      packageName: "test-pkg",
      version: "1.0.0",
      licenses: "MIT",
      ...overrides,
    };
  }

  it("returns no issues for allowed license", () => {
    const issues = evaluatePackage(makePkg({ licenses: "MIT" }), allowed, chain);
    expect(issues).toHaveLength(0);
  });

  it("returns critical for disallowed license", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "GPL-3.0-only" }),
      allowed,
      chain,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("critical");
    expect(issues[0].license).toBe("GPL-3.0-only");
  });

  it("returns warning for UNKNOWN license", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "UNKNOWN" }),
      allowed,
      chain,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("returns warning for UNLICENSED", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "UNLICENSED" }),
      allowed,
      chain,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].reason).toContain("UNLICENSED");
  });

  it("allows OR expressions where at least one matches", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "(MIT OR GPL-3.0-only)" }),
      allowed,
      chain,
    );
    expect(issues).toHaveLength(0);
  });

  it("rejects OR expressions where none match", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "(GPL-2.0-only OR GPL-3.0-only)" }),
      allowed,
      chain,
    );
    const critical = issues.filter((i) => i.severity === "critical");
    expect(critical).toHaveLength(1);
  });

  it("reports auto-corrected license as info", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "Apache 2.0" }),
      allowed,
      chain,
    );
    const info = issues.filter((i) => i.severity === "info");
    expect(info).toHaveLength(1);
    expect(info[0].correctedLicense).toBe("Apache-2.0");
  });

  it("preserves dependency chain in issues", () => {
    const customChain = ["root", "dep-a", "dep-b", "gpl-pkg"];
    const issues = evaluatePackage(
      makePkg({ licenses: "GPL-3.0-only" }),
      allowed,
      customChain,
    );
    expect(issues[0].dependencyChain).toEqual(customChain);
  });

  it("handles BSD-2-Clause as allowed", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "BSD-2-Clause" }),
      allowed,
      chain,
    );
    expect(issues).toHaveLength(0);
  });

  it("handles ISC as allowed", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "ISC" }),
      allowed,
      chain,
    );
    expect(issues).toHaveLength(0);
  });

  it("returns warning for unrecoverable license string", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "totally-not-a-real-license-xyz" }),
      allowed,
      chain,
    );
    const warnings = issues.filter((i) => i.severity === "warning");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("handles AND expressions correctly", () => {
    const issues = evaluatePackage(
      makePkg({ licenses: "(MIT AND Apache-2.0)" }),
      allowed,
      chain,
    );
    expect(issues).toHaveLength(0);
  });
});
