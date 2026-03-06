import { describe, it, expect } from "vitest";
import type {
  LicenseInfo,
  ComplianceIssue,
  ComplianceReport,
  PolicyPreset,
  LicenseCategory,
  LicenseExplanation,
  ScanResult,
} from "../types.js";

describe("types", () => {
  it("LicenseInfo holds package license data", () => {
    const info: LicenseInfo = {
      packageName: "express",
      version: "4.18.2",
      licenses: "MIT",
      repository: "https://github.com/expressjs/express",
      path: "/project/node_modules/express",
    };
    expect(info.packageName).toBe("express");
    expect(info.licenses).toBe("MIT");
  });

  it("ComplianceIssue captures a violation", () => {
    const issue: ComplianceIssue = {
      severity: "critical",
      packageName: "gpl-lib",
      version: "1.0.0",
      license: "GPL-3.0-only",
      reason: "GPL-3.0-only is not allowed under permissive policy",
      dependencyChain: ["my-app", "some-dep", "gpl-lib"],
    };
    expect(issue.severity).toBe("critical");
    expect(issue.dependencyChain).toHaveLength(3);
  });

  it("ComplianceIssue supports optional correctedLicense", () => {
    const issue: ComplianceIssue = {
      severity: "info",
      packageName: "old-lib",
      version: "2.0.0",
      license: "Apache 2.0",
      reason: "License was auto-corrected",
      dependencyChain: ["my-app", "old-lib"],
      correctedLicense: "Apache-2.0",
    };
    expect(issue.correctedLicense).toBe("Apache-2.0");
  });

  it("ComplianceReport aggregates scan results", () => {
    const report: ComplianceReport = {
      totalPackages: 150,
      issueCount: 2,
      issues: [],
      scannedPath: "/project",
      policy: "permissive",
      timestamp: new Date().toISOString(),
    };
    expect(report.totalPackages).toBe(150);
    expect(report.policy).toBe("permissive");
  });

  it("PolicyPreset accepts valid values", () => {
    const presets: PolicyPreset[] = ["permissive", "weak-copyleft", "copyleft"];
    expect(presets).toHaveLength(3);
  });

  it("LicenseCategory covers all classifications", () => {
    const categories: LicenseCategory[] = [
      "permissive",
      "weak-copyleft",
      "strong-copyleft",
      "network-copyleft",
      "public-domain",
      "proprietary",
      "unknown",
    ];
    expect(categories).toHaveLength(7);
  });

  it("LicenseExplanation holds full license details", () => {
    const explanation: LicenseExplanation = {
      identifier: "MIT",
      name: "MIT License",
      category: "permissive",
      summary: "A short, permissive license.",
      permissions: ["commercial-use", "modification", "distribution", "private-use"],
      conditions: ["include-copyright"],
      limitations: ["no-liability"],
      compatibility: {
        proprietary: true,
        openSource: true,
        saas: true,
      },
      gotchas: ["Must include original license text"],
    };
    expect(explanation.identifier).toBe("MIT");
    expect(explanation.compatibility.proprietary).toBe(true);
    expect(explanation.permissions).toContain("commercial-use");
  });

  it("ScanResult holds scanner output", () => {
    const result: ScanResult = {
      packages: [
        { packageName: "lodash", version: "4.17.21", licenses: "MIT" },
      ],
      projectPath: "/project",
      projectName: "my-app",
    };
    expect(result.packages).toHaveLength(1);
    expect(result.projectName).toBe("my-app");
  });
});
