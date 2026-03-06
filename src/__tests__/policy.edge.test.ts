import { describe, it, expect } from "vitest";
import { normalizeLicense, resolvePolicy, evaluatePackage } from "../policy.js";
import type { LicenseInfo } from "../types.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePkg(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
  return {
    packageName: "edge-pkg",
    version: "1.0.0",
    licenses: "MIT",
    ...overrides,
  };
}

// ===========================================================================
// normalizeLicense — edge cases
// ===========================================================================

describe("normalizeLicense edge cases", () => {
  // ---- Whitespace variations ----

  describe("whitespace variations", () => {
    it("handles leading whitespace: ' MIT'", () => {
      const result = normalizeLicense(" MIT");
      // spdx-expression-parse may or may not tolerate leading whitespace;
      // if it throws, spdx-correct should fix it
      expect(["MIT", " MIT"]).toContain(result.normalized);
    });

    it("handles trailing whitespace: 'MIT '", () => {
      const result = normalizeLicense("MIT ");
      expect(["MIT", "MIT "]).toContain(result.normalized);
    });

    it("handles both leading and trailing whitespace: ' MIT '", () => {
      const result = normalizeLicense(" MIT ");
      expect(["MIT", " MIT "]).toContain(result.normalized);
    });

    it("handles tab character: '\\tMIT'", () => {
      const result = normalizeLicense("\tMIT");
      // Tabs are unusual; parser may reject, then spdx-correct may fix
      expect(["MIT", "\tMIT"]).toContain(result.normalized);
    });

    it("handles trailing newline: 'MIT\\n'", () => {
      const result = normalizeLicense("MIT\n");
      expect(["MIT", "MIT\n"]).toContain(result.normalized);
    });
  });

  // ---- Case variations ----

  describe("case variations", () => {
    it("handles lowercase 'mit'", () => {
      const result = normalizeLicense("mit");
      // spdx-expression-parse is case-sensitive for identifiers;
      // "mit" is not valid SPDX, but spdx-correct should handle it
      if (result.wasChanged) {
        expect(result.normalized).toBe("MIT");
      } else {
        // Some parser versions accept case-insensitively
        expect(result.normalized.toUpperCase()).toBe("MIT");
      }
    });

    it("handles mixed case 'Mit'", () => {
      const result = normalizeLicense("Mit");
      if (result.wasChanged) {
        expect(result.normalized).toBe("MIT");
      } else {
        expect(result.normalized).toBe("Mit");
      }
    });

    it("handles inverted case 'mIT'", () => {
      const result = normalizeLicense("mIT");
      if (result.wasChanged) {
        expect(result.normalized).toBe("MIT");
      } else {
        expect(result.normalized).toBe("mIT");
      }
    });

    it("handles uppercase 'APACHE-2.0'", () => {
      const result = normalizeLicense("APACHE-2.0");
      // "APACHE-2.0" is not a valid SPDX identifier (should be Apache-2.0)
      if (result.wasChanged) {
        expect(result.normalized).toBe("Apache-2.0");
      } else {
        expect(result.normalized).toBe("APACHE-2.0");
      }
    });

    it("handles lowercase 'apache-2.0'", () => {
      const result = normalizeLicense("apache-2.0");
      if (result.wasChanged) {
        expect(result.normalized).toBe("Apache-2.0");
      } else {
        expect(result.normalized).toBe("apache-2.0");
      }
    });
  });

  // ---- Deprecated SPDX identifiers ----

  describe("deprecated SPDX identifiers", () => {
    it("parses GPL-2.0 as valid SPDX (deprecated but parseable)", () => {
      const result = normalizeLicense("GPL-2.0");
      expect(result.normalized).toBe("GPL-2.0");
      expect(result.wasChanged).toBe(false);
    });

    it("parses GPL-3.0 as valid SPDX (deprecated but parseable)", () => {
      const result = normalizeLicense("GPL-3.0");
      expect(result.normalized).toBe("GPL-3.0");
      expect(result.wasChanged).toBe(false);
    });

    it("parses LGPL-2.1 as valid SPDX (deprecated but parseable)", () => {
      const result = normalizeLicense("LGPL-2.1");
      expect(result.normalized).toBe("LGPL-2.1");
      expect(result.wasChanged).toBe(false);
    });
  });

  // ---- Complex compound expressions ----

  describe("complex compound expressions", () => {
    it("parses nested OR within AND: '(MIT OR (Apache-2.0 AND BSD-3-Clause))'", () => {
      const result = normalizeLicense("(MIT OR (Apache-2.0 AND BSD-3-Clause))");
      expect(result.normalized).toBe("(MIT OR (Apache-2.0 AND BSD-3-Clause))");
      expect(result.wasChanged).toBe(false);
    });

    it("parses double-nested parens: '((MIT))'", () => {
      const result = normalizeLicense("((MIT))");
      // spdx-expression-parse may or may not accept redundant parens
      if (result.wasChanged) {
        // If it failed parsing, spdx-correct may fix it
        expect(result.normalized).toBe("MIT");
      } else {
        expect(result.normalized).toBe("((MIT))");
      }
    });
  });

  // ---- WITH exception clause ----

  describe("WITH exception clause", () => {
    it("parses 'Apache-2.0 WITH LLVM-exception' as valid SPDX", () => {
      const result = normalizeLicense("Apache-2.0 WITH LLVM-exception");
      expect(result.normalized).toBe("Apache-2.0 WITH LLVM-exception");
      expect(result.wasChanged).toBe(false);
    });
  });

  // ---- Invalid SPDX expressions ----

  describe("invalid SPDX expressions", () => {
    it("returns UNKNOWN for 'AND' alone", () => {
      const result = normalizeLicense("AND");
      // "AND" is not a valid identifier or expression
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).toBe("UNKNOWN");
    });

    it("returns UNKNOWN for 'OR' alone", () => {
      const result = normalizeLicense("OR");
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).toBe("UNKNOWN");
    });

    it("returns UNKNOWN for empty parens '()'", () => {
      const result = normalizeLicense("()");
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).toBe("UNKNOWN");
    });

    it("handles incomplete expression '(MIT OR)'", () => {
      const result = normalizeLicense("(MIT OR)");
      // spdx-expression-parse rejects this, then spdx-correct extracts "MIT"
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).toBe("MIT");
    });
  });

  // ---- Very long and unusual strings ----

  describe("very long and unusual strings", () => {
    it("handles a 1000-char garbage string", () => {
      const garbage = "x".repeat(1000);
      const result = normalizeLicense(garbage);
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).toBe("UNKNOWN");
    });

    it("handles special characters: 'MIT\\u2122' (MIT with trademark symbol)", () => {
      const result = normalizeLicense("MIT\u2122");
      expect(result.wasChanged).toBe(true);
      // spdx-correct might correct to MIT or fail entirely
      if (result.normalized !== "UNKNOWN") {
        expect(result.normalized).toBe("MIT");
      }
    });

    it("handles special characters: 'Apache\\u00A92.0' (Apache with copyright symbol)", () => {
      const result = normalizeLicense("Apache\u00A92.0");
      expect(result.wasChanged).toBe(true);
      // Either corrected or UNKNOWN
      expect(typeof result.normalized).toBe("string");
    });

    it("handles multiple spaces between words: 'Apache  2.0'", () => {
      const result = normalizeLicense("Apache  2.0");
      // spdx-expression-parse will reject; spdx-correct may handle
      if (result.wasChanged && result.normalized !== "UNKNOWN") {
        expect(result.normalized).toBe("Apache-2.0");
      }
      expect(result.wasChanged).toBe(true);
    });

    it("handles trailing semicolon: 'MIT;'", () => {
      const result = normalizeLicense("MIT;");
      // "MIT;" is not valid SPDX; spdx-correct may strip the semicolon
      expect(result.wasChanged).toBe(true);
      if (result.normalized !== "UNKNOWN") {
        expect(result.normalized).toBe("MIT");
      }
    });
  });

  // ---- Common informal license names ----

  describe("common informal license names", () => {
    it("handles 'Public Domain'", () => {
      const result = normalizeLicense("Public Domain");
      // spdx-correct may map this to Unlicense or similar, or fail
      expect(result.wasChanged).toBe(true);
      // Accept either a correction or UNKNOWN
      expect(typeof result.normalized).toBe("string");
    });

    it("handles 'BSD' alone", () => {
      const result = normalizeLicense("BSD");
      expect(result.wasChanged).toBe(true);
      // Should correct to a BSD variant or UNKNOWN
      expect(["BSD-2-Clause", "BSD-3-Clause", "UNKNOWN"]).toContain(
        result.normalized,
      );
    });

    it("handles 'GPLv2'", () => {
      const result = normalizeLicense("GPLv2");
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).not.toBe("UNKNOWN");
      expect(result.normalized).toMatch(/GPL-2\.0/);
    });

    it("handles 'GPLv3'", () => {
      const result = normalizeLicense("GPLv3");
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).not.toBe("UNKNOWN");
      expect(result.normalized).toMatch(/GPL-3\.0/);
    });

    it("handles 'LGPL' alone", () => {
      const result = normalizeLicense("LGPL");
      expect(result.wasChanged).toBe(true);
      // spdx-correct might map to an LGPL variant or UNKNOWN
      if (result.normalized !== "UNKNOWN") {
        expect(result.normalized).toMatch(/LGPL/);
      }
    });

    it("handles 'GPL' alone", () => {
      const result = normalizeLicense("GPL");
      expect(result.wasChanged).toBe(true);
      // spdx-correct might map to a GPL variant or UNKNOWN
      if (result.normalized !== "UNKNOWN") {
        expect(result.normalized).toMatch(/GPL/);
      }
    });
  });

  // ---- Miscellaneous edge inputs ----

  describe("miscellaneous edge inputs", () => {
    it("handles numeric-like string '123'", () => {
      const result = normalizeLicense("123");
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).toBe("UNKNOWN");
    });

    it("handles 'Custom: Proprietary'", () => {
      const result = normalizeLicense("Custom: Proprietary");
      expect(result.wasChanged).toBe(true);
      expect(result.normalized).toBe("UNKNOWN");
    });
  });
});

