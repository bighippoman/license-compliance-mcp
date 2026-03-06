import { describe, it, expect } from "vitest";
import { resolvePolicy, evaluatePackage } from "../policy.js";
import { scanProject, parseCheckerOutput, traceDependencyChain } from "../scanner.js";
import { formatReport, formatLicenseExplanation } from "../formatter.js";
import { explainLicense, KNOWN_LICENSES } from "../license-explainer.js";
import { getLicenseCategory, getPresetAllowedLicenses } from "../compatibility.js";
import type { ComplianceIssue, ComplianceReport, LicenseInfo } from "../types.js";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("end-to-end: check-licenses workflow", () => {
  const projectPath = "/Users/josephnordqvist/Code/license-compliance-mcp";

  it("scans real project with permissive policy and produces clean report", async () => {
    const allowedLicenses = resolvePolicy("permissive");
    const scanResult = await scanProject(projectPath);

    expect(scanResult.packages.length).toBeGreaterThan(50);
    expect(scanResult.projectName).toBe("license-compliance-mcp");
    expect(scanResult.projectPath).toBe(projectPath);

    const allIssues: ComplianceIssue[] = [];
    for (const pkg of scanResult.packages) {
      const chain = traceDependencyChain(
        pkg.packageName,
        scanResult.projectName,
        projectPath,
      );
      const issues = evaluatePackage(pkg, allowedLicenses, chain);
      allIssues.push(...issues);
    }

    const report: ComplianceReport = {
      totalPackages: scanResult.packages.length,
      issueCount: allIssues.length,
      issues: allIssues,
      scannedPath: projectPath,
      policy: "permissive",
      timestamp: new Date().toISOString(),
    };

    const markdown = formatReport(report);
    expect(markdown).toContain("# License Compliance Report");
    expect(markdown).toContain("permissive");
    // Should be clean — all deps are MIT/ISC/BSD/Apache
    expect(report.issueCount).toBe(0);
    expect(markdown).toContain("All dependencies comply");
  }, 30000);

  it("scans real project with MIT-only policy and catches violations", async () => {
    const allowedLicenses = ["MIT"];
    const scanResult = await scanProject(projectPath);
    const allIssues: ComplianceIssue[] = [];

    for (const pkg of scanResult.packages) {
      const chain = traceDependencyChain(
        pkg.packageName,
        scanResult.projectName,
        projectPath,
      );
      const issues = evaluatePackage(pkg, allowedLicenses, chain);
      allIssues.push(...issues);
    }

    // There should be ISC, BSD, Apache violations
    const criticals = allIssues.filter((i) => i.severity === "critical");
    expect(criticals.length).toBeGreaterThan(0);

    // Check that ISC packages are flagged
    const iscViolation = criticals.find((i) => i.license === "ISC");
    expect(iscViolation).toBeDefined();

    const report: ComplianceReport = {
      totalPackages: scanResult.packages.length,
      issueCount: allIssues.length,
      issues: allIssues,
      scannedPath: projectPath,
      policy: "MIT",
      timestamp: new Date().toISOString(),
    };

    const markdown = formatReport(report);
    expect(markdown).toContain("CRITICAL");
    expect(markdown).not.toContain("All dependencies comply");
  }, 30000);

  it("scans project with copyleft policy and is clean", async () => {
    const allowedLicenses = resolvePolicy("copyleft");
    const scanResult = await scanProject(projectPath);
    const allIssues: ComplianceIssue[] = [];

    for (const pkg of scanResult.packages) {
      const chain = traceDependencyChain(
        pkg.packageName,
        scanResult.projectName,
        projectPath,
      );
      const issues = evaluatePackage(pkg, allowedLicenses, chain);
      allIssues.push(...issues);
    }

    // Copyleft allows everything except non-commercial
    const criticals = allIssues.filter((i) => i.severity === "critical");
    expect(criticals).toHaveLength(0);
  }, 30000);
});

