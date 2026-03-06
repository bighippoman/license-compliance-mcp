import { describe, it, expect } from "vitest";
import { explainLicense, KNOWN_LICENSES } from "../license-explainer.js";

describe("KNOWN_LICENSES", () => {
  it("contains 15 licenses", () => {
    expect(Object.keys(KNOWN_LICENSES).length).toBe(15);
  });

  it("all entries have required fields", () => {
    for (const [id, entry] of Object.entries(KNOWN_LICENSES)) {
      expect(entry.identifier).toBe(id);
      expect(entry.name).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.summary).toBeTruthy();
      expect(Array.isArray(entry.permissions)).toBe(true);
      expect(Array.isArray(entry.conditions)).toBe(true);
      expect(Array.isArray(entry.limitations)).toBe(true);
      expect(typeof entry.compatibility.proprietary).toBe("boolean");
      expect(typeof entry.compatibility.openSource).toBe("boolean");
      expect(typeof entry.compatibility.saas).toBe("boolean");
      expect(Array.isArray(entry.gotchas)).toBe(true);
      expect(entry.gotchas.length).toBeGreaterThan(0);
    }
  });
});

describe("explainLicense", () => {
  it.each([
    ["MIT", "permissive"],
    ["ISC", "permissive"],
    ["BSD-2-Clause", "permissive"],
    ["BSD-3-Clause", "permissive"],
    ["Apache-2.0", "permissive"],
    ["0BSD", "permissive"],
    ["Unlicense", "public-domain"],
    ["CC0-1.0", "public-domain"],
    ["MPL-2.0", "weak-copyleft"],
    ["LGPL-2.1-only", "weak-copyleft"],
    ["LGPL-3.0-only", "weak-copyleft"],
    ["EPL-2.0", "weak-copyleft"],
    ["GPL-2.0-only", "strong-copyleft"],
    ["GPL-3.0-only", "strong-copyleft"],
    ["AGPL-3.0-only", "network-copyleft"],
  ] as const)("returns correct category for %s", (id, category) => {
    const result = explainLicense(id);
    expect(result).not.toBeNull();
    expect(result!.category).toBe(category);
  });

  it("permissive licenses are compatible with proprietary", () => {
    for (const id of ["MIT", "ISC", "BSD-2-Clause", "Apache-2.0"]) {
      const result = explainLicense(id)!;
      expect(result.compatibility.proprietary).toBe(true);
    }
  });

  it("GPL licenses are NOT compatible with proprietary", () => {
    for (const id of ["GPL-2.0-only", "GPL-3.0-only", "AGPL-3.0-only"]) {
      const result = explainLicense(id)!;
      expect(result.compatibility.proprietary).toBe(false);
    }
  });

  it("AGPL is NOT compatible with SaaS", () => {
    const agpl = explainLicense("AGPL-3.0-only")!;
    expect(agpl.compatibility.saas).toBe(false);
  });

  it("GPL IS compatible with SaaS (only distribution triggers copyleft)", () => {
    const gpl = explainLicense("GPL-3.0-only")!;
    expect(gpl.compatibility.saas).toBe(true);
  });

  it("resolves deprecated GPL-3.0 to GPL-3.0-only", () => {
    const result = explainLicense("GPL-3.0");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("GPL-3.0-only");
  });

  it("resolves deprecated LGPL-2.1 to LGPL-2.1-only", () => {
    const result = explainLicense("LGPL-2.1");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("LGPL-2.1-only");
  });

  it("resolves deprecated AGPL-3.0 to AGPL-3.0-only", () => {
    const result = explainLicense("AGPL-3.0");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("AGPL-3.0-only");
  });

  it("returns null for unknown licenses", () => {
    expect(explainLicense("My-Custom-License")).toBeNull();
    expect(explainLicense("UNKNOWN")).toBeNull();
  });

  it("Apache-2.0 gotchas mention GPL-2.0 incompatibility", () => {
    const apache = explainLicense("Apache-2.0")!;
    const hasGplNote = apache.gotchas.some((g) => g.includes("GPL-2.0"));
    expect(hasGplNote).toBe(true);
  });
});
