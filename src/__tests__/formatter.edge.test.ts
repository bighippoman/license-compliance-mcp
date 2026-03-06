import { describe, it, expect } from "vitest";
import { formatReport, formatLicenseExplanation } from "../formatter.js";
import type {
  ComplianceReport,
  ComplianceIssue,
  LicenseExplanation,
} from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(overrides: Partial<ComplianceIssue> = {}): ComplianceIssue {
  return {
    severity: "critical",
    packageName: "some-pkg",
    version: "1.0.0",
    license: "GPL-3.0-only",
    reason: "Not allowed",
    dependencyChain: ["root", "some-pkg"],
    ...overrides,
  };
}

function makeReport(
  overrides: Partial<ComplianceReport> = {},
): ComplianceReport {
  return {
    totalPackages: 100,
    issueCount: 0,
    issues: [],
    scannedPath: "/project",
    policy: "permissive",
    timestamp: "2026-03-06T00:00:00.000Z",
    ...overrides,
  };
}

function makeExplanation(
  overrides: Partial<LicenseExplanation> = {},
): LicenseExplanation {
  return {
    identifier: "MIT",
    name: "MIT License",
    category: "permissive",
    summary:
      "A short, permissive license with conditions only requiring preservation of copyright.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Private use",
    ],
    conditions: ["Include copyright and license notice"],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: ["Must include original license text in distributions"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatReport edge cases
// ---------------------------------------------------------------------------

describe("formatReport edge cases", () => {
  // ---- issueCount / issues array mismatch ----

  describe("issueCount vs issues array mismatch", () => {
    it("issueCount > 0 but issues array is empty should NOT show 'All dependencies comply'", () => {
      const report = makeReport({ issueCount: 3, issues: [] });
      const md = formatReport(report);
      expect(md).not.toContain("All dependencies comply");
    });

    it("issueCount = 0 but issues array is non-empty should show 'All dependencies comply'", () => {
      const report = makeReport({
        issueCount: 0,
        issues: [makeIssue({ severity: "critical", packageName: "sneaky" })],
      });
      const md = formatReport(report);
      expect(md).toContain("All dependencies comply");
    });
  });

  // ---- All issues same severity ----

  describe("all issues share the same severity", () => {
    it("only one severity section header appears", () => {
      const issues = Array.from({ length: 4 }, (_, i) =>
        makeIssue({
          severity: "warning",
          packageName: `warn-pkg-${i}`,
          version: "1.0.0",
        }),
      );
      const report = makeReport({ issueCount: 4, issues });
      const md = formatReport(report);

      expect(md).toContain("WARNING (4)");
      expect(md).not.toContain("CRITICAL");
      expect(md).not.toContain("INFO");
    });
  });

  // ---- Already sorted vs reverse sorted ----

  describe("severity ordering", () => {
    it("issues already sorted by severity produce correct output", () => {
      const report = makeReport({
        issueCount: 3,
        issues: [
          makeIssue({ severity: "critical", packageName: "a" }),
          makeIssue({ severity: "warning", packageName: "b" }),
          makeIssue({ severity: "info", packageName: "c" }),
        ],
      });
      const md = formatReport(report);
      expect(md.indexOf("CRITICAL")).toBeLessThan(md.indexOf("WARNING"));
      expect(md.indexOf("WARNING")).toBeLessThan(md.indexOf("INFO"));
    });

    it("issues in reverse severity order still get sorted correctly", () => {
      const report = makeReport({
        issueCount: 3,
        issues: [
          makeIssue({ severity: "info", packageName: "c" }),
          makeIssue({ severity: "warning", packageName: "b" }),
          makeIssue({ severity: "critical", packageName: "a" }),
        ],
      });
      const md = formatReport(report);
      expect(md.indexOf("CRITICAL")).toBeLessThan(md.indexOf("WARNING"));
      expect(md.indexOf("WARNING")).toBeLessThan(md.indexOf("INFO"));
    });
  });

  // ---- Special markdown characters in fields ----

  describe("special markdown characters in package name", () => {
    it("bold syntax in package name is preserved literally", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ packageName: "**bold**" })],
      });
      const md = formatReport(report);
      expect(md).toContain("**bold**");
    });

    it("backticks in package name are preserved", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ packageName: "`backticks`" })],
      });
      const md = formatReport(report);
      expect(md).toContain("`backticks`");
    });

    it("link syntax in package name is preserved", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ packageName: "[link](http://x)" })],
      });
      const md = formatReport(report);
      expect(md).toContain("[link](http://x)");
    });

    it("html tags in package name are preserved", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ packageName: "<script>alert(1)</script>" })],
      });
      const md = formatReport(report);
      expect(md).toContain("<script>alert(1)</script>");
    });
  });

  describe("special markdown characters in license string", () => {
    it("SPDX expression with parentheses and OR", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ license: "(MIT OR Apache-2.0)" })],
      });
      const md = formatReport(report);
      expect(md).toContain("`(MIT OR Apache-2.0)`");
    });
  });

  describe("special markdown characters in reason string", () => {
    it("reason with markdown bold and backticks", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({ reason: "License `GPL` is **not** allowed in [policy]" }),
        ],
      });
      const md = formatReport(report);
      expect(md).toContain(
        "License `GPL` is **not** allowed in [policy]",
      );
    });
  });

  // ---- Very long field values ----

  describe("very long field values", () => {
    it("very long package name (100 chars)", () => {
      const longName = "a".repeat(100);
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ packageName: longName })],
      });
      const md = formatReport(report);
      expect(md).toContain(`**${longName}@1.0.0**`);
    });

    it("very long reason string (500 chars)", () => {
      const longReason = "x".repeat(500);
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ reason: longReason })],
      });
      const md = formatReport(report);
      expect(md).toContain(longReason);
    });

    it("very long dependency chain (20 elements)", () => {
      const chain = Array.from({ length: 20 }, (_, i) => `dep-${i}`);
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ dependencyChain: chain })],
      });
      const md = formatReport(report);
      const expectedChain = chain.join(" \u2192 ");
      expect(md).toContain(expectedChain);
    });
  });

  // ---- Empty string fields ----

  describe("empty string fields", () => {
    it("all string fields empty", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({
            packageName: "",
            version: "",
            license: "",
            reason: "",
          }),
        ],
      });
      const md = formatReport(report);
      // Should still produce output containing the bold marker and backtick structure
      expect(md).toContain("**@**");
      expect(md).toContain("``");
    });

    it("dependency chain with empty strings", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ dependencyChain: ["", "", ""] })],
      });
      const md = formatReport(report);
      // Three empty strings joined by " -> " should produce " -> " separators
      expect(md).toContain(" \u2192  \u2192 ");
    });
  });

  // ---- Path edge cases ----

  describe("scannedPath with special characters", () => {
    it("path containing spaces", () => {
      const report = makeReport({ scannedPath: "/path/to/my project/src" });
      const md = formatReport(report);
      expect(md).toContain("/path/to/my project/src");
    });

    it("path containing $ and & characters", () => {
      const report = makeReport({ scannedPath: "/path/$pecial/dir&name" });
      const md = formatReport(report);
      expect(md).toContain("/path/$pecial/dir&name");
    });
  });

  // ---- Unicode ----

  describe("unicode in fields", () => {
    it("unicode in package name", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ packageName: "\u00e4\u00f6\u00fc-\u00df-pkg" })],
      });
      const md = formatReport(report);
      expect(md).toContain("\u00e4\u00f6\u00fc-\u00df-pkg");
    });

    it("unicode in reason", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ reason: "License is \u274c forbidden \u2014 see policy \ud83d\udcdc" })],
      });
      const md = formatReport(report);
      expect(md).toContain("License is \u274c forbidden \u2014 see policy \ud83d\udcdc");
    });
  });

  // ---- Non-standard severity ----

  describe("non-standard severity value", () => {
    it("unknown severity gets grouped and uses default emoji", () => {
      const issue = makeIssue({ packageName: "mystery" }) as ComplianceIssue;
      // Force a non-standard severity via type cast
      (issue as { severity: string }).severity = "unknown";
      const report = makeReport({ issueCount: 1, issues: [issue] });
      const md = formatReport(report);
      // Should use default emoji (white circle) and uppercase the severity
      expect(md).toContain("UNKNOWN");
      expect(md).toContain("\u26aa");
      expect(md).toContain("mystery");
    });

    it("non-standard severity sorts after standard severities", () => {
      const criticalIssue = makeIssue({
        severity: "critical",
        packageName: "crit-pkg",
      });
      const unknownIssue = makeIssue({ packageName: "unk-pkg" }) as ComplianceIssue;
      (unknownIssue as { severity: string }).severity = "unknown";

      const report = makeReport({
        issueCount: 2,
        issues: [unknownIssue, criticalIssue],
      });
      const md = formatReport(report);
      expect(md.indexOf("CRITICAL")).toBeLessThan(md.indexOf("UNKNOWN"));
    });
  });

  // ---- Timestamp edge case ----

  describe("timestamp as empty string", () => {
    it("report still renders with empty timestamp", () => {
      const report = makeReport({ timestamp: "" });
      const md = formatReport(report);
      expect(md).toContain("**Time:** ");
      expect(md).toContain("# License Compliance Report");
    });
  });

  // ---- Very large totalPackages ----

  describe("very large totalPackages", () => {
    it("renders 999999 packages correctly", () => {
      const report = makeReport({ totalPackages: 999999 });
      const md = formatReport(report);
      expect(md).toContain("999999 packages");
    });
  });

  // ---- Negative issueCount ----

  describe("negative issueCount", () => {
    it("does not crash and does not show 'All dependencies comply'", () => {
      const report = makeReport({ issueCount: -1 });
      const md = formatReport(report);
      expect(md).toContain("**Issues:** -1");
      expect(md).not.toContain("All dependencies comply");
    });
  });

  // ---- Performance: 50 critical issues ----

  describe("50 critical issues", () => {
    const issues = Array.from({ length: 50 }, (_, i) =>
      makeIssue({
        severity: "critical",
        packageName: `bulk-pkg-${i}`,
        version: `${i}.0.0`,
        dependencyChain: ["root", `bulk-pkg-${i}`],
      }),
    );
    const report = makeReport({ issueCount: 50, issues });
    const md = formatReport(report);

    it("all 50 issues appear in output", () => {
      for (let i = 0; i < 50; i++) {
        expect(md).toContain(`bulk-pkg-${i}@${i}.0.0`);
      }
    });

    it("severity header shows correct count", () => {
      expect(md).toContain("CRITICAL (50)");
    });

    it("does not contain 'All dependencies comply'", () => {
      expect(md).not.toContain("All dependencies comply");
    });
  });

  // ---- correctedLicense empty string ----

  describe("correctedLicense is empty string", () => {
    it("should NOT show 'Corrected to' line since empty string is falsy", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ correctedLicense: "" })],
      });
      const md = formatReport(report);
      expect(md).not.toContain("Corrected to");
    });
  });
});

