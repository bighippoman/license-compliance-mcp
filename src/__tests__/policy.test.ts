import { describe, it, expect } from "vitest";
import { normalizeLicense, resolvePolicy, evaluatePackage } from "../policy.js";
import type { LicenseInfo, ComplianceIssue } from "../types.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePkg(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
  return {
    packageName: "test-pkg",
    version: "1.0.0",
    licenses: "MIT",
    ...overrides,
  };
}

// ===========================================================================
// normalizeLicense
// ===========================================================================

describe("normalizeLicense", () => {
  // ---- Valid SPDX identifiers (should pass through unchanged) ----

  describe("valid SPDX identifiers", () => {
    it.each([
      "MIT",
      "ISC",
      "Apache-2.0",
      "GPL-3.0-only",
      "AGPL-3.0-only",
      "BSD-2-Clause",
      "0BSD",
      "Unlicense",
    ])("passes through %s unchanged", (license) => {
      const result = normalizeLicense(license);
      expect(result).toEqual({ normalized: license, wasChanged: false });
    });
  });

  // ---- Valid compound expressions ----

  describe("compound SPDX expressions", () => {
    it("passes through (MIT OR Apache-2.0)", () => {
      expect(normalizeLicense("(MIT OR Apache-2.0)")).toEqual({
        normalized: "(MIT OR Apache-2.0)",
        wasChanged: false,
      });
    });

    it("passes through (MIT AND BSD-3-Clause)", () => {
      expect(normalizeLicense("(MIT AND BSD-3-Clause)")).toEqual({
        normalized: "(MIT AND BSD-3-Clause)",
        wasChanged: false,
      });
    });

    it("passes through (GPL-2.0-only OR MIT)", () => {
      expect(normalizeLicense("(GPL-2.0-only OR MIT)")).toEqual({
        normalized: "(GPL-2.0-only OR MIT)",
        wasChanged: false,
      });
    });
  });

  // ---- Correctable misspellings ----

  describe("correctable misspellings", () => {
    it('corrects "Apache 2.0" to Apache-2.0', () => {
      const result = normalizeLicense("Apache 2.0");
      expect(result.normalized).toBe("Apache-2.0");
      expect(result.wasChanged).toBe(true);
    });

    it("corrects GPL3 via spdx-correct", () => {
      const result = normalizeLicense("GPL3");
      // spdx-correct should correct this to a valid GPL-3.0 variant
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).not.toBe("UNKNOWN");
      expect(result.normalized).toMatch(/GPL-3\.0/);
    });

    it("corrects GPLv3 via spdx-correct", () => {
      const result = normalizeLicense("GPLv3");
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).not.toBe("UNKNOWN");
      expect(result.normalized).toMatch(/GPL-3\.0/);
    });
  });

  // ---- Special pass-through values ----

  describe("special values", () => {
    it("passes through UNKNOWN unchanged", () => {
      expect(normalizeLicense("UNKNOWN")).toEqual({
        normalized: "UNKNOWN",
        wasChanged: false,
      });
    });

    it("passes through UNLICENSED unchanged", () => {
      expect(normalizeLicense("UNLICENSED")).toEqual({
        normalized: "UNLICENSED",
        wasChanged: false,
      });
    });

    it("converts empty string to UNKNOWN with wasChanged=false", () => {
      expect(normalizeLicense("")).toEqual({
        normalized: "UNKNOWN",
        wasChanged: false,
      });
    });
  });

  // ---- Garbage / unrecoverable ----

  describe("garbage input", () => {
    it("returns UNKNOWN with wasChanged=true for nonsense", () => {
      const result = normalizeLicense("not-a-license-xyzzy-12345");
      expect(result).toEqual({ normalized: "UNKNOWN", wasChanged: true });
    });

    it("returns UNKNOWN with wasChanged=true for random words", () => {
      const result = normalizeLicense("banana pancake license");
      expect(result).toEqual({ normalized: "UNKNOWN", wasChanged: true });
    });
  });

  // ---- Deprecated SPDX forms ----

  describe("deprecated SPDX forms", () => {
    it("parses GPL-2.0 as valid SPDX (deprecated but parseable)", () => {
      const result = normalizeLicense("GPL-2.0");
      // spdx-expression-parse accepts deprecated identifiers
      expect(result.normalized).toBe("GPL-2.0");
      expect(result.wasChanged).toBe(false);
    });

    it("parses GPL-3.0 as valid SPDX (deprecated but parseable)", () => {
      const result = normalizeLicense("GPL-3.0");
      expect(result.normalized).toBe("GPL-3.0");
      expect(result.wasChanged).toBe(false);
    });
  });

  // ---- Whitespace handling ----

  describe("whitespace handling", () => {
    it("handles leading/trailing whitespace around MIT", () => {
      const result = normalizeLicense(" MIT ");
      // spdx-expression-parse may or may not accept this; if not, spdx-correct may fix it
      if (result.wasChanged) {
        expect(result.normalized).toBe("MIT");
      } else {
        // It parsed as-is (some versions of spdx-expression-parse trim)
        expect(result.normalized).toBe(" MIT ");
      }
    });
  });

  // ---- BSD alone ----

  describe("BSD alone", () => {
    it('corrects or handles "BSD" string', () => {
      const result = normalizeLicense("BSD");
      // spdx-correct may map "BSD" to a specific BSD variant, or it may become UNKNOWN
      expect(result.wasChanged).toBe(true);
      // It should either correct to a BSD variant or fall to UNKNOWN
      expect(["BSD-2-Clause", "BSD-3-Clause", "UNKNOWN"]).toContain(
        result.normalized,
      );
    });
  });
});

