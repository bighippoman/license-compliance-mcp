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

function makeReport(overrides: Partial<ComplianceReport> = {}): ComplianceReport {
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

function makeMitExplanation(
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
// formatReport
// ---------------------------------------------------------------------------

describe("formatReport", () => {
  // ---- Clean report (0 issues) ----

  describe("clean report with 0 issues", () => {
    const md = formatReport(makeReport());

    it("contains the markdown header", () => {
      expect(md).toContain("# License Compliance Report");
    });

    it("contains the scanned path", () => {
      expect(md).toContain("/project");
    });

    it("contains the policy", () => {
      expect(md).toContain("permissive");
    });

    it("contains the package count", () => {
      expect(md).toContain("100 packages");
    });

    it("shows zero issues", () => {
      expect(md).toContain("Issues:** 0");
    });

    it("contains the 'All dependencies comply' message", () => {
      expect(md).toContain("All dependencies comply");
    });

    it("does NOT contain a CRITICAL section", () => {
      expect(md).not.toContain("CRITICAL");
    });

    it("does NOT contain a WARNING section", () => {
      expect(md).not.toContain("WARNING");
    });

    it("does NOT contain an INFO section", () => {
      expect(md).not.toContain("INFO");
    });
  });

  // ---- Report with only critical issues ----

  describe("report with only critical issues", () => {
    const report = makeReport({
      issueCount: 1,
      issues: [
        makeIssue({
          severity: "critical",
          packageName: "gpl-lib",
          version: "1.0.0",
          license: "GPL-3.0-only",
          reason: "Not allowed under permissive policy",
          dependencyChain: ["my-app", "dep-a", "gpl-lib"],
        }),
      ],
    });
    const md = formatReport(report);

    it("has a CRITICAL section", () => {
      expect(md).toContain("CRITICAL");
    });

    it("does NOT have a WARNING section", () => {
      expect(md).not.toContain("WARNING");
    });

    it("does NOT have an INFO section", () => {
      expect(md).not.toContain("INFO");
    });

    it("shows the package@version", () => {
      expect(md).toContain("gpl-lib@1.0.0");
    });

    it("shows the license in backticks", () => {
      expect(md).toContain("`GPL-3.0-only`");
    });

    it("shows the dependency chain with arrow separator", () => {
      expect(md).toContain("my-app → dep-a → gpl-lib");
    });
  });

  // ---- Report with only warning issues ----

  describe("report with only warning issues", () => {
    const report = makeReport({
      issueCount: 1,
      issues: [
        makeIssue({
          severity: "warning",
          packageName: "mystery",
          version: "2.0.0",
          license: "UNKNOWN",
          reason: "License could not be determined",
          dependencyChain: ["my-app", "mystery"],
        }),
      ],
    });
    const md = formatReport(report);

    it("has a WARNING section", () => {
      expect(md).toContain("WARNING");
    });

    it("does NOT have a CRITICAL section", () => {
      expect(md).not.toContain("CRITICAL");
    });

    it("does NOT have an INFO section", () => {
      expect(md).not.toContain("INFO");
    });

    it("shows the UNKNOWN license", () => {
      expect(md).toContain("`UNKNOWN`");
    });
  });

  // ---- Report with only info issues ----

  describe("report with only info issues", () => {
    const report = makeReport({
      issueCount: 1,
      issues: [
        makeIssue({
          severity: "info",
          packageName: "old-pkg",
          version: "1.0.0",
          license: "Apache 2.0",
          reason: "License was auto-corrected",
          dependencyChain: ["my-app", "old-pkg"],
          correctedLicense: "Apache-2.0",
        }),
      ],
    });
    const md = formatReport(report);

    it("has an INFO section", () => {
      expect(md).toContain("INFO");
    });

    it("does NOT have a CRITICAL section", () => {
      expect(md).not.toContain("CRITICAL");
    });

    it("does NOT have a WARNING section", () => {
      expect(md).not.toContain("WARNING");
    });
  });

  // ---- Mixed report (all 3 severities) ----

  describe("mixed report with all three severities", () => {
    const report = makeReport({
      issueCount: 3,
      issues: [
        makeIssue({
          severity: "info",
          packageName: "info-pkg",
          version: "1.0.0",
          license: "MIT",
          reason: "Auto-corrected",
          dependencyChain: ["root"],
        }),
        makeIssue({
          severity: "critical",
          packageName: "critical-pkg",
          version: "2.0.0",
          license: "GPL-3.0-only",
          reason: "Forbidden",
          dependencyChain: ["root"],
        }),
        makeIssue({
          severity: "warning",
          packageName: "warn-pkg",
          version: "3.0.0",
          license: "UNKNOWN",
          reason: "Unrecognized",
          dependencyChain: ["root"],
        }),
      ],
    });
    const md = formatReport(report);

    it("CRITICAL appears before WARNING", () => {
      expect(md.indexOf("CRITICAL")).toBeLessThan(md.indexOf("WARNING"));
    });

    it("WARNING appears before INFO", () => {
      expect(md.indexOf("WARNING")).toBeLessThan(md.indexOf("INFO"));
    });

    it("all three packages appear", () => {
      expect(md).toContain("critical-pkg@2.0.0");
      expect(md).toContain("warn-pkg@3.0.0");
      expect(md).toContain("info-pkg@1.0.0");
    });
  });

  // ---- Severity count in headers ----

  describe("issue count in severity headers", () => {
    const report = makeReport({
      issueCount: 5,
      issues: [
        makeIssue({ severity: "critical", packageName: "c1", version: "1.0.0" }),
        makeIssue({ severity: "critical", packageName: "c2", version: "1.0.0" }),
        makeIssue({ severity: "critical", packageName: "c3", version: "1.0.0" }),
        makeIssue({ severity: "warning", packageName: "w1", version: "1.0.0" }),
        makeIssue({ severity: "info", packageName: "i1", version: "1.0.0" }),
      ],
    });
    const md = formatReport(report);

    it("shows CRITICAL (3) in the header", () => {
      expect(md).toContain("CRITICAL (3)");
    });

    it("shows WARNING (1) in the header", () => {
      expect(md).toContain("WARNING (1)");
    });

    it("shows INFO (1) in the header", () => {
      expect(md).toContain("INFO (1)");
    });
  });

  // ---- Issue formatting details ----

  describe("individual issue formatting", () => {
    it("shows package@version in bold", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({
            packageName: "foo",
            version: "4.2.1",
            license: "LGPL-2.1",
            dependencyChain: ["root", "foo"],
          }),
        ],
      });
      const md = formatReport(report);
      expect(md).toContain("**foo@4.2.1**");
    });

    it("shows license wrapped in backticks", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({ license: "LGPL-2.1", dependencyChain: ["root", "x"] }),
        ],
      });
      const md = formatReport(report);
      expect(md).toContain("`LGPL-2.1`");
    });

    it("shows dependency chain joined with → separator", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({ dependencyChain: ["app", "lib-a", "lib-b", "target"] }),
        ],
      });
      const md = formatReport(report);
      expect(md).toContain("app → lib-a → lib-b → target");
    });
  });

  // ---- correctedLicense ----

  describe("correctedLicense handling", () => {
    it("shows 'Corrected to' line when correctedLicense is present", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({
            severity: "info",
            license: "Apache 2.0",
            correctedLicense: "Apache-2.0",
          }),
        ],
      });
      const md = formatReport(report);
      expect(md).toContain("Corrected to");
      expect(md).toContain("`Apache-2.0`");
    });

    it("does NOT show 'Corrected to' line when correctedLicense is absent", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({
            severity: "critical",
            license: "GPL-3.0-only",
            correctedLicense: undefined,
          }),
        ],
      });
      const md = formatReport(report);
      expect(md).not.toContain("Corrected to");
    });
  });

  // ---- Many issues (10+) ----

  describe("report with many issues (10+)", () => {
    const issues: ComplianceIssue[] = Array.from({ length: 12 }, (_, i) =>
      makeIssue({
        severity: "critical",
        packageName: `pkg-${i}`,
        version: `${i}.0.0`,
        dependencyChain: ["root", `pkg-${i}`],
      }),
    );
    const report = makeReport({ issueCount: 12, issues });
    const md = formatReport(report);

    it("all 12 issues appear in the output", () => {
      for (let i = 0; i < 12; i++) {
        expect(md).toContain(`pkg-${i}@${i}.0.0`);
      }
    });

    it("severity header shows the correct count", () => {
      expect(md).toContain("CRITICAL (12)");
    });
  });

  // ---- Dependency chain edge cases ----

  describe("dependency chain edge cases", () => {
    it("single-element chain (empty chain scenario)", () => {
      const report = makeReport({
        issueCount: 1,
        issues: [
          makeIssue({
            dependencyChain: ["standalone-pkg"],
          }),
        ],
      });
      const md = formatReport(report);
      expect(md).toContain("standalone-pkg");
      // Should NOT contain the arrow since there is only one element
      expect(md).not.toMatch(/standalone-pkg →/);
    });

    it("long dependency chain (5 elements) joins all with →", () => {
      const chain = ["app", "lev1", "lev2", "lev3", "deep-target"];
      const report = makeReport({
        issueCount: 1,
        issues: [makeIssue({ dependencyChain: chain })],
      });
      const md = formatReport(report);
      expect(md).toContain("app → lev1 → lev2 → lev3 → deep-target");
    });
  });

  // ---- Different policy strings ----

  describe("different policies appear in output", () => {
    it("shows 'permissive' policy", () => {
      const md = formatReport(makeReport({ policy: "permissive" }));
      expect(md).toContain("permissive");
    });

    it("shows 'copyleft' policy", () => {
      const md = formatReport(makeReport({ policy: "copyleft" }));
      expect(md).toContain("copyleft");
    });

    it("shows a custom SPDX expression policy", () => {
      const md = formatReport(
        makeReport({ policy: "MIT OR Apache-2.0" }),
      );
      expect(md).toContain("MIT OR Apache-2.0");
    });
  });

  // ---- Timestamp and scannedPath appear ----

  describe("metadata fields", () => {
    it("timestamp appears in output", () => {
      const ts = "2025-12-25T12:00:00.000Z";
      const md = formatReport(makeReport({ timestamp: ts }));
      expect(md).toContain(ts);
    });

    it("scannedPath appears in output", () => {
      const path = "/home/user/my-monorepo/packages/core";
      const md = formatReport(makeReport({ scannedPath: path }));
      expect(md).toContain(path);
    });
  });

  // ---- Duplicate severity issues ----

  describe("report with duplicate severity issues (5 criticals)", () => {
    const issues: ComplianceIssue[] = Array.from({ length: 5 }, (_, i) =>
      makeIssue({
        severity: "critical",
        packageName: `crit-${i}`,
        version: "1.0.0",
      }),
    );
    const report = makeReport({ issueCount: 5, issues });
    const md = formatReport(report);

    it("all 5 critical issues are listed", () => {
      for (let i = 0; i < 5; i++) {
        expect(md).toContain(`crit-${i}@1.0.0`);
      }
    });

    it("severity header shows (5)", () => {
      expect(md).toContain("CRITICAL (5)");
    });
  });

  // ---- Edge case: 0 totalPackages but issues exist ----

  describe("0 totalPackages but issues present", () => {
    const report = makeReport({
      totalPackages: 0,
      issueCount: 1,
      issues: [
        makeIssue({ severity: "warning", packageName: "orphan", version: "0.0.1" }),
      ],
    });
    const md = formatReport(report);

    it("shows 0 packages", () => {
      expect(md).toContain("0 packages");
    });

    it("still renders the warning issue", () => {
      expect(md).toContain("orphan@0.0.1");
      expect(md).toContain("WARNING");
    });
  });
});

