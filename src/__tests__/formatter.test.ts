import { describe, it, expect } from "vitest";
import { formatReport, formatLicenseExplanation } from "../formatter.js";
import type { ComplianceReport, LicenseExplanation } from "../types.js";

describe("formatReport", () => {
  const baseReport: ComplianceReport = {
    totalPackages: 100,
    issueCount: 0,
    issues: [],
    scannedPath: "/project",
    policy: "permissive",
    timestamp: "2026-03-06T00:00:00.000Z",
  };

  it("formats clean report with no issues", () => {
    const md = formatReport(baseReport);
    expect(md).toContain("# License Compliance Report");
    expect(md).toContain("100 packages");
    expect(md).toContain("Issues:** 0");
    expect(md).toContain("All dependencies comply");
  });

  it("formats report with critical issues", () => {
    const report: ComplianceReport = {
      ...baseReport,
      issueCount: 1,
      issues: [
        {
          severity: "critical",
          packageName: "gpl-lib",
          version: "1.0.0",
          license: "GPL-3.0-only",
          reason: "Not allowed under permissive policy",
          dependencyChain: ["my-app", "dep-a", "gpl-lib"],
        },
      ],
    };
    const md = formatReport(report);
    expect(md).toContain("CRITICAL");
    expect(md).toContain("gpl-lib@1.0.0");
    expect(md).toContain("GPL-3.0-only");
    expect(md).toContain("my-app → dep-a → gpl-lib");
  });

  it("formats report with warning issues", () => {
    const report: ComplianceReport = {
      ...baseReport,
      issueCount: 1,
      issues: [
        {
          severity: "warning",
          packageName: "mystery",
          version: "2.0.0",
          license: "UNKNOWN",
          reason: "License could not be determined",
          dependencyChain: ["my-app", "mystery"],
        },
      ],
    };
    const md = formatReport(report);
    expect(md).toContain("WARNING");
    expect(md).toContain("UNKNOWN");
  });

  it("formats report with info (auto-corrected) issues", () => {
    const report: ComplianceReport = {
      ...baseReport,
      issueCount: 1,
      issues: [
        {
          severity: "info",
          packageName: "old-pkg",
          version: "1.0.0",
          license: "Apache 2.0",
          reason: 'License was auto-corrected',
          dependencyChain: ["my-app", "old-pkg"],
          correctedLicense: "Apache-2.0",
        },
      ],
    };
    const md = formatReport(report);
    expect(md).toContain("INFO");
    expect(md).toContain("Apache-2.0");
    expect(md).toContain("Corrected to");
  });

  it("orders issues by severity: critical > warning > info", () => {
    const report: ComplianceReport = {
      ...baseReport,
      issueCount: 3,
      issues: [
        {
          severity: "info",
          packageName: "info-pkg",
          version: "1.0.0",
          license: "MIT",
          reason: "Info",
          dependencyChain: ["root"],
        },
        {
          severity: "critical",
          packageName: "critical-pkg",
          version: "1.0.0",
          license: "GPL-3.0-only",
          reason: "Critical",
          dependencyChain: ["root"],
        },
        {
          severity: "warning",
          packageName: "warn-pkg",
          version: "1.0.0",
          license: "UNKNOWN",
          reason: "Warning",
          dependencyChain: ["root"],
        },
      ],
    };
    const md = formatReport(report);
    const criticalPos = md.indexOf("CRITICAL");
    const warningPos = md.indexOf("WARNING");
    const infoPos = md.indexOf("INFO");
    expect(criticalPos).toBeLessThan(warningPos);
    expect(warningPos).toBeLessThan(infoPos);
  });
});

describe("formatLicenseExplanation", () => {
  const mitExplanation: LicenseExplanation = {
    identifier: "MIT",
    name: "MIT License",
    category: "permissive",
    summary: "A short, permissive license with conditions only requiring preservation of copyright.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Include copyright and license notice"],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: ["Must include original license text in distributions"],
  };

  it("formats license name and identifier", () => {
    const md = formatLicenseExplanation(mitExplanation);
    expect(md).toContain("# MIT License");
    expect(md).toContain("`MIT`");
    expect(md).toContain("permissive");
  });

  it("includes permissions, conditions, and limitations", () => {
    const md = formatLicenseExplanation(mitExplanation);
    expect(md).toContain("Commercial use");
    expect(md).toContain("Include copyright");
    expect(md).toContain("No liability");
  });

  it("includes compatibility table", () => {
    const md = formatLicenseExplanation(mitExplanation);
    expect(md).toContain("Proprietary/Commercial");
    expect(md).toContain("✅ Yes");
  });

  it("includes gotchas", () => {
    const md = formatLicenseExplanation(mitExplanation);
    expect(md).toContain("Gotchas");
    expect(md).toContain("original license text");
  });
});
