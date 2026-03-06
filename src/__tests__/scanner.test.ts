import { describe, it, expect } from "vitest";
import {
  parseCheckerOutput,
  traceDependencyChain,
  scanProject,
} from "../scanner.js";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// parseCheckerOutput
// ---------------------------------------------------------------------------
describe("parseCheckerOutput", () => {
  // --- standard packages ---------------------------------------------------
  it("parses a standard package with all fields", () => {
    const raw = {
      "express@4.18.2": {
        licenses: "MIT",
        repository: "https://github.com/expressjs/express",
        path: "/project/node_modules/express",
      },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      packageName: "express",
      version: "4.18.2",
      licenses: "MIT",
      repository: "https://github.com/expressjs/express",
      path: "/project/node_modules/express",
    });
  });

  it("parses multiple standard packages", () => {
    const raw = {
      "express@4.18.2": { licenses: "MIT" },
      "lodash@4.17.21": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(2);
    expect(result[0].packageName).toBe("express");
    expect(result[0].version).toBe("4.18.2");
    expect(result[1].packageName).toBe("lodash");
    expect(result[1].version).toBe("4.17.21");
  });

  // --- scoped packages -----------------------------------------------------
  it("parses scoped packages", () => {
    const raw = {
      "@modelcontextprotocol/sdk@1.27.1": { licenses: "MIT" },
      "@types/node@22.0.0": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(2);
    expect(result[0].packageName).toBe("@modelcontextprotocol/sdk");
    expect(result[0].version).toBe("1.27.1");
    expect(result[1].packageName).toBe("@types/node");
    expect(result[1].version).toBe("22.0.0");
  });

  it("parses deeply scoped packages", () => {
    const raw = {
      "@org/sub-pkg@2.0.0": { licenses: "Apache-2.0" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].packageName).toBe("@org/sub-pkg");
    expect(result[0].version).toBe("2.0.0");
    expect(result[0].licenses).toBe("Apache-2.0");
  });

  // --- UNKNOWN licenses ----------------------------------------------------
  it("defaults to UNKNOWN when licenses field is missing", () => {
    const raw = {
      "mystery-pkg@1.0.0": {},
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].licenses).toBe("UNKNOWN");
  });

  it("defaults to UNKNOWN when licenses is undefined", () => {
    const raw = {
      "another-pkg@3.5.0": { licenses: undefined } as any,
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("UNKNOWN");
  });

  // --- compound license expressions ----------------------------------------
  it("handles OR compound expression", () => {
    const raw = {
      "dual-licensed@2.0.0": { licenses: "(MIT OR Apache-2.0)" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("(MIT OR Apache-2.0)");
  });

  it("handles AND compound expression", () => {
    const raw = {
      "multi-lic@1.0.0": { licenses: "(MIT AND BSD-3-Clause)" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("(MIT AND BSD-3-Clause)");
  });

  it("handles nested compound expression", () => {
    const raw = {
      "complex-lic@0.1.0": {
        licenses: "(MIT OR (BSD-2-Clause AND Apache-2.0))",
      },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe(
      "(MIT OR (BSD-2-Clause AND Apache-2.0))",
    );
  });

  it("handles WTFPL OR MIT compound expression", () => {
    const raw = {
      "joke-pkg@1.0.0": { licenses: "(WTFPL OR MIT)" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("(WTFPL OR MIT)");
  });

  // --- UNLICENSED ----------------------------------------------------------
  it("preserves UNLICENSED license string", () => {
    const raw = {
      "proprietary-thing@0.0.1": { licenses: "UNLICENSED" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("UNLICENSED");
  });

  // --- malformed entries ---------------------------------------------------
  it("skips entry with no @ sign", () => {
    const raw = {
      "no-version": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(0);
  });

  it("skips entry with empty key", () => {
    const raw = {
      "": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(0);
  });

  it("skips entry with key that is only @", () => {
    const raw = {
      "@": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    // lastIndexOf("@") returns 0, which is <= 0, so it should be skipped
    expect(result).toHaveLength(0);
  });

  it("skips malformed entries but keeps valid ones", () => {
    const raw = {
      "no-version": { licenses: "MIT" },
      "express@4.18.2": { licenses: "MIT" },
      "@": { licenses: "BSD" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].packageName).toBe("express");
  });

  // --- empty input ---------------------------------------------------------
  it("returns empty array for empty input object", () => {
    const result = parseCheckerOutput({});
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // --- large input ---------------------------------------------------------
  it("handles large input with 10+ packages", () => {
    const raw: Record<string, { licenses: string }> = {};
    for (let i = 0; i < 15; i++) {
      raw[`package-${i}@${i}.0.0`] = { licenses: "MIT" };
    }
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(15);
    for (let i = 0; i < 15; i++) {
      expect(result[i].packageName).toBe(`package-${i}`);
      expect(result[i].version).toBe(`${i}.0.0`);
      expect(result[i].licenses).toBe("MIT");
    }
  });

  // --- optional fields -----------------------------------------------------
  it("includes all optional fields when present", () => {
    const raw = {
      "full-pkg@1.0.0": {
        licenses: "ISC",
        repository: "https://github.com/example/full-pkg",
        path: "/home/user/project/node_modules/full-pkg",
      },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0]).toEqual({
      packageName: "full-pkg",
      version: "1.0.0",
      licenses: "ISC",
      repository: "https://github.com/example/full-pkg",
      path: "/home/user/project/node_modules/full-pkg",
    });
  });

  it("leaves optional fields undefined when absent", () => {
    const raw = {
      "bare-pkg@0.1.0": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].packageName).toBe("bare-pkg");
    expect(result[0].version).toBe("0.1.0");
    expect(result[0].licenses).toBe("MIT");
    expect(result[0].repository).toBeUndefined();
    expect(result[0].path).toBeUndefined();
  });

  // --- prerelease / unusual version strings --------------------------------
  it("handles prerelease version strings", () => {
    const raw = {
      "beta-pkg@1.0.0-beta.1": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].packageName).toBe("beta-pkg");
    expect(result[0].version).toBe("1.0.0-beta.1");
  });

  it("handles 0.0.0-development version string", () => {
    const raw = {
      "dev-pkg@0.0.0-development": { licenses: "Apache-2.0" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].packageName).toBe("dev-pkg");
    expect(result[0].version).toBe("0.0.0-development");
  });

  it("handles scoped package with prerelease version", () => {
    const raw = {
      "@scope/beta@2.0.0-rc.3": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(1);
    expect(result[0].packageName).toBe("@scope/beta");
    expect(result[0].version).toBe("2.0.0-rc.3");
  });

  // --- multiple versions of same package -----------------------------------
  it("handles multiple versions of the same package", () => {
    const raw = {
      "lodash@3.0.0": { licenses: "MIT" },
      "lodash@4.17.21": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(2);

    const versions = result.map((r) => r.version);
    expect(versions).toContain("3.0.0");
    expect(versions).toContain("4.17.21");

    for (const pkg of result) {
      expect(pkg.packageName).toBe("lodash");
    }
  });

  it("handles multiple versions of a scoped package", () => {
    const raw = {
      "@types/node@18.0.0": { licenses: "MIT" },
      "@types/node@22.0.0": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(2);
    for (const pkg of result) {
      expect(pkg.packageName).toBe("@types/node");
    }
  });
});

// ---------------------------------------------------------------------------
// traceDependencyChain
// ---------------------------------------------------------------------------
describe("traceDependencyChain", () => {
  /**
   * Helper: create a temp project directory with a given package.json and
   * optional node_modules structure.
   */
  function makeTempProject(opts?: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    /** Map of dep name -> its own package.json dependencies */
    nodeModules?: Record<string, Record<string, string>>;
    /** If true, omit the dependencies field entirely */
    noDependencies?: boolean;
    /** If true, omit the devDependencies field entirely */
    noDevDependencies?: boolean;
  }) {
    const dir = mkdtempSync(join(tmpdir(), "lc-test-"));

    const pkgJson: Record<string, unknown> = { name: "test-project" };
    if (!opts?.noDependencies) {
      pkgJson.dependencies = opts?.dependencies ?? { express: "^4.18.0" };
    }
    if (!opts?.noDevDependencies) {
      pkgJson.devDependencies = opts?.devDependencies ?? {
        vitest: "^3.0.0",
      };
    }

    writeFileSync(join(dir, "package.json"), JSON.stringify(pkgJson));

    // Create node_modules entries
    const modules = opts?.nodeModules ?? {
      express: { "body-parser": "^1.20.0" },
    };
    for (const [depName, deps] of Object.entries(modules)) {
      const depDir = join(dir, "node_modules", depName);
      mkdirSync(depDir, { recursive: true });
      writeFileSync(
        join(depDir, "package.json"),
        JSON.stringify({ name: depName, dependencies: deps }),
      );
    }

    return dir;
  }

  // --- direct dependency in dependencies -----------------------------------
  it("finds a direct dependency in dependencies", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain("express", "test-project", dir);
    expect(chain).toEqual(["test-project", "express"]);
  });

  // --- direct dependency in devDependencies --------------------------------
  it("finds a direct dependency in devDependencies", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain("vitest", "test-project", dir);
    expect(chain).toEqual(["test-project", "vitest"]);
  });

  // --- transitive dependency (one level) -----------------------------------
  it("finds a transitive dependency one level deep", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain("body-parser", "test-project", dir);
    expect(chain).toEqual(["test-project", "express", "body-parser"]);
  });

  // --- deep dependency falls back to [...] chain ---------------------------
  it("falls back to [...] chain for deeply nested deps", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain(
      "unknown-deep-dep",
      "test-project",
      dir,
    );
    expect(chain).toEqual(["test-project", "...", "unknown-deep-dep"]);
  });

  // --- non-existent project path -------------------------------------------
  it("does not crash for non-existent project path", () => {
    const chain = traceDependencyChain(
      "express",
      "my-project",
      "/tmp/this-path-should-not-exist-ever-12345",
    );
    expect(chain).toEqual(["my-project", "...", "express"]);
  });

  // --- project with no dependencies field ----------------------------------
  it("handles project with no dependencies field", () => {
    const dir = makeTempProject({
      noDependencies: true,
      devDependencies: { vitest: "^3.0.0" },
      nodeModules: {},
    });
    // vitest is still in devDependencies, so it should be found as direct
    const chain = traceDependencyChain("vitest", "test-project", dir);
    expect(chain).toEqual(["test-project", "vitest"]);

    // something not listed should fall back
    const chain2 = traceDependencyChain("express", "test-project", dir);
    expect(chain2).toEqual(["test-project", "...", "express"]);
  });

  // --- project with empty dependencies -------------------------------------
  it("handles project with empty dependencies", () => {
    const dir = makeTempProject({
      dependencies: {},
      devDependencies: {},
      nodeModules: {},
    });
    const chain = traceDependencyChain("express", "test-project", dir);
    expect(chain).toEqual(["test-project", "...", "express"]);
  });

  // --- multiple transitive paths (first match wins) ------------------------
  it("returns first transitive match when multiple paths exist", () => {
    const dir = makeTempProject({
      dependencies: {
        "dep-a": "^1.0.0",
        "dep-b": "^1.0.0",
      },
      devDependencies: {},
      nodeModules: {
        "dep-a": { "shared-util": "^1.0.0" },
        "dep-b": { "shared-util": "^2.0.0" },
      },
    });
    const chain = traceDependencyChain("shared-util", "test-project", dir);
    // Should find it through one of the two deps (the order depends on
    // Object.keys ordering, but it should be a 3-element chain)
    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe("test-project");
    expect(chain[2]).toBe("shared-util");
    expect(["dep-a", "dep-b"]).toContain(chain[1]);
  });

  // --- scoped package names in dependency chain ----------------------------
  it("finds scoped package as a direct dependency", () => {
    const dir = makeTempProject({
      dependencies: { "@scope/my-lib": "^1.0.0" },
      devDependencies: {},
      nodeModules: {},
    });
    const chain = traceDependencyChain(
      "@scope/my-lib",
      "test-project",
      dir,
    );
    expect(chain).toEqual(["test-project", "@scope/my-lib"]);
  });

  it("finds scoped package as a transitive dependency", () => {
    const dir = mkdtempSync(join(tmpdir(), "lc-test-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "test-project",
        dependencies: { "parent-pkg": "^1.0.0" },
      }),
    );
    // parent-pkg depends on @scope/child
    const parentDir = join(dir, "node_modules", "parent-pkg");
    mkdirSync(parentDir, { recursive: true });
    writeFileSync(
      join(parentDir, "package.json"),
      JSON.stringify({
        name: "parent-pkg",
        dependencies: { "@scope/child": "^2.0.0" },
      }),
    );

    const chain = traceDependencyChain("@scope/child", "test-project", dir);
    expect(chain).toEqual(["test-project", "parent-pkg", "@scope/child"]);
  });

  // --- package.json with only devDependencies (no dependencies field) ------
  it("handles package.json with only devDependencies", () => {
    const dir = makeTempProject({
      noDependencies: true,
      devDependencies: { eslint: "^8.0.0" },
      nodeModules: {
        eslint: { "eslint-scope": "^7.0.0" },
      },
    });
    // eslint is a direct devDep
    const chain1 = traceDependencyChain("eslint", "test-project", dir);
    expect(chain1).toEqual(["test-project", "eslint"]);

    // eslint-scope is a transitive dep of eslint
    const chain2 = traceDependencyChain(
      "eslint-scope",
      "test-project",
      dir,
    );
    expect(chain2).toEqual(["test-project", "eslint", "eslint-scope"]);
  });

  // --- dep whose node_modules package.json is unreadable -------------------
  it("skips deps whose package.json cannot be read and falls back", () => {
    const dir = makeTempProject({
      dependencies: { "broken-dep": "^1.0.0", "good-dep": "^1.0.0" },
      devDependencies: {},
      nodeModules: {
        // good-dep exists in node_modules and has our target as transitive
        "good-dep": { "target-pkg": "^1.0.0" },
        // broken-dep's directory exists but we won't write a package.json
      },
    });
    // Remove the broken-dep package.json to simulate unreadable
    const brokenDir = join(dir, "node_modules", "broken-dep");
    mkdirSync(brokenDir, { recursive: true });
    // Don't write package.json here

    const chain = traceDependencyChain("target-pkg", "test-project", dir);
    // Should still find it through good-dep
    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe("test-project");
    expect(chain[2]).toBe("target-pkg");
  });
});

// ---------------------------------------------------------------------------
// scanProject (integration tests)
// ---------------------------------------------------------------------------
describe("scanProject", () => {
  const PROJECT_PATH = "/Users/josephnordqvist/Code/license-compliance-mcp";

  it(
    "scans the actual license-compliance-mcp project and returns packages",
    async () => {
      const result = await scanProject(PROJECT_PATH);

      expect(result.packages.length).toBeGreaterThan(0);
    },
    30_000,
  );

  it(
    "has projectName matching 'license-compliance-mcp'",
    async () => {
      const result = await scanProject(PROJECT_PATH);

      expect(result.projectName).toBe("license-compliance-mcp");
    },
    30_000,
  );

  it(
    "has projectPath matching the input path",
    async () => {
      const result = await scanProject(PROJECT_PATH);

      expect(result.projectPath).toBe(PROJECT_PATH);
    },
    30_000,
  );

  it(
    "every package has packageName, version, and licenses fields",
    async () => {
      const result = await scanProject(PROJECT_PATH);

      for (const pkg of result.packages) {
        expect(pkg.packageName).toBeDefined();
        expect(typeof pkg.packageName).toBe("string");
        expect(pkg.packageName.length).toBeGreaterThan(0);

        expect(pkg.version).toBeDefined();
        expect(typeof pkg.version).toBe("string");
        expect(pkg.version.length).toBeGreaterThan(0);

        expect(pkg.licenses).toBeDefined();
        expect(typeof pkg.licenses).toBe("string");
        expect(pkg.licenses.length).toBeGreaterThan(0);
      }
    },
    30_000,
  );

  it(
    'includes known dependencies like "zod" and "@modelcontextprotocol/sdk"',
    async () => {
      const result = await scanProject(PROJECT_PATH);
      const packageNames = result.packages.map((p) => p.packageName);

      expect(packageNames).toContain("zod");
      expect(packageNames).toContain("@modelcontextprotocol/sdk");
    },
    30_000,
  );

  it("rejects when scanning a non-existent path", async () => {
    await expect(
      scanProject("/tmp/this-path-does-not-exist-99999"),
    ).rejects.toThrow();
  });

  it(
    "rejects for a temp directory with no node_modules",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "lc-empty-"));
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "empty-project" }),
      );

      // license-checker-rseidelsohn throws when no packages are found
      await expect(scanProject(dir)).rejects.toThrow();

      rmSync(dir, { recursive: true, force: true });
    },
    30_000,
  );
});