// ---------------------------------------------------------------------------
// formatLicenseExplanation
// ---------------------------------------------------------------------------

describe("formatLicenseExplanation", () => {
  // ---- MIT license — full structure ----

  describe("MIT license explanation", () => {
    const mit = makeMitExplanation();
    const md = formatLicenseExplanation(mit);

    it("starts with a markdown H1 title", () => {
      expect(md).toMatch(/^# MIT License/);
    });

    it("contains the SPDX identifier in backticks", () => {
      expect(md).toContain("`MIT`");
    });

    it("contains the category", () => {
      expect(md).toContain("permissive");
    });

    it("contains the summary text", () => {
      expect(md).toContain(
        "A short, permissive license with conditions only requiring preservation of copyright.",
      );
    });
  });

  // ---- Permissions section ----

  describe("Permissions section", () => {
    it("has a ## Permissions heading", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("## Permissions");
    });

    it("lists each permission with a checkmark", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("- ✅ Commercial use");
      expect(md).toContain("- ✅ Modification");
      expect(md).toContain("- ✅ Distribution");
      expect(md).toContain("- ✅ Private use");
    });
  });

  // ---- Conditions section ----

  describe("Conditions section", () => {
    it("has a ## Conditions heading when conditions exist", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("## Conditions");
    });

    it("lists each condition", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("Include copyright and license notice");
    });

    it("omits the Conditions section when conditions array is empty", () => {
      const explanation = makeMitExplanation({
        identifier: "0BSD",
        name: "BSD Zero Clause License",
        conditions: [],
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).not.toContain("## Conditions");
    });
  });

  // ---- Limitations section ----

  describe("Limitations section", () => {
    it("has a ## Limitations heading", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("## Limitations");
    });

    it("lists each limitation with ❌ prefix", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("- ❌ No liability");
      expect(md).toContain("- ❌ No warranty");
    });
  });

  // ---- Compatibility table ----

  describe("Compatibility table", () => {
    it("has a ## Compatibility heading", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("## Compatibility");
    });

    it("shows Yes/No values correctly", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("Proprietary/Commercial");
      expect(md).toContain("Open Source");
      expect(md).toContain("SaaS/Network Use");
    });

    it("shows ❌ No for proprietary when proprietary=false", () => {
      const explanation = makeMitExplanation({
        compatibility: { proprietary: false, openSource: true, saas: true },
      });
      const md = formatLicenseExplanation(explanation);
      // The Proprietary/Commercial row should contain "❌ No"
      const lines = md.split("\n");
      const proprietaryRow = lines.find((l) =>
        l.includes("Proprietary/Commercial"),
      );
      expect(proprietaryRow).toBeDefined();
      expect(proprietaryRow).toContain("❌ No");
    });

    it("shows ❌ No for SaaS when saas=false (e.g. AGPL scenario)", () => {
      const explanation = makeMitExplanation({
        identifier: "AGPL-3.0-only",
        name: "GNU Affero General Public License v3.0",
        category: "network-copyleft",
        compatibility: { proprietary: false, openSource: true, saas: false },
      });
      const md = formatLicenseExplanation(explanation);
      const lines = md.split("\n");
      const saasRow = lines.find((l) => l.includes("SaaS/Network Use"));
      expect(saasRow).toBeDefined();
      expect(saasRow).toContain("❌ No");
    });

    it("shows all ✅ Yes when all compatibilities are true", () => {
      const explanation = makeMitExplanation({
        compatibility: { proprietary: true, openSource: true, saas: true },
      });
      const md = formatLicenseExplanation(explanation);
      const lines = md.split("\n");
      const tableRows = lines.filter((l) => l.startsWith("|") && !l.includes("---"));
      // 3 data rows (Proprietary, Open Source, SaaS) + 1 header row
      const dataRows = tableRows.filter(
        (l) => !l.includes("Use Case"),
      );
      for (const row of dataRows) {
        expect(row).toContain("✅ Yes");
      }
    });
  });

  // ---- Gotchas section ----

  describe("Gotchas section", () => {
    it("has a ## Gotchas heading", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("## Gotchas");
    });

    it("lists a single gotcha", () => {
      const md = formatLicenseExplanation(makeMitExplanation());
      expect(md).toContain("Must include original license text in distributions");
    });

    it("lists multiple gotchas when there are several", () => {
      const explanation = makeMitExplanation({
        gotchas: [
          "First gotcha about distribution",
          "Second gotcha about modification",
          "Third gotcha about patent grants",
        ],
      });
      const md = formatLicenseExplanation(explanation);
      expect(md).toContain("First gotcha about distribution");
      expect(md).toContain("Second gotcha about modification");
      expect(md).toContain("Third gotcha about patent grants");
    });

    it("omits the Gotchas section when gotchas array is empty", () => {
      const explanation = makeMitExplanation({ gotchas: [] });
      const md = formatLicenseExplanation(explanation);
      expect(md).not.toContain("## Gotchas");
    });
  });

  // ---- Empty permissions array ----

  describe("empty permissions array", () => {
    it("omits the Permissions section", () => {
      const explanation = makeMitExplanation({ permissions: [] });
      const md = formatLicenseExplanation(explanation);
      expect(md).not.toContain("## Permissions");
    });
  });

  // ---- Empty limitations array ----

  describe("empty limitations array", () => {
    it("omits the Limitations section", () => {
      const explanation = makeMitExplanation({ limitations: [] });
      const md = formatLicenseExplanation(explanation);
      expect(md).not.toContain("## Limitations");
    });
  });

  // ---- Many permissions (5+) ----

  describe("explanation with many permissions (5+)", () => {
    const permissions = [
      "Commercial use",
      "Modification",
      "Distribution",
      "Private use",
      "Patent use",
      "Sublicensing",
    ];
    const explanation = makeMitExplanation({ permissions });
    const md = formatLicenseExplanation(explanation);

    it("lists all 6 permissions", () => {
      for (const perm of permissions) {
        expect(md).toContain(`- ✅ ${perm}`);
      }
    });
  });

  // ---- Markdown structure ----

  describe("markdown structure", () => {
    const md = formatLicenseExplanation(makeMitExplanation());

    it("starts with a # heading", () => {
      expect(md).toMatch(/^#\s/);
    });

    it("has ## section headings", () => {
      const h2Matches = md.match(/^## /gm);
      expect(h2Matches).not.toBeNull();
      // At least Permissions, Conditions, Limitations, Compatibility, Gotchas = 5
      expect(h2Matches!.length).toBeGreaterThanOrEqual(5);
    });

    it("contains a markdown table separator row", () => {
      expect(md).toContain("|----------|");
    });
  });
});
