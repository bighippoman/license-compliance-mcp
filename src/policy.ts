import { createRequire } from "node:module";
import type { LicenseInfo, ComplianceIssue, PolicyPreset } from "./types.js";
import { getPresetAllowedLicenses } from "./compatibility.js";

const require = createRequire(import.meta.url);
const spdxParse = require("spdx-expression-parse");
const spdxCorrect = require("spdx-correct");
const spdxSatisfies = require("spdx-satisfies");

/**
 * Normalize a raw license string to a valid SPDX expression.
 * Returns the normalized form and whether it was changed.
 */
export function normalizeLicense(raw: string): {
  normalized: string;
  wasChanged: boolean;
} {
  if (!raw || raw === "UNKNOWN" || raw === "UNLICENSED") {
    return { normalized: raw || "UNKNOWN", wasChanged: false };
  }

  // Try parsing as-is
  try {
    spdxParse(raw);
    return { normalized: raw, wasChanged: false };
  } catch {
    // Not valid, try correction
  }

  // Try spdx-correct
  const corrected = spdxCorrect(raw);
  if (corrected) {
    return { normalized: corrected, wasChanged: true };
  }

  return { normalized: "UNKNOWN", wasChanged: true };
}

/**
 * Resolve a policy string to an array of allowed SPDX license identifiers.
 * Accepts preset names or custom SPDX expressions.
 */
export function resolvePolicy(policy: string): string[] {
  const presets: Record<string, PolicyPreset> = {
    permissive: "permissive",
    "weak-copyleft": "weak-copyleft",
    copyleft: "copyleft",
  };

  if (presets[policy]) {
    return getPresetAllowedLicenses(presets[policy]);
  }

  // Custom expression: extract individual identifiers
  try {
    const identifiers: string[] = [];
    function extract(node: { license?: string; left?: unknown; right?: unknown }) {
      if (node.license) identifiers.push(node.license);
      if (node.left) extract(node.left as typeof node);
      if (node.right) extract(node.right as typeof node);
    }
    extract(spdxParse(policy));
    return identifiers;
  } catch {
    // Fall back to treating as a single license
    return [policy];
  }
}

/**
 * Evaluate a single package against the allowed license list.
 * Returns any compliance issues found.
 */
export function evaluatePackage(
  pkg: LicenseInfo,
  allowedLicenses: string[],
  chain: string[],
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const { normalized, wasChanged } = normalizeLicense(pkg.licenses);

  // Report auto-correction as info
  if (wasChanged && normalized !== "UNKNOWN") {
    issues.push({
      severity: "info",
      packageName: pkg.packageName,
      version: pkg.version,
      license: pkg.licenses,
      reason: `License "${pkg.licenses}" was auto-corrected to "${normalized}"`,
      dependencyChain: chain,
      correctedLicense: normalized,
    });
  }

  // UNKNOWN or UNLICENSED
  if (normalized === "UNKNOWN" || normalized === "UNLICENSED") {
    issues.push({
      severity: "warning",
      packageName: pkg.packageName,
      version: pkg.version,
      license: normalized,
      reason:
        normalized === "UNLICENSED"
          ? "Package is explicitly UNLICENSED — manual review required"
          : "License could not be determined — manual review required",
      dependencyChain: chain,
    });
    return issues;
  }

  // Check against allowed licenses using spdx-satisfies
  try {
    const isAllowed = spdxSatisfies(normalized, allowedLicenses);
    if (!isAllowed) {
      issues.push({
        severity: "critical",
        packageName: pkg.packageName,
        version: pkg.version,
        license: normalized,
        reason: `License "${normalized}" is not allowed under the current policy`,
        dependencyChain: chain,
      });
    }
  } catch {
    // spdx-satisfies may throw on unusual expressions
    issues.push({
      severity: "warning",
      packageName: pkg.packageName,
      version: pkg.version,
      license: normalized,
      reason: `Could not evaluate license expression "${normalized}" — manual review required`,
      dependencyChain: chain,
    });
  }

  return issues;
}