describe("end-to-end: explain-license workflow", () => {
  it("explains MIT and produces valid markdown", () => {
    const explanation = explainLicense("MIT")!;
    expect(explanation).not.toBeNull();

    const markdown = formatLicenseExplanation(explanation);
    expect(markdown).toContain("# MIT License");
    expect(markdown).toContain("permissive");
    expect(markdown).toContain("Permissions");
    expect(markdown).toContain("Conditions");
    expect(markdown).toContain("Limitations");
    expect(markdown).toContain("Compatibility");
    expect(markdown).toContain("Gotchas");
    expect(markdown).toContain("✅ Yes");
  });

  it("explains GPL-3.0-only with correct SaaS compatibility", () => {
    const explanation = explainLicense("GPL-3.0-only")!;
    const markdown = formatLicenseExplanation(explanation);

    expect(markdown).toContain("strong-copyleft");
    // Proprietary should be No
    expect(markdown).toContain("Proprietary/Commercial | ❌ No");
    // SaaS should be Yes (GPL does NOT trigger on SaaS)
    expect(markdown).toContain("SaaS/Network Use | ✅ Yes");
  });

  it("explains AGPL-3.0-only with correct SaaS restriction", () => {
    const explanation = explainLicense("AGPL-3.0-only")!;
    const markdown = formatLicenseExplanation(explanation);

    expect(markdown).toContain("network-copyleft");
    expect(markdown).toContain("SaaS/Network Use | ❌ No");
  });

  it("handles deprecated identifier via explainer then formatter", () => {
    const explanation = explainLicense("GPL-3.0");
    expect(explanation).not.toBeNull();
    const markdown = formatLicenseExplanation(explanation!);
    expect(markdown).toContain("GPL-3.0-only");
  });

  it("returns null for unknown and does not crash formatter", () => {
    const explanation = explainLicense("FANTASY-LICENSE-1.0");
    expect(explanation).toBeNull();
  });
});

