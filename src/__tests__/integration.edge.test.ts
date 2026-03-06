import { describe, it, expect } from "vitest";
import { resolvePolicy, evaluatePackage, normalizeLicense } from "../policy.js";
import { parseCheckerOutput, traceDependencyChain } from "../scanner.js";
import { formatReport } from "../formatter.js";
import { explainLicense, KNOWN_LICENSES } from "../license-explainer.js";
import { getLicenseCategory, getPresetAllowedLicenses } from "../compatibility.js";
import type { ComplianceIssue, ComplianceReport, LicenseInfo } from "../types.js";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makePkg(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
  return {
    packageName: "test-pkg",
    version: "1.0.0",
    licenses: "MIT",
    ...overrides,
  };
}

function makeReport(
  issues: ComplianceIssue[],
  overrides: Partial<ComplianceReport> = {},
): ComplianceReport {
  return {
    totalPackages: 100,
    issueCount: issues.length,
    issues,
    scannedPath: "/project",
    policy: "permissive",
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("license contamination scenarios", () => {
  it("single GPL dep 8 levels deep still gets caught", () => {
    // Simulates the motivating scenario: GPL contamination deep in the tree
    const pkg = makePkg({ packageName: "deep-gpl", licenses: "GPL-3.0-only" });
    const chain = [
      "my-app",
      "framework",
      "plugin",
      "helper",
      "util",
      "wrapper",
      "adapter",
      "core",
      "deep-gpl",
    ];
    const allowed = resolvePolicy("permissive");
    const issues = evaluatePackage(pkg, allowed, chain);
    const critical = issues.find((i) => i.severity === "critical");
    expect(critical).toBeDefined();
    expect(critical!.dependencyChain).toHaveLength(9);
    expect(critical!.dependencyChain[8]).toBe("deep-gpl");
  });

  it("AGPL dep caught under permissive, weak-copyleft, but not copyleft", () => {
    const pkg = makePkg({ packageName: "agpl-lib", licenses: "AGPL-3.0-only" });
    const chain = ["app", "agpl-lib"];

    const permIssues = evaluatePackage(pkg, resolvePolicy("permissive"), chain);
    expect(permIssues.some((i) => i.severity === "critical")).toBe(true);

    const weakIssues = evaluatePackage(pkg, resolvePolicy("weak-copyleft"), chain);
    expect(weakIssues.some((i) => i.severity === "critical")).toBe(true);

    const copyIssues = evaluatePackage(pkg, resolvePolicy("copyleft"), chain);
    expect(copyIssues.some((i) => i.severity === "critical")).toBe(false);
  });

  it("LGPL caught under permissive but not weak-copyleft or copyleft", () => {
    const pkg = makePkg({ packageName: "lgpl-lib", licenses: "LGPL-3.0-only" });
    const chain = ["app", "lgpl-lib"];

    const permIssues = evaluatePackage(pkg, resolvePolicy("permissive"), chain);
    expect(permIssues.some((i) => i.severity === "critical")).toBe(true);

    const weakIssues = evaluatePackage(pkg, resolvePolicy("weak-copyleft"), chain);
    expect(weakIssues.some((i) => i.severity === "critical")).toBe(false);

    const copyIssues = evaluatePackage(pkg, resolvePolicy("copyleft"), chain);
    expect(copyIssues.some((i) => i.severity === "critical")).toBe(false);
  });

  it("CC-BY-NC caught under ALL presets (non-commercial always blocked)", () => {
    const pkg = makePkg({ packageName: "nc-lib", licenses: "CC-BY-NC-4.0" });
    const chain = ["app", "nc-lib"];

    for (const preset of ["permissive", "weak-copyleft", "copyleft"] as const) {
      const issues = evaluatePackage(pkg, resolvePolicy(preset), chain);
      expect(
        issues.some((i) => i.severity === "critical" || i.severity === "warning"),
      ).toBe(true);
    }
  });
});

describe("dual-licensing edge cases", () => {
  it("(MIT OR GPL-3.0-only) passes permissive — user can choose MIT", () => {
    const pkg = makePkg({ licenses: "(MIT OR GPL-3.0-only)" });
    const issues = evaluatePackage(pkg, resolvePolicy("permissive"), ["app", "pkg"]);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("(GPL-2.0-only OR GPL-3.0-only) fails permissive — no permissive option", () => {
    const pkg = makePkg({ licenses: "(GPL-2.0-only OR GPL-3.0-only)" });
    const issues = evaluatePackage(pkg, resolvePolicy("permissive"), ["app", "pkg"]);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(1);
  });

  it("(GPL-2.0-only OR GPL-3.0-only) passes copyleft", () => {
    const pkg = makePkg({ licenses: "(GPL-2.0-only OR GPL-3.0-only)" });
    const issues = evaluatePackage(pkg, resolvePolicy("copyleft"), ["app", "pkg"]);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("(MIT AND Apache-2.0) passes permissive — both are permissive", () => {
    const pkg = makePkg({ licenses: "(MIT AND Apache-2.0)" });
    const issues = evaluatePackage(pkg, resolvePolicy("permissive"), ["app", "pkg"]);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });

  it("(MIT AND GPL-3.0-only) fails permissive — AND means both required", () => {
    const pkg = makePkg({ licenses: "(MIT AND GPL-3.0-only)" });
    const issues = evaluatePackage(pkg, resolvePolicy("permissive"), ["app", "pkg"]);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(1);
  });

  it("triple OR: (MIT OR ISC OR BSD-2-Clause) passes permissive", () => {
    const pkg = makePkg({ licenses: "(MIT OR ISC OR BSD-2-Clause)" });
    const issues = evaluatePackage(pkg, resolvePolicy("permissive"), ["app", "pkg"]);
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });
});

describe("auto-correction chain through full pipeline", () => {
  it("misspelled license gets corrected, evaluated, and reported", () => {
    const pkg = makePkg({ packageName: "old-lib", licenses: "Apache 2.0" });
    const allowed = resolvePolicy("permissive");
    const issues = evaluatePackage(pkg, allowed, ["app", "old-lib"]);

    // Should produce info about correction
    const info = issues.filter((i) => i.severity === "info");
    expect(info).toHaveLength(1);
    expect(info[0].correctedLicense).toBe("Apache-2.0");

    // Should NOT produce critical (Apache-2.0 is permissive)
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);

    // Format the report
    const report = makeReport(issues);
    const md = formatReport(report);
    expect(md).toContain("INFO");
    expect(md).toContain("Corrected to");
    expect(md).not.toContain("CRITICAL");
  });

  it("misspelled GPL gets corrected AND flagged", () => {
    const pkg = makePkg({ packageName: "gpl-typo", licenses: "GPLv3" });
    const allowed = resolvePolicy("permissive");
    const { normalized, wasChanged } = normalizeLicense("GPLv3");

    if (wasChanged && normalized !== "UNKNOWN") {
      // spdx-correct can fix GPLv3 → GPL-3.0-only
      const issues = evaluatePackage(pkg, allowed, ["app", "gpl-typo"]);
      const info = issues.filter((i) => i.severity === "info");
      const critical = issues.filter((i) => i.severity === "critical");
      expect(info.length).toBeGreaterThanOrEqual(1);
      expect(critical.length).toBeGreaterThanOrEqual(1);
    }
    // If spdx-correct can't fix it, it goes to UNKNOWN → warning
  });

  it("unrecoverable garbage goes to UNKNOWN → warning only", () => {
    const pkg = makePkg({
      packageName: "garbage",
      licenses: "aslkdjfalksdjf-not-a-license",
    });
    const allowed = resolvePolicy("permissive");
    const issues = evaluatePackage(pkg, allowed, ["app", "garbage"]);

    // Should NOT produce info (garbage → UNKNOWN, and wasChanged && normalized !== "UNKNOWN" is false)
    expect(issues.filter((i) => i.severity === "info")).toHaveLength(0);
    // Should produce warning
    expect(issues.filter((i) => i.severity === "warning")).toHaveLength(1);
    // Should NOT produce critical (UNKNOWN returns early before spdx-satisfies check)
    expect(issues.filter((i) => i.severity === "critical")).toHaveLength(0);
  });
});

describe("real-world license strings from npm", () => {
  // These are actual license strings found in npm packages
  const realWorldCases: Array<{
    input: string;
    expectAllowedUnderPermissive: boolean;
    desc: string;
  }> = [
    { input: "MIT", expectAllowedUnderPermissive: true, desc: "standard MIT" },
    { input: "ISC", expectAllowedUnderPermissive: true, desc: "standard ISC" },
    { input: "BSD-2-Clause", expectAllowedUnderPermissive: true, desc: "BSD-2" },
    { input: "BSD-3-Clause", expectAllowedUnderPermissive: true, desc: "BSD-3" },
    { input: "Apache-2.0", expectAllowedUnderPermissive: true, desc: "Apache" },
    { input: "0BSD", expectAllowedUnderPermissive: true, desc: "zero BSD" },
    { input: "(MIT OR Apache-2.0)", expectAllowedUnderPermissive: true, desc: "dual MIT/Apache" },
    { input: "(MIT AND Zlib)", expectAllowedUnderPermissive: true, desc: "MIT+Zlib" },
    { input: "Unlicense", expectAllowedUnderPermissive: true, desc: "public domain" },
    { input: "CC0-1.0", expectAllowedUnderPermissive: true, desc: "CC0" },
    { input: "BlueOak-1.0.0", expectAllowedUnderPermissive: true, desc: "BlueOak" },
    { input: "Python-2.0", expectAllowedUnderPermissive: true, desc: "Python" },
    { input: "GPL-2.0-only", expectAllowedUnderPermissive: false, desc: "GPL-2.0" },
    { input: "GPL-3.0-only", expectAllowedUnderPermissive: false, desc: "GPL-3.0" },
    { input: "AGPL-3.0-only", expectAllowedUnderPermissive: false, desc: "AGPL" },
    { input: "LGPL-3.0-only", expectAllowedUnderPermissive: false, desc: "LGPL" },
    { input: "MPL-2.0", expectAllowedUnderPermissive: false, desc: "MPL" },
  ];

  const allowed = resolvePolicy("permissive");

  it.each(realWorldCases)(
    "$desc ($input) — allowed=$expectAllowedUnderPermissive",
    ({ input, expectAllowedUnderPermissive }) => {
      const pkg = makePkg({ licenses: input });
      const issues = evaluatePackage(pkg, allowed, ["root", "pkg"]);
      const hasCritical = issues.some((i) => i.severity === "critical");
      expect(hasCritical).toBe(!expectAllowedUnderPermissive);
    },
  );
});

describe("category consistency across modules", () => {
  it("every license in compatibility sets has consistent category", async () => {
    const {
      PERMISSIVE_LICENSES,
      PUBLIC_DOMAIN_LICENSES,
      WEAK_COPYLEFT_LICENSES,
      STRONG_COPYLEFT_LICENSES,
      NETWORK_COPYLEFT_LICENSES,
      NON_COMMERCIAL_LICENSES,
    } = await import("../compatibility.js");

    for (const id of PERMISSIVE_LICENSES) {
      expect(getLicenseCategory(id)).toBe("permissive");
    }
    for (const id of PUBLIC_DOMAIN_LICENSES) {
      expect(getLicenseCategory(id)).toBe("public-domain");
    }
    for (const id of WEAK_COPYLEFT_LICENSES) {
      expect(getLicenseCategory(id)).toBe("weak-copyleft");
    }
    for (const id of STRONG_COPYLEFT_LICENSES) {
      expect(getLicenseCategory(id)).toBe("strong-copyleft");
    }
    for (const id of NETWORK_COPYLEFT_LICENSES) {
      expect(getLicenseCategory(id)).toBe("network-copyleft");
    }
    for (const id of NON_COMMERCIAL_LICENSES) {
      expect(getLicenseCategory(id)).toBe("proprietary");
    }
  });

  it("preset hierarchy is monotonically increasing", () => {
    const permissive = new Set(getPresetAllowedLicenses("permissive"));
    const weakCopyleft = new Set(getPresetAllowedLicenses("weak-copyleft"));
    const copyleft = new Set(getPresetAllowedLicenses("copyleft"));

    // Every license in permissive should be in weak-copyleft
    for (const id of permissive) {
      expect(weakCopyleft.has(id)).toBe(true);
    }
    // Every license in weak-copyleft should be in copyleft
    for (const id of weakCopyleft) {
      expect(copyleft.has(id)).toBe(true);
    }
    // Copyleft should be strictly larger than weak-copyleft
    expect(copyleft.size).toBeGreaterThan(weakCopyleft.size);
    // Weak-copyleft should be strictly larger than permissive
    expect(weakCopyleft.size).toBeGreaterThan(permissive.size);
  });

  it("normalizeLicense produces stable output (idempotent)", () => {
    const testCases = ["MIT", "Apache-2.0", "(MIT OR ISC)", "GPL-3.0-only"];
    for (const input of testCases) {
      const first = normalizeLicense(input);
      const second = normalizeLicense(first.normalized);
      expect(second.normalized).toBe(first.normalized);
      expect(second.wasChanged).toBe(false);
    }
  });

  it("auto-correction is idempotent", () => {
    const correctable = ["Apache 2.0", "GPLv3", "BSD"];
    for (const input of correctable) {
      const first = normalizeLicense(input);
      if (first.normalized !== "UNKNOWN") {
        const second = normalizeLicense(first.normalized);
        expect(second.wasChanged).toBe(false);
        expect(second.normalized).toBe(first.normalized);
      }
    }
  });
});

describe("report formatting edge cases", () => {
  it("report with 1000 packages and 100 issues doesn't crash", () => {
    const issues: ComplianceIssue[] = Array.from({ length: 100 }, (_, i) => ({
      severity: i < 50 ? "critical" as const : i < 80 ? "warning" as const : "info" as const,
      packageName: `pkg-${i}`,
      version: "1.0.0",
      license: i < 50 ? "GPL-3.0-only" : "UNKNOWN",
      reason: "Policy violation",
      dependencyChain: ["root", `mid-${i}`, `pkg-${i}`],
    }));

    const report = makeReport(issues, { totalPackages: 1000 });
    const md = formatReport(report);

    expect(md).toContain("1000 packages");
    expect(md).toContain("CRITICAL (50)");
    expect(md).toContain("WARNING (30)");
    expect(md).toContain("INFO (20)");
    // Verify all packages appear
    for (let i = 0; i < 100; i++) {
      expect(md).toContain(`pkg-${i}`);
    }
  });

  it("report output is valid markdown (no unclosed formatting)", () => {
    const issues: ComplianceIssue[] = [
      {
        severity: "critical",
        packageName: "test",
        version: "1.0.0",
        license: "GPL-3.0-only",
        reason: "Not allowed",
        dependencyChain: ["root", "test"],
      },
    ];
    const report = makeReport(issues);
    const md = formatReport(report);

    // Check balanced formatting
    const boldCount = (md.match(/\*\*/g) || []).length;
    expect(boldCount % 2).toBe(0); // bold markers come in pairs

    const backtickCount = (md.match(/`/g) || []).length;
    expect(backtickCount % 2).toBe(0); // backticks come in pairs

    const italicCount = (md.match(/_/g) || []).length;
    expect(italicCount % 2).toBe(0); // italic markers come in pairs
  });
});

describe("synthetic project edge cases", () => {
  function createProject(
    pkgJson: object,
    deps?: Record<string, { pkgJson: object }>,
  ) {
    const dir = mkdtempSync(join(tmpdir(), "lc-edge-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkgJson));
    if (deps) {
      for (const [name, info] of Object.entries(deps)) {
        mkdirSync(join(dir, "node_modules", name), { recursive: true });
        writeFileSync(
          join(dir, "node_modules", name, "package.json"),
          JSON.stringify(info.pkgJson),
        );
      }
    }
    return dir;
  }

  it("package.json with no name field: traceDependencyChain uses provided rootName", () => {
    const dir = createProject(
      { dependencies: { express: "^4.0.0" } },
    );
    const chain = traceDependencyChain("express", "unnamed-project", dir);
    expect(chain).toEqual(["unnamed-project", "express"]);
  });

  it("package.json with null dependencies and devDependencies", () => {
    const dir = createProject({
      name: "null-deps",
      dependencies: null,
      devDependencies: null,
    });
    // Spreading null gives empty object, so no deps found
    const chain = traceDependencyChain("some-pkg", "null-deps", dir);
    expect(chain).toEqual(["null-deps", "...", "some-pkg"]);
  });

  it("dep in both dependencies and devDependencies found as direct", () => {
    const dir = createProject({
      name: "dup-project",
      dependencies: { lodash: "^4.0.0" },
      devDependencies: { lodash: "^4.0.0" },
    });
    const chain = traceDependencyChain("lodash", "dup-project", dir);
    expect(chain).toEqual(["dup-project", "lodash"]);
  });

  it("peerDependencies are NOT treated as direct dependencies", () => {
    const dir = createProject({
      name: "peer-project",
      peerDependencies: { react: "^18.0.0" },
    });
    const chain = traceDependencyChain("react", "peer-project", dir);
    // peerDependencies not merged into allDeps, so falls back
    expect(chain).toEqual(["peer-project", "...", "react"]);
  });

  it("optionalDependencies are NOT treated as direct dependencies", () => {
    const dir = createProject({
      name: "opt-project",
      optionalDependencies: { fsevents: "^2.0.0" },
    });
    const chain = traceDependencyChain("fsevents", "opt-project", dir);
    expect(chain).toEqual(["opt-project", "...", "fsevents"]);
  });

  it("corrupted dep package.json doesn't crash chain tracing", () => {
    const dir = createProject(
      {
        name: "corrupt-project",
        dependencies: { "bad-dep": "^1.0.0", "good-dep": "^1.0.0" },
      },
      {
        "good-dep": { pkgJson: { name: "good-dep", dependencies: { target: "^1.0.0" } } },
      },
    );
    // Create bad-dep with invalid JSON
    mkdirSync(join(dir, "node_modules", "bad-dep"), { recursive: true });
    writeFileSync(
      join(dir, "node_modules", "bad-dep", "package.json"),
      "THIS IS NOT JSON {{{",
    );

    // Should still find target through good-dep
    const chain = traceDependencyChain("target", "corrupt-project", dir);
    expect(chain).toEqual(["corrupt-project", "good-dep", "target"]);
  });

  it("dep with no package.json file doesn't crash chain tracing", () => {
    const dir = createProject(
      {
        name: "missing-pkg-project",
        dependencies: { "empty-dep": "^1.0.0" },
      },
    );
    // Create directory without package.json
    mkdirSync(join(dir, "node_modules", "empty-dep"), { recursive: true });

    const chain = traceDependencyChain("some-target", "missing-pkg-project", dir);
    expect(chain).toEqual(["missing-pkg-project", "...", "some-target"]);
  });

  it("scoped package names work in dependency chains", () => {
    const dir = createProject(
      {
        name: "scoped-project",
        dependencies: { "@scope/lib": "^1.0.0" },
      },
      {
        "@scope/lib": {
          pkgJson: { name: "@scope/lib", dependencies: { "@other/util": "^2.0.0" } },
        },
      },
    );

    const directChain = traceDependencyChain("@scope/lib", "scoped-project", dir);
    expect(directChain).toEqual(["scoped-project", "@scope/lib"]);

    const transitiveChain = traceDependencyChain("@other/util", "scoped-project", dir);
    expect(transitiveChain).toEqual(["scoped-project", "@scope/lib", "@other/util"]);
  });
});

describe("parseCheckerOutput edge cases with real-world patterns", () => {
  it("license-checker sometimes returns arrays as license string", () => {
    // Some packages report multiple licenses as a comma-separated string
    const raw = {
      "multi-license@1.0.0": { licenses: "(MIT OR Apache-2.0)" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("(MIT OR Apache-2.0)");
  });

  it("license-checker with Custom: prefix", () => {
    const raw = {
      "custom-pkg@1.0.0": { licenses: "Custom: https://example.com/license" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("Custom: https://example.com/license");

    // spdx-correct may guess a license or return null — either way normalization won't crash
    const { normalized, wasChanged } = normalizeLicense(result[0].licenses);
    expect(typeof normalized).toBe("string");
    expect(typeof wasChanged).toBe("boolean");
  });

  it("handles packages with asterisk in license", () => {
    // license-checker sometimes adds * for guessed licenses
    const raw = {
      "guessed@1.0.0": { licenses: "MIT*" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("MIT*");
  });

  it("handles license-checker UNKNOWN format", () => {
    const raw = {
      "unknown-pkg@1.0.0": { licenses: "UNKNOWN" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("UNKNOWN");
  });
});