// ---------------------------------------------------------------------------
// formatLicenseExplanation edge cases
// ---------------------------------------------------------------------------

describe("formatLicenseExplanation edge cases", () => {
  // ---- All arrays empty ----

  describe("all arrays empty", () => {
    const explanation = makeExplanation({
      permissions: [],
      conditions: [],
      limitations: [],
      gotchas: [],
    });
    const md = formatLicenseExplanation(explanation);

    it("omits Permissions section", () => {
      expect(md).not.toContain("## Permissions");
    });

    it("omits Conditions section", () => {
      expect(md).not.toContain("## Conditions");
    });

    it("omits Limitations section", () => {
      expect(md).not.toContain("## Limitations");
    });

    it("omits Gotchas section", () => {
      expect(md).not.toContain("## Gotchas");
    });

    it("still contains Compatibility section", () => {
      expect(md).toContain("## Compatibility");
    });
  });

  // ---- Empty string scalar fields ----

  describe("empty string scalar fields", () => {
    it("empty summary produces blank line in output", () => {
      const explanation = makeExplanation({ summary: "" });
      const md = formatLicenseExplanation(explanation);
      // The summary line should be empty but the output should still have the structure
      expect(md).toContain("**SPDX Identifier:**");
      expect(md).toContain("## Compatibility");
    });

    it("empty name produces H1 with just '# '", () => {
      const explanation = makeExplanation({ name: "" });
      const md = formatLicenseExplanation(explanation);
      expect(md).toMatch(/^# \n/);
    });

    it("empty identifier produces empty backticks", () => {
      const explanation = makeExplanation({ identifier: "" });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain("**SPDX Identifier:** ``");
    });

    it("empty category produces line with no category text", () => {
      const explanation = makeExplanation({
        category: "" as LicenseExplanation["category"],
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain("**Category:** ");
    });
  });

  // ---- Very long summary ----

  describe("very long summary", () => {
    it("1000-char summary is included in full", () => {
      const longSummary = "S".repeat(1000);
      const explanation = makeExplanation({ summary: longSummary });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain(longSummary);
    });
  });

  // ---- Markdown special chars in permissions ----

  describe("permissions with markdown special characters", () => {
    it("backticks and bold in permission text are preserved", () => {
      const explanation = makeExplanation({
        permissions: [
          "Use in **commercial** products",
          "Modify `source code` freely",
          "Distribute [modified](http://example.com) copies",
        ],
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain("Use in **commercial** products");
      expect(md).toContain("Modify `source code` freely");
      expect(md).toContain("Distribute [modified](http://example.com) copies");
    });
  });

  // ---- Conditions with unicode emoji ----

  describe("conditions with unicode emoji", () => {
    it("emoji in conditions are preserved", () => {
      const explanation = makeExplanation({
        conditions: [
          "\ud83d\udcc4 Include license text",
          "\ud83d\udd17 Link to source",
          "\ud83c\udff7\ufe0f State changes",
        ],
      });
      const md = formatLicenseExplanation(explanation);
      // The formatter prefixes each condition with "- \ud83d\udccb " so the emoji from
      // the condition text follows immediately after
      expect(md).toContain("\ud83d\udccb \ud83d\udcc4 Include license text");
      expect(md).toContain("\ud83d\udccb \ud83d\udd17 Link to source");
      expect(md).toContain("\ud83d\udccb \ud83c\udff7\ufe0f State changes");
    });
  });

  // ---- Gotchas with backticks and code blocks ----

  describe("gotchas with backticks and code blocks", () => {
    it("backticks in gotcha text are preserved", () => {
      const explanation = makeExplanation({
        gotchas: [
          "Must include `LICENSE` file",
          "Code block: ```const x = 1;```",
        ],
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain("Must include `LICENSE` file");
      expect(md).toContain("Code block: ```const x = 1;```");
    });
  });

  // ---- Compatibility: all false ----

  describe("compatibility where all three are false", () => {
    it("all rows show 'No'", () => {
      const explanation = makeExplanation({
        compatibility: { proprietary: false, openSource: false, saas: false },
      });
      const md = formatLicenseExplanation(explanation);
      const lines = md.split("\n");
      const dataRows = lines.filter(
        (l) =>
          l.startsWith("|") &&
          !l.includes("---") &&
          !l.includes("Use Case"),
      );
      for (const row of dataRows) {
        expect(row).toContain("\u274c No");
      }
    });
  });

  // ---- Compatibility: all true ----

  describe("compatibility where all three are true", () => {
    it("all rows show 'Yes'", () => {
      const explanation = makeExplanation({
        compatibility: { proprietary: true, openSource: true, saas: true },
      });
      const md = formatLicenseExplanation(explanation);
      const lines = md.split("\n");
      const dataRows = lines.filter(
        (l) =>
          l.startsWith("|") &&
          !l.includes("---") &&
          !l.includes("Use Case"),
      );
      for (const row of dataRows) {
        expect(row).toContain("\u2705 Yes");
      }
    });
  });

  // ---- Single-item arrays ----

  describe("single-item arrays for each section", () => {
    const explanation = makeExplanation({
      permissions: ["Only permission"],
      conditions: ["Only condition"],
      limitations: ["Only limitation"],
      gotchas: ["Only gotcha"],
    });
    const md = formatLicenseExplanation(explanation);

    it("Permissions section appears with single item", () => {
      expect(md).toContain("## Permissions");
      expect(md).toContain("\u2705 Only permission");
    });

    it("Conditions section appears with single item", () => {
      expect(md).toContain("## Conditions");
      expect(md).toContain("\ud83d\udccb Only condition");
    });

    it("Limitations section appears with single item", () => {
      expect(md).toContain("## Limitations");
      expect(md).toContain("\u274c Only limitation");
    });

    it("Gotchas section appears with single item", () => {
      expect(md).toContain("## Gotchas");
      expect(md).toContain("\u26a0\ufe0f Only gotcha");
    });
  });

  // ---- Large arrays (20 items each) ----

  describe("20 items in each array section", () => {
    const permissions = Array.from({ length: 20 }, (_, i) => `Perm ${i}`);
    const conditions = Array.from({ length: 20 }, (_, i) => `Cond ${i}`);
    const limitations = Array.from({ length: 20 }, (_, i) => `Limit ${i}`);
    const gotchas = Array.from({ length: 20 }, (_, i) => `Gotcha ${i}`);
    const explanation = makeExplanation({
      permissions,
      conditions,
      limitations,
      gotchas,
    });
    const md = formatLicenseExplanation(explanation);

    it("all 20 permissions appear", () => {
      for (let i = 0; i < 20; i++) {
        expect(md).toContain(`Perm ${i}`);
      }
    });

    it("all 20 conditions appear", () => {
      for (let i = 0; i < 20; i++) {
        expect(md).toContain(`Cond ${i}`);
      }
    });

    it("all 20 limitations appear", () => {
      for (let i = 0; i < 20; i++) {
        expect(md).toContain(`Limit ${i}`);
      }
    });

    it("all 20 gotchas appear", () => {
      for (let i = 0; i < 20; i++) {
        expect(md).toContain(`Gotcha ${i}`);
      }
    });
  });

  // ---- Name with special characters ----

  describe("name with special characters", () => {
    it("quotes in name are preserved", () => {
      const explanation = makeExplanation({
        name: 'The "Do What You Want" License',
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain('# The "Do What You Want" License');
    });

    it("parentheses in name are preserved", () => {
      const explanation = makeExplanation({
        name: "Apache License (Version 2.0)",
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain("# Apache License (Version 2.0)");
    });

    it("ampersand in name is preserved", () => {
      const explanation = makeExplanation({
        name: "Smith & Wesson Public License",
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain("# Smith & Wesson Public License");
    });
  });
});