describe("end-to-end: synthetic project simulation", () => {
  function createSyntheticProject(
    deps: Record<string, { licenses: string; subdeps?: Record<string, string> }>,
  ) {
    const dir = mkdtempSync(join(tmpdir(), "lc-synthetic-"));
    const pkgDeps: Record<string, string> = {};
    for (const name of Object.keys(deps)) {
      pkgDeps[name] = "1.0.0";
    }
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "synthetic-project", dependencies: pkgDeps }),
    );

    // Simulate parseCheckerOutput input
    const checkerData: Record<string, { licenses: string }> = {};
    for (const [name, info] of Object.entries(deps)) {
      checkerData[`${name}@1.0.0`] = { licenses: info.licenses };
      // Create node_modules for chain tracing
      mkdirSync(join(dir, "node_modules", name), { recursive: true });
      const subdeps = info.subdeps ?? {};
      writeFileSync(
        join(dir, "node_modules", name, "package.json"),
        JSON.stringify({ name, dependencies: subdeps }),
      );
      // Add subdep entries to checker
      for (const [subName, subLicense] of Object.entries(subdeps)) {
        checkerData[`${subName}@1.0.0`] = { licenses: subLicense };
      }
    }
    return { dir, checkerData };
  }

  it("all-permissive project passes permissive policy", () => {
    const { dir, checkerData } = createSyntheticProject({
      express: { licenses: "MIT" },
      lodash: { licenses: "MIT" },
      "is-number": { licenses: "MIT" },
    });

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("permissive");
    const issues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      issues.push(...evaluatePackage(pkg, allowed, chain));
    }

    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("GPL dependency in permissive project triggers critical", () => {
    const { dir, checkerData } = createSyntheticProject({
      express: { licenses: "MIT" },
      "gpl-lib": { licenses: "GPL-3.0-only" },
    });

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("permissive");
    const issues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      issues.push(...evaluatePackage(pkg, allowed, chain));
    }

    const criticals = issues.filter((i) => i.severity === "critical");
    expect(criticals).toHaveLength(1);
    expect(criticals[0].packageName).toBe("gpl-lib");
    expect(criticals[0].license).toBe("GPL-3.0-only");
    expect(criticals[0].dependencyChain).toEqual(["synthetic-project", "gpl-lib"]);
  });

  it("transitive GPL dependency shows full chain", () => {
    const { dir, checkerData } = createSyntheticProject({
      "safe-lib": {
        licenses: "MIT",
        subdeps: { "evil-gpl": "1.0.0" },
      },
    });
    // Add the transitive dep with GPL
    checkerData["evil-gpl@1.0.0"] = { licenses: "GPL-3.0-only" };

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("permissive");
    const issues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      issues.push(...evaluatePackage(pkg, allowed, chain));
    }

    const gplIssue = issues.find(
      (i) => i.packageName === "evil-gpl" && i.severity === "critical",
    );
    expect(gplIssue).toBeDefined();
    expect(gplIssue!.dependencyChain).toEqual([
      "synthetic-project",
      "safe-lib",
      "evil-gpl",
    ]);
  });

  it("AGPL in copyleft policy is allowed", () => {
    const { dir, checkerData } = createSyntheticProject({
      "agpl-lib": { licenses: "AGPL-3.0-only" },
    });

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("copyleft");
    const issues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      issues.push(...evaluatePackage(pkg, allowed, chain));
    }

    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("UNKNOWN license produces warning, not critical", () => {
    const { dir, checkerData } = createSyntheticProject({
      "mystery-pkg": { licenses: "UNKNOWN" },
    });

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("permissive");
    const issues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      issues.push(...evaluatePackage(pkg, allowed, chain));
    }

    expect(issues.filter((i) => i.severity === "warning")).toHaveLength(1);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("dual-licensed (MIT OR GPL-3.0-only) passes permissive policy", () => {
    const { dir, checkerData } = createSyntheticProject({
      "dual-lib": { licenses: "(MIT OR GPL-3.0-only)" },
    });

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("permissive");
    const issues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      issues.push(...evaluatePackage(pkg, allowed, chain));
    }

    // MIT is permissive, so the OR should pass
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("mixed project produces correct report with all severities", () => {
    const { dir, checkerData } = createSyntheticProject({
      "safe-dep": { licenses: "MIT" },
      "gpl-dep": { licenses: "GPL-3.0-only" },
      "unknown-dep": { licenses: "UNKNOWN" },
    });

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("permissive");
    const allIssues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      allIssues.push(...evaluatePackage(pkg, allowed, chain));
    }

    const report: ComplianceReport = {
      totalPackages: packages.length,
      issueCount: allIssues.length,
      issues: allIssues,
      scannedPath: dir,
      policy: "permissive",
      timestamp: new Date().toISOString(),
    };

    const markdown = formatReport(report);

    // Should have critical (GPL) and warning (UNKNOWN)
    expect(markdown).toContain("CRITICAL");
    expect(markdown).toContain("WARNING");
    expect(markdown).toContain("gpl-dep");
    expect(markdown).toContain("unknown-dep");
    expect(markdown).not.toContain("safe-dep"); // safe dep shouldn't appear in issues
  });

  it("report for fully compliant project is concise", () => {
    const { dir, checkerData } = createSyntheticProject({
      a: { licenses: "MIT" },
      b: { licenses: "ISC" },
      c: { licenses: "BSD-2-Clause" },
      d: { licenses: "Apache-2.0" },
    });

    const packages = parseCheckerOutput(checkerData);
    const allowed = resolvePolicy("permissive");
    const allIssues: ComplianceIssue[] = [];

    for (const pkg of packages) {
      const chain = traceDependencyChain(pkg.packageName, "synthetic-project", dir);
      allIssues.push(...evaluatePackage(pkg, allowed, chain));
    }

    const report: ComplianceReport = {
      totalPackages: packages.length,
      issueCount: allIssues.length,
      issues: allIssues,
      scannedPath: dir,
      policy: "permissive",
      timestamp: new Date().toISOString(),
    };

    const markdown = formatReport(report);
    expect(markdown).toContain("All dependencies comply");
    expect(markdown).not.toContain("CRITICAL");
    expect(markdown).not.toContain("WARNING");
  });
});

