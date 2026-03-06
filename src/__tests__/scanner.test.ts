import { describe, it, expect } from "vitest";
import { parseCheckerOutput, traceDependencyChain } from "../scanner.js";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parseCheckerOutput", () => {
  it("parses standard packages", () => {
    const raw = {
      "express@4.18.2": {
        licenses: "MIT",
        repository: "https://github.com/expressjs/express",
        path: "/project/node_modules/express",
      },
      "lodash@4.17.21": {
        licenses: "MIT",
      },
    };

    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      packageName: "express",
      version: "4.18.2",
      licenses: "MIT",
      repository: "https://github.com/expressjs/express",
      path: "/project/node_modules/express",
    });
    expect(result[1].packageName).toBe("lodash");
  });

  it("parses scoped packages", () => {
    const raw = {
      "@modelcontextprotocol/sdk@1.27.1": {
        licenses: "MIT",
      },
      "@types/node@22.0.0": {
        licenses: "MIT",
      },
    };

    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(2);
    expect(result[0].packageName).toBe("@modelcontextprotocol/sdk");
    expect(result[0].version).toBe("1.27.1");
    expect(result[1].packageName).toBe("@types/node");
  });

  it("handles UNKNOWN licenses", () => {
    const raw = {
      "mystery-pkg@1.0.0": {},
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("UNKNOWN");
  });

  it("handles compound license expressions", () => {
    const raw = {
      "dual-licensed@2.0.0": {
        licenses: "(MIT OR Apache-2.0)",
      },
    };
    const result = parseCheckerOutput(raw);
    expect(result[0].licenses).toBe("(MIT OR Apache-2.0)");
  });

  it("skips malformed entries without @", () => {
    const raw = {
      "no-version": { licenses: "MIT" },
    };
    const result = parseCheckerOutput(raw);
    expect(result).toHaveLength(0);
  });
});

describe("traceDependencyChain", () => {
  function makeTempProject() {
    const dir = mkdtempSync(join(tmpdir(), "lc-test-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "test-project",
        dependencies: { express: "^4.18.0" },
        devDependencies: { vitest: "^3.0.0" },
      }),
    );
    // Create a mock direct dep with its own dependency
    mkdirSync(join(dir, "node_modules", "express"), { recursive: true });
    writeFileSync(
      join(dir, "node_modules", "express", "package.json"),
      JSON.stringify({
        name: "express",
        dependencies: { "body-parser": "^1.20.0" },
      }),
    );
    return dir;
  }

  it("finds direct dependencies", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain("express", "test-project", dir);
    expect(chain).toEqual(["test-project", "express"]);
  });

  it("finds transitive dependencies (one level)", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain("body-parser", "test-project", dir);
    expect(chain).toEqual(["test-project", "express", "body-parser"]);
  });

  it("falls back for deeply nested deps", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain("unknown-deep-dep", "test-project", dir);
    expect(chain).toEqual(["test-project", "...", "unknown-deep-dep"]);
  });

  it("handles dev dependencies as direct", () => {
    const dir = makeTempProject();
    const chain = traceDependencyChain("vitest", "test-project", dir);
    expect(chain).toEqual(["test-project", "vitest"]);
  });
});
