import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LicenseInfo, ScanResult } from "./types.js";

const require = createRequire(import.meta.url);
const licenseChecker = require("license-checker-rseidelsohn");

interface CheckerEntry {
  licenses?: string;
  repository?: string;
  path?: string;
}

/**
 * Parse license-checker's raw output into LicenseInfo[].
 * Keys are "package@version" or "@scope/package@version".
 */
export function parseCheckerOutput(
  raw: Record<string, CheckerEntry>,
): LicenseInfo[] {
  const results: LicenseInfo[] = [];

  for (const [key, entry] of Object.entries(raw)) {
    // Handle scoped packages: @scope/name@version
    const atIndex = key.lastIndexOf("@");
    if (atIndex <= 0) continue; // skip malformed entries

    const packageName = key.slice(0, atIndex);
    const version = key.slice(atIndex + 1);

    results.push({
      packageName,
      version,
      licenses: entry.licenses ?? "UNKNOWN",
      repository: entry.repository,
      path: entry.path,
    });
  }

  return results;
}

/**
 * Trace how a dependency got into the project (2 levels max).
 */
export function traceDependencyChain(
  packageName: string,
  rootName: string,
  projectPath: string,
): string[] {
  try {
    const rootPkgPath = join(projectPath, "package.json");
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
    const allDeps = {
      ...rootPkg.dependencies,
      ...rootPkg.devDependencies,
    };

    // Direct dependency
    if (allDeps[packageName]) {
      return [rootName, packageName];
    }

    // Check one level of transitive deps
    for (const depName of Object.keys(allDeps)) {
      try {
        const depPkgPath = join(
          projectPath,
          "node_modules",
          depName,
          "package.json",
        );
        const depPkg = JSON.parse(readFileSync(depPkgPath, "utf-8"));
        const depDeps = depPkg.dependencies ?? {};
        if (depDeps[packageName]) {
          return [rootName, depName, packageName];
        }
      } catch {
        // dep's package.json not readable, skip
      }
    }
  } catch {
    // root package.json not readable
  }

  return [rootName, "...", packageName];
}

/**
 * Scan a project's node_modules for license information.
 */
export function scanProject(projectPath: string): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    let projectName = "unknown";
    try {
      const rootPkg = JSON.parse(
        readFileSync(join(projectPath, "package.json"), "utf-8"),
      );
      projectName = rootPkg.name ?? "unknown";
    } catch {
      // proceed with "unknown"
    }

    licenseChecker.init(
      { start: projectPath, production: false },
      (err: Error | null, data: Record<string, CheckerEntry>) => {
        if (err) return reject(err);
        resolve({
          packages: parseCheckerOutput(data),
          projectPath,
          projectName,
        });
      },
    );
  });
}