// ===========================================================================
// resolvePolicy
// ===========================================================================

describe("resolvePolicy", () => {
  // ---- Preset names ----

  describe("presets", () => {
    it("resolves permissive preset", () => {
      const licenses = resolvePolicy("permissive");
      expect(licenses).toContain("MIT");
      expect(licenses).toContain("ISC");
      expect(licenses).toContain("Apache-2.0");
      expect(licenses).toContain("BSD-2-Clause");
      expect(licenses).toContain("BSD-3-Clause");
      expect(licenses).toContain("0BSD");
      expect(licenses).toContain("Unlicense");
      expect(licenses).toContain("CC0-1.0");
      // Should NOT contain copyleft licenses
      expect(licenses).not.toContain("GPL-3.0-only");
      expect(licenses).not.toContain("GPL-2.0-only");
      expect(licenses).not.toContain("AGPL-3.0-only");
      expect(licenses).not.toContain("LGPL-3.0-only");
      expect(licenses).not.toContain("MPL-2.0");
    });

    it("resolves weak-copyleft preset", () => {
      const licenses = resolvePolicy("weak-copyleft");
      // Should include permissive + public-domain + weak-copyleft
      expect(licenses).toContain("MIT");
      expect(licenses).toContain("ISC");
      expect(licenses).toContain("Unlicense");
      expect(licenses).toContain("LGPL-3.0-only");
      expect(licenses).toContain("LGPL-2.1-only");
      expect(licenses).toContain("MPL-2.0");
      expect(licenses).toContain("EPL-2.0");
      // Should NOT contain strong/network copyleft
      expect(licenses).not.toContain("GPL-3.0-only");
      expect(licenses).not.toContain("GPL-2.0-only");
      expect(licenses).not.toContain("AGPL-3.0-only");
    });

    it("resolves copyleft preset", () => {
      const licenses = resolvePolicy("copyleft");
      // Should include everything except non-commercial/proprietary
      expect(licenses).toContain("MIT");
      expect(licenses).toContain("ISC");
      expect(licenses).toContain("Unlicense");
      expect(licenses).toContain("LGPL-3.0-only");
      expect(licenses).toContain("MPL-2.0");
      expect(licenses).toContain("GPL-3.0-only");
      expect(licenses).toContain("GPL-2.0-only");
      expect(licenses).toContain("AGPL-3.0-only");
      expect(licenses).toContain("AGPL-3.0-or-later");
    });
  });

  // ---- Custom expressions ----

  describe("custom expressions", () => {
    it("extracts single license identifier", () => {
      const licenses = resolvePolicy("MIT");
      expect(licenses).toEqual(["MIT"]);
    });

    it("extracts identifiers from OR expression", () => {
      const licenses = resolvePolicy("(MIT OR BSD-2-Clause)");
      expect(licenses).toContain("MIT");
      expect(licenses).toContain("BSD-2-Clause");
      expect(licenses).toHaveLength(2);
    });

    it("extracts identifiers from AND expression", () => {
      const licenses = resolvePolicy("(MIT AND Apache-2.0)");
      expect(licenses).toContain("MIT");
      expect(licenses).toContain("Apache-2.0");
      expect(licenses).toHaveLength(2);
    });

    it("extracts identifiers from complex nested expression", () => {
      const licenses = resolvePolicy("(MIT OR (BSD-2-Clause AND Apache-2.0))");
      expect(licenses).toContain("MIT");
      expect(licenses).toContain("BSD-2-Clause");
      expect(licenses).toContain("Apache-2.0");
      expect(licenses).toHaveLength(3);
    });
  });

  // ---- Fallback behavior ----

  describe("fallback", () => {
    it("falls back to single-element array for non-parseable string", () => {
      const licenses = resolvePolicy("CustomLicense");
      expect(licenses).toEqual(["CustomLicense"]);
    });

    it("falls back for garbage input", () => {
      const licenses = resolvePolicy("not valid at all!!!");
      expect(licenses).toEqual(["not valid at all!!!"]);
    });

    it("returns single-element array for empty string", () => {
      // Empty string is falsy, won't match any preset key, spdxParse("") will throw
      const licenses = resolvePolicy("");
      expect(licenses).toEqual([""]);
    });
  });

  // ---- Case sensitivity ----

  describe("case sensitivity", () => {
    it("does NOT match Permissive as a preset (case-sensitive)", () => {
      const licenses = resolvePolicy("Permissive");
      // Should not resolve as the permissive preset
      // Instead it should try parsing as SPDX, fail, and fall back
      expect(licenses).toEqual(["Permissive"]);
    });

    it("does NOT match PERMISSIVE as a preset", () => {
      const licenses = resolvePolicy("PERMISSIVE");
      expect(licenses).toEqual(["PERMISSIVE"]);
    });

    it("does NOT match Copyleft as a preset", () => {
      const licenses = resolvePolicy("Copyleft");
      expect(licenses).toEqual(["Copyleft"]);
    });
  });
});