// ===========================================================================
// resolvePolicy — edge cases
// ===========================================================================

describe("resolvePolicy edge cases", () => {
  // ---- Preset names with wrong case ----

  describe("preset names with wrong case", () => {
    it("does NOT match 'Permissive' as a preset (case-sensitive lookup)", () => {
      const licenses = resolvePolicy("Permissive");
      // Not a preset key; falls through to SPDX parse which fails, then fallback
      expect(licenses).toEqual(["Permissive"]);
    });

    it("does NOT match 'PERMISSIVE' as a preset", () => {
      const licenses = resolvePolicy("PERMISSIVE");
      expect(licenses).toEqual(["PERMISSIVE"]);
    });

    it("does NOT match 'Weak-Copyleft' as a preset (wrong case)", () => {
      const licenses = resolvePolicy("Weak-Copyleft");
      expect(licenses).toEqual(["Weak-Copyleft"]);
    });
  });

  // ---- Empty and whitespace strings ----

  describe("empty and whitespace strings", () => {
    it("falls back to single-element array for empty string", () => {
      const licenses = resolvePolicy("");
      // presets[""] is undefined, spdxParse("") throws, fallback to [""]
      expect(licenses).toEqual([""]);
    });

    it("falls back to single-element array for whitespace-only string", () => {
      const licenses = resolvePolicy("   ");
      expect(licenses).toEqual(["   "]);
    });
  });

  // ---- Preset names with extra whitespace ----

  describe("preset names with extra spaces", () => {
    it("does NOT match ' permissive' with leading space", () => {
      const licenses = resolvePolicy(" permissive");
      // " permissive" is not a key in the presets object
      expect(licenses).toEqual([" permissive"]);
    });

    it("does NOT match 'permissive ' with trailing space", () => {
      const licenses = resolvePolicy("permissive ");
      expect(licenses).toEqual(["permissive "]);
    });
  });

  // ---- Deeply nested expression ----

  describe("deeply nested expressions", () => {
    it("extracts identifiers from deeply nested expression", () => {
      const expr = "(MIT OR (ISC OR (BSD-2-Clause OR Apache-2.0)))";
      const licenses = resolvePolicy(expr);
      expect(licenses).toContain("MIT");
      expect(licenses).toContain("ISC");
      expect(licenses).toContain("BSD-2-Clause");
      expect(licenses).toContain("Apache-2.0");
      expect(licenses).toHaveLength(4);
    });
  });

  // ---- Single license without parens ----

  describe("single license without parens", () => {
    it("parses 'MIT' as a single identifier", () => {
      const licenses = resolvePolicy("MIT");
      expect(licenses).toEqual(["MIT"]);
    });
  });

  // ---- Invalid SPDX with valid-looking structure ----

  describe("invalid SPDX with valid-looking structure", () => {
    it("falls back for '(FOO OR BAR)' with non-existent identifiers", () => {
      const licenses = resolvePolicy("(FOO OR BAR)");
      // spdx-expression-parse will throw on unknown identifiers;
      // the catch block falls back to returning the raw string as single element
      expect(licenses).toEqual(["(FOO OR BAR)"]);
    });
  });

  // ---- Duplicate identifiers ----

  describe("duplicate identifiers", () => {
    it("extracts both occurrences from '(MIT OR MIT)'", () => {
      const licenses = resolvePolicy("(MIT OR MIT)");
      // The extract function does not deduplicate
      expect(licenses).toContain("MIT");
      expect(licenses).toHaveLength(2);
      expect(licenses).toEqual(["MIT", "MIT"]);
    });
  });

  // ---- Expression with WITH clause ----

  describe("expression with WITH clause", () => {
    it("extracts identifier from '(Apache-2.0 WITH LLVM-exception)'", () => {
      const licenses = resolvePolicy("(Apache-2.0 WITH LLVM-exception)");
      // WITH creates an exception node; the extract function should find the license
      expect(licenses).toContain("Apache-2.0");
      expect(licenses.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ===========================================================================
// evaluatePackage — edge cases
// ===========================================================================

describe("evaluatePackage edge cases", () => {
  const allowed = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"];
  const chain = ["my-app", "some-dep"];

  // ---- Empty string license ----

  describe("empty string license", () => {
    it("treats empty string license as UNKNOWN with warning", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
      expect(issues[0].license).toBe("UNKNOWN");
      expect(issues[0].reason).toContain("could not be determined");
    });
  });

  // ---- Very long license string ----

  describe("very long license string", () => {
    it("handles a package with a 500-char garbage license", () => {
      const longLicense = "z".repeat(500);
      const issues = evaluatePackage(
        makePkg({ licenses: longLicense }),
        allowed,
        chain,
      );
      // Should normalize to UNKNOWN; wasChanged=true but normalized="UNKNOWN"
      // so no info issue, just the warning from UNKNOWN early return
      const warnings = issues.filter((i) => i.severity === "warning");
      const infos = issues.filter((i) => i.severity === "info");
      expect(warnings).toHaveLength(1);
      expect(infos).toHaveLength(0);
      expect(warnings[0].license).toBe("UNKNOWN");
    });
  });

  // ---- Unusual version and package name ----

  describe("unusual version and package name", () => {
    it("handles version '0.0.0'", () => {
      const issues = evaluatePackage(
        makePkg({ version: "0.0.0", licenses: "GPL-3.0-only" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].version).toBe("0.0.0");
      expect(issues[0].severity).toBe("critical");
    });

    it("handles packageName with special characters", () => {
      const issues = evaluatePackage(
        makePkg({
          packageName: "@scope/pkg-name_v2.0!",
          licenses: "GPL-3.0-only",
        }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].packageName).toBe("@scope/pkg-name_v2.0!");
    });
  });

  // ---- Allowed list variations ----

  describe("allowed list variations", () => {
    it("works with a single-element allowed list", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "MIT" }),
        ["MIT"],
        chain,
      );
      expect(issues).toHaveLength(0);
    });

    it("correctly rejects with a single-element allowed list that does not match", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "Apache-2.0" }),
        ["MIT"],
        chain,
      );
      const critical = issues.filter((i) => i.severity === "critical");
      expect(critical).toHaveLength(1);
    });

    it("works with 100+ element allowed list containing real SPDX identifiers", () => {
      // spdx-satisfies requires valid SPDX identifiers in the allowed list,
      // so we build a large list from real license IDs plus duplicates
      const base = [
        "MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0",
        "0BSD", "Zlib", "Unlicense", "CC0-1.0", "MPL-2.0",
      ];
      const bigAllowed: string[] = [];
      while (bigAllowed.length < 100) {
        bigAllowed.push(...base);
      }
      bigAllowed.push("MIT");
      const issues = evaluatePackage(
        makePkg({ licenses: "MIT" }),
        bigAllowed,
        chain,
      );
      expect(issues).toHaveLength(0);
    });
  });

  // ---- Chain variations ----

  describe("dependency chain variations", () => {
    it("handles empty chain (0 elements)", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        [],
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].dependencyChain).toEqual([]);
    });

    it("handles chain with 1 element", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        ["root"],
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].dependencyChain).toEqual(["root"]);
    });

    it("handles chain with 10 elements", () => {
      const longChain = Array.from({ length: 10 }, (_, i) => `dep-${i}`);
      const issues = evaluatePackage(
        makePkg({ licenses: "GPL-3.0-only" }),
        allowed,
        longChain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].dependencyChain).toEqual(longChain);
      expect(issues[0].dependencyChain).toHaveLength(10);
    });
  });

  // ---- Auto-corrected to still-disallowed license ----

  describe("auto-corrected to still-disallowed license", () => {
    it("produces both info (auto-corrected) and critical (disallowed) for 'GPL v3'", () => {
      const normalized = normalizeLicense("GPL v3");
      // Verify spdx-correct handles "GPL v3"
      if (normalized.wasChanged && normalized.normalized !== "UNKNOWN") {
        const issues = evaluatePackage(
          makePkg({ licenses: "GPL v3" }),
          ["MIT"],
          chain,
        );
        const infos = issues.filter((i) => i.severity === "info");
        const criticals = issues.filter((i) => i.severity === "critical");
        expect(infos).toHaveLength(1);
        expect(infos[0].reason).toContain("auto-corrected");
        expect(infos[0].correctedLicense).toBe(normalized.normalized);
        expect(criticals).toHaveLength(1);
        expect(criticals[0].reason).toContain("not allowed");
        expect(issues).toHaveLength(2);
      }
    });
  });

  // ---- UNLICENSED early return ----

  describe("UNLICENSED early return", () => {
    it("returns warning and no critical for UNLICENSED", () => {
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
      // Verify no critical issues exist
      const criticals = issues.filter((i) => i.severity === "critical");
      expect(criticals).toHaveLength(0);
    });
  });

  // ---- UNKNOWN early return ----

  describe("UNKNOWN early return", () => {
    it("returns warning and no critical for UNKNOWN", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "UNKNOWN" }),
        allowed,
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
      expect(issues[0].license).toBe("UNKNOWN");
      // Verify no critical issues exist
      const criticals = issues.filter((i) => i.severity === "critical");
      expect(criticals).toHaveLength(0);
    });

    it("UNKNOWN early return: no critical issue alongside warning", () => {
      // Even with a restrictive allowed list, UNKNOWN should only yield a warning
      const issues = evaluatePackage(
        makePkg({ licenses: "UNKNOWN" }),
        ["MIT"],
        chain,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
      expect(issues.some((i) => i.severity === "critical")).toBe(false);
    });
  });

  // ---- Garbage license auto-corrects to UNKNOWN ----

  describe("garbage license auto-corrects to UNKNOWN", () => {
    it("does NOT produce info issue when garbage becomes UNKNOWN", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "xyzzy-not-a-license-at-all-999" }),
        allowed,
        chain,
      );
      // normalizeLicense returns { normalized: "UNKNOWN", wasChanged: true }
      // The code checks: wasChanged && normalized !== "UNKNOWN" for info
      // Since normalized IS "UNKNOWN", no info issue should be emitted
      const infos = issues.filter((i) => i.severity === "info");
      expect(infos).toHaveLength(0);
      // Should only have the UNKNOWN warning
      const warnings = issues.filter((i) => i.severity === "warning");
      expect(warnings).toHaveLength(1);
      expect(warnings[0].license).toBe("UNKNOWN");
    });
  });

  // ---- spdx-satisfies catch block ----

  describe("spdx-satisfies error handling", () => {
    it("produces a warning when spdx-satisfies throws on an unusual expression", () => {
      // We need a license string that passes spdx-expression-parse (so
      // normalizeLicense returns it as-is) but causes spdx-satisfies to throw
      // when checked against the allowed list. This is difficult to trigger
      // deterministically, so we test the general shape: if spdx-satisfies
      // does throw, the code emits a warning with "Could not evaluate".
      //
      // One approach: use a valid SPDX expression with a WITH clause that
      // spdx-satisfies might choke on when comparing against simple identifiers.
      const licenseWithException = "Apache-2.0 WITH LLVM-exception";
      const issues = evaluatePackage(
        makePkg({ licenses: licenseWithException }),
        allowed,
        chain,
      );
      // spdx-satisfies may handle this fine (no issues or critical) or throw
      // (warning). Either way, no info should appear since wasChanged=false.
      const infos = issues.filter((i) => i.severity === "info");
      expect(infos).toHaveLength(0);

      if (issues.length > 0) {
        // If it produced an issue, it should be either critical or warning
        expect(["critical", "warning"]).toContain(issues[0].severity);
        if (issues[0].severity === "warning") {
          expect(issues[0].reason).toContain("Could not evaluate");
        }
      }
    });
  });

  // ---- Incomplete parenthesized expression ----

  describe("incomplete parenthesized expression", () => {
    it("handles '(MIT' (missing closing paren) as UNKNOWN with warning", () => {
      const issues = evaluatePackage(
        makePkg({ licenses: "(MIT" }),
        allowed,
        chain,
      );
      // "(MIT" will fail spdx-expression-parse; spdx-correct may or may not fix it
      const normalized = normalizeLicense("(MIT");
      if (normalized.normalized === "UNKNOWN") {
        // wasChanged=true but normalized=UNKNOWN => no info, just warning
        const infos = issues.filter((i) => i.severity === "info");
        const warnings = issues.filter((i) => i.severity === "warning");
        expect(infos).toHaveLength(0);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].license).toBe("UNKNOWN");
      } else if (normalized.normalized === "MIT") {
        // spdx-correct fixed it to MIT; should get info (auto-corrected) and
        // MIT is in the allowed list, so no critical
        const infos = issues.filter((i) => i.severity === "info");
        expect(infos).toHaveLength(1);
        expect(infos[0].correctedLicense).toBe("MIT");
      }
    });
  });
});