describe("cross-module consistency", () => {
  it("every license in KNOWN_LICENSES has a matching category in compatibility", () => {
    for (const [id, explanation] of Object.entries(KNOWN_LICENSES)) {
      const category = getLicenseCategory(id);
      // The category from explainer should match the compatibility module
      expect(category).toBe(explanation.category);
    }
  });

  it("permissive preset covers all permissive licenses in KNOWN_LICENSES", () => {
    const allowed = new Set(getPresetAllowedLicenses("permissive"));

    for (const [id, explanation] of Object.entries(KNOWN_LICENSES)) {
      if (explanation.category === "permissive" || explanation.category === "public-domain") {
        expect(allowed.has(id)).toBe(true);
      }
    }
  });

  it("copyleft preset covers all copyleft licenses in KNOWN_LICENSES", () => {
    const allowed = new Set(getPresetAllowedLicenses("copyleft"));

    for (const [id, explanation] of Object.entries(KNOWN_LICENSES)) {
      if (
        explanation.category === "permissive" ||
        explanation.category === "public-domain" ||
        explanation.category === "weak-copyleft" ||
        explanation.category === "strong-copyleft" ||
        explanation.category === "network-copyleft"
      ) {
        expect(allowed.has(id)).toBe(true);
      }
    }
  });

  it("every known license can be normalized without error", async () => {
    const { normalizeLicense } = await import("../policy.js");

    for (const id of Object.keys(KNOWN_LICENSES)) {
      const result = normalizeLicense(id);
      expect(result.normalized).not.toBe("UNKNOWN");
    }
  });
});

describe("edge cases and error handling", () => {
  it("evaluatePackage with empty allowed list flags everything", () => {
    const pkg: LicenseInfo = {
      packageName: "any-pkg",
      version: "1.0.0",
      licenses: "MIT",
    };
    const issues = evaluatePackage(pkg, [], ["root", "any-pkg"]);
    const criticals = issues.filter((i) => i.severity === "critical");
    expect(criticals.length).toBeGreaterThanOrEqual(1);
  });

  it("evaluatePackage with very large allowed list still works", () => {
    const allLicenses = getPresetAllowedLicenses("copyleft");
    const pkg: LicenseInfo = {
      packageName: "mit-pkg",
      version: "1.0.0",
      licenses: "MIT",
    };
    const issues = evaluatePackage(pkg, allLicenses, ["root", "mit-pkg"]);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("resolvePolicy with each preset returns non-empty array", () => {
    expect(resolvePolicy("permissive").length).toBeGreaterThan(0);
    expect(resolvePolicy("weak-copyleft").length).toBeGreaterThan(0);
    expect(resolvePolicy("copyleft").length).toBeGreaterThan(0);
  });

  it("formatReport handles report with 0 packages and 0 issues", () => {
    const report: ComplianceReport = {
      totalPackages: 0,
      issueCount: 0,
      issues: [],
      scannedPath: "/empty",
      policy: "permissive",
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    const md = formatReport(report);
    expect(md).toContain("0 packages");
    expect(md).toContain("All dependencies comply");
  });

  it("traceDependencyChain handles non-existent directory gracefully", () => {
    const chain = traceDependencyChain("pkg", "root", "/nonexistent/path");
    expect(chain).toEqual(["root", "...", "pkg"]);
  });

  it("parseCheckerOutput with empty object returns empty array", () => {
    expect(parseCheckerOutput({})).toEqual([]);
  });
});