// ===========================================================================
// evaluatePackage
// ===========================================================================

describe("evaluatePackage", () => {
  const allowed = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"];
  const chain = ["my-app", "some-dep"];

  // ---- Allowed licenses ----

  describe("allowed licenses", () => {
    it("returns no issues for MIT against permissive list", () => {
      const issues = evaluatePackage(makePkg({ licenses: "MIT" }), allowed, chain);
      expect(issues).toHaveLength(0);
    });

    it("returns no issues for ISC against [MIT, ISC]", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "ISC" }),
        ["MIT", "ISC"],
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("returns no issues for Apache-2.0", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "Apache-2.0" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("returns no issues for BSD-2-Clause", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "BSD-2-Clause" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("returns no issues for BSD-3-Clause", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "BSD-3-Clause" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });
  });

  // ---- OR expressions ----

  describe("OR expressions", () => {
    it("allows (MIT OR GPL-3.0-only) when MIT is in allowed list", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "(MIT OR GPL-3.0-only)" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("disallows (GPL-2.0-only OR GPL-3.0-only) when neither is allowed", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "(GPL-2.0-only OR GPL-3.0-only)" }),
        allowed,
        chain,
      );
      const critical = issues.filter((i) => i.severity === "critical");
      expect(critical).toHaveLength(1);
      expect(critical[0].license).toBe("(GPL-2.0-only OR GPL-3.0-only)");
    });

    it("allows (GPL-3.0-only OR Apache-2.0) when Apache-2.0 is allowed", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "(GPL-3.0-only OR Apache-2.0)" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });
  });

  // ---- Disallowed licenses ----

  describe("disallowed licenses", () => {
    it("returns critical for GPL-3.0-only against permissive list", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("critical");
      expect(issues[0].license).toBe("GPL-3.0-only");
      expect(issues[0].reason).toContain("not allowed");
    });

    it("returns critical for AGPL-3.0-only against permissive list", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "AGPL-3.0-only" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("critical");
      expect(issues[0].license).toBe("AGPL-3.0-only");
    });

    it("returns critical for GPL-2.0-only against permissive list", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-2.0-only" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("critical");
    });

    it("returns critical for LGPL-3.0-only against permissive list", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "LGPL-3.0-only" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("critical");
    });
  });

  // ---- UNKNOWN / UNLICENSED / empty ----

  describe("UNKNOWN, UNLICENSED, and empty", () => {
    it("returns warning for UNKNOWN license", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "UNKNOWN" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
      expect(issues[0].license).toBe("UNKNOWN");
      expect(issues[0].reason).toContain("could not be determined");
    });

    it("returns warning for UNLICENSED", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "UNLICENSED" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
      expect(issues[0].license).toBe("UNLICENSED");
      expect(issues[0].reason).toContain("UNLICENSED");
      expect(issues[0].reason).toContain("manual review");
    });

    it("returns warning for empty license string (becomes UNKNOWN)", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
      expect(issues[0].license).toBe("UNKNOWN");
    });

    it("returns early for UNKNOWN — no critical issue follows", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "UNKNOWN" }),
        allowed,
        chain,
      );
      // Should only have the one warning, no critical
      expect(issues).toHaveLength(1);
      expect(issues.every((i) => i.severity === "warning")).toBe(true);
    });

    it("returns early for UNLICENSED — no critical issue follows", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "UNLICENSED" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues.every((i) => i.severity === "warning")).toBe(true);
    });
  });

  // ---- Auto-correction ----

  describe("auto-correction", () => {
    it("reports auto-corrected license as info and allows if corrected form is allowed", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "Apache 2.0" }),
        allowed,
        chain,
      );
      // Should have exactly one info issue for the correction, no critical
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("info");
      expect(issues[0].correctedLicense).toBe("Apache-2.0");
      expect(issues[0].reason).toContain("auto-corrected");
      expect(issues[0].reason).toContain("Apache 2.0");
      expect(issues[0].reason).toContain("Apache-2.0");
    });

    it("reports both info and critical when auto-corrected to disallowed license", () => {
      // "GPL3" gets corrected to GPL-3.0-only (or similar), which is not in allowed
      const result = normalizeLicense("GPL3");
      // Ensure it is actually correctable first
      if (result.normalized !== "UNKNOWN") {
        const issues = evaluatePackage(
          makePkg({ licenses: "GPL3" }),
          allowed,
          chain,
        );
        const info = issues.filter((i) => i.severity === "info");
        const critical = issues.filter((i) => i.severity === "critical");
        expect(info).toHaveLength(1);
        expect(info[0].correctedLicense).toBe(result.normalized);
        expect(critical).toHaveLength(1);
        expect(critical[0].license).toBe(result.normalized);
        // Total should be 2 issues
        expect(issues).toHaveLength(2);
      }
    });

    it("returns warning (not info+critical) when garbage cannot be corrected", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "totally-fake-license-xyz" }),
        allowed,
        chain,
      );
      // normalizeLicense returns UNKNOWN with wasChanged=true
      // But the code only emits info if wasChanged AND normalized !== "UNKNOWN"
      // Since normalized === "UNKNOWN", no info is emitted, just the warning
      const warnings = issues.filter((i) => i.severity === "warning");
      const infos = issues.filter((i) => i.severity === "info");
      expect(warnings).toHaveLength(1);
      expect(infos).toHaveLength(0);
    });

    it("sets correctedLicense field on info issues", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "Apache 2.0" }),
        allowed,
        chain,
      );
      const info = issues.find((i) => i.severity === "info");
      expect(info).toBeDefined();
      expect(info!.correctedLicense).toBe("Apache-2.0");
    });

    it("does not set correctedLicense on non-info issues", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].correctedLicense).toBeUndefined();
    });
  });

  // ---- Package metadata preservation ----

  describe("metadata preservation", () => {
    it("preserves packageName and version in issues", () => {
      const issues = evaluatePackage(
        makePkg({
          packageName: "my-special-pkg",
          version: "3.2.1",
          licenses: "GPL-3.0-only",
        }),
        allowed,
        chain,
      );
      expect(issues[0].packageName).toBe("my-special-pkg");
      expect(issues[0].version).toBe("3.2.1");
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

    it("preserves empty dependency chain", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        [],
      );
      expect(issues[0].dependencyChain).toEqual([]);
    });

    it("preserves original license string in the license field for auto-corrected info", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "Apache 2.0" }),
        allowed,
        chain,
      );
      const info = issues.find((i) => i.severity === "info");
      expect(info).toBeDefined();
      expect(info!.license).toBe("Apache 2.0");
    });

    it("uses normalized license in the license field for critical issues", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        chain,
      );
      expect(issues[0].license).toBe("GPL-3.0-only");
    });
  });

  // ---- AND expressions ----

  describe("AND expressions", () => {
    it("allows (MIT AND Apache-2.0) when both are in allowed list", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "(MIT AND Apache-2.0)" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("disallows (MIT AND GPL-3.0-only) when GPL-3.0-only is not allowed", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "(MIT AND GPL-3.0-only)" }),
        allowed,
        chain,
      );
      const critical = issues.filter((i) => i.severity === "critical");
      expect(critical).toHaveLength(1);
      expect(critical[0].license).toBe("(MIT AND GPL-3.0-only)");
    });

    it("allows (MIT AND ISC AND BSD-2-Clause) when all are allowed", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "(MIT AND ISC AND BSD-2-Clause)" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });
  });

  // ---- Multiple issues for one package ----

  describe("multiple issues per package", () => {
    it("returns both info and critical for auto-corrected disallowed license", () => {
      // "GPLv3" should auto-correct to some GPL-3.0 form and then be disallowed
      const normalized = normalizeLicense("GPLv3");
      if (normalized.wasChanged && normalized.normalized !== "UNKNOWN") {
        const issues = evaluatePackage(
          makePkg({ licenses: "GPLv3" }),
          allowed,
          chain,
        );
        expect(issues.length).toBeGreaterThanOrEqual(2);
        const severities = issues.map((i) => i.severity);
        expect(severities).toContain("info");
        expect(severities).toContain("critical");
      }
    });
  });

  // ---- Integration with resolvePolicy presets ----

  describe("integration with resolvePolicy presets", () => {
    it("MIT is allowed under permissive policy", () => {
      const permissive = resolvePolicy("permissive");
      const issues = evaluatePackage(
        makePkg({ licenses: "MIT" }),
        permissive,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("ISC is allowed under permissive policy", () => {
      const permissive = resolvePolicy("permissive");
      const issues = evaluatePackage(
        makePkg({ licenses: "ISC" }),
        permissive,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("0BSD is allowed under permissive policy", () => {
      const permissive = resolvePolicy("permissive");
      const issues = evaluatePackage(
        makePkg({ licenses: "0BSD" }),
        permissive,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("Unlicense is allowed under permissive policy", () => {
      const permissive = resolvePolicy("permissive");
      const issues = evaluatePackage(
        makePkg({ licenses: "Unlicense" }),
        permissive,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("GPL-3.0-only is critical under permissive policy", () => {
      const permissive = resolvePolicy("permissive");
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        permissive,
        chain,
      );
      const critical = issues.filter((i) => i.severity === "critical");
      expect(critical).toHaveLength(1);
    });

    it("AGPL-3.0-only is critical under permissive policy", () => {
      const permissive = resolvePolicy("permissive");
      const issues = evaluatePackage(
        makePkg({ licenses: "AGPL-3.0-only" }),
        permissive,
        chain,
      );
      const critical = issues.filter((i) => i.severity === "critical");
      expect(critical).toHaveLength(1);
    });

    it("LGPL-3.0-only is critical under permissive policy", () => {
      const permissive = resolvePolicy("permissive");
      const issues = evaluatePackage(
        makePkg({ licenses: "LGPL-3.0-only" }),
        permissive,
        chain,
      );
      const critical = issues.filter((i) => i.severity === "critical");
      expect(critical).toHaveLength(1);
    });

    it("GPL-3.0-only is allowed under copyleft policy", () => {
      const copyleft = resolvePolicy("copyleft");
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        copyleft,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("AGPL-3.0-only is allowed under copyleft policy", () => {
      const copyleft = resolvePolicy("copyleft");
      const issues = evaluatePackage(
        makePkg({ licenses: "AGPL-3.0-only" }),
        copyleft,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("GPL-3.0-only is critical under weak-copyleft policy", () => {
      const weakCopyleft = resolvePolicy("weak-copyleft");
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        weakCopyleft,
        chain,
      );
      const critical = issues.filter((i) => i.severity === "critical");
      expect(critical).toHaveLength(1);
    });

    it("LGPL-3.0-only is allowed under weak-copyleft policy", () => {
      const weakCopyleft = resolvePolicy("weak-copyleft");
      const issues = evaluatePackage(
        makePkg({ licenses: "LGPL-3.0-only" }),
        weakCopyleft,
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("MPL-2.0 is allowed under weak-copyleft policy", () => {
      const weakCopyleft = resolvePolicy("weak-copyleft");
      const issues = evaluatePackage(
        makePkg({ licenses: "MPL-2.0" }),
        weakCopyleft,
        chain,
      );
      expect(issues).toHaveLength(0);
    });
  });

  // ---- Reason text verification ----

  describe("reason text", () => {
    it("critical reason mentions the license is not allowed", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        chain,
      );
      expect(issues[0].reason).toContain("GPL-3.0-only");
      expect(issues[0].reason).toContain("not allowed");
    });

    it("UNKNOWN reason mentions manual review", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "UNKNOWN" }),
        allowed,
        chain,
      );
      expect(issues[0].reason).toContain("manual review");
    });

    it("UNLICENSED reason mentions manual review", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "UNLICENSED" }),
        allowed,
        chain,
      );
      expect(issues[0].reason).toContain("manual review");
    });

    it("auto-correction reason mentions original and corrected form", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "Apache 2.0" }),
        allowed,
        chain,
      );
      const info = issues.find((i) => i.severity === "info");
      expect(info).toBeDefined();
      expect(info!.reason).toContain("Apache 2.0");
      expect(info!.reason).toContain("Apache-2.0");
      expect(info!.reason).toContain("auto-corrected");
    });
  });
});
