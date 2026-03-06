import { describe, it, expect } from "vitest";
import { explainLicense, KNOWN_LICENSES } from "../license-explainer.js";
import type { LicenseCategory, LicenseExplanation } from "../types.js";

// ---------------------------------------------------------------------------
// KNOWN_LICENSES structure
// ---------------------------------------------------------------------------
describe("KNOWN_LICENSES", () => {
  const entries = Object.entries(KNOWN_LICENSES);
  const keys = Object.keys(KNOWN_LICENSES);

  it("has exactly 15 entries", () => {
    expect(keys).toHaveLength(15);
  });

  const expectedKeys = [
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "0BSD",
    "Unlicense",
    "CC0-1.0",
    "MPL-2.0",
    "LGPL-2.1-only",
    "LGPL-3.0-only",
    "EPL-2.0",
    "GPL-2.0-only",
    "GPL-3.0-only",
    "AGPL-3.0-only",
  ];

  it("contains all expected license identifiers", () => {
    for (const key of expectedKeys) {
      expect(KNOWN_LICENSES).toHaveProperty(key);
    }
  });

  describe("every entry has all required fields", () => {
    const validCategories: LicenseCategory[] = [
      "permissive",
      "weak-copyleft",
      "strong-copyleft",
      "network-copyleft",
      "public-domain",
      "proprietary",
      "unknown",
    ];

    it.each(entries)(
      "%s has identifier, name, category, summary, permissions, conditions, limitations, compatibility, gotchas",
      (_key, entry) => {
        expect(entry).toHaveProperty("identifier");
        expect(entry).toHaveProperty("name");
        expect(entry).toHaveProperty("category");
        expect(entry).toHaveProperty("summary");
        expect(entry).toHaveProperty("permissions");
        expect(entry).toHaveProperty("conditions");
        expect(entry).toHaveProperty("limitations");
        expect(entry).toHaveProperty("compatibility");
        expect(entry).toHaveProperty("gotchas");
      },
    );

    it.each(entries)("%s identifier matches its key", (key, entry) => {
      expect(entry.identifier).toBe(key);
    });

    it.each(entries)("%s has a non-empty name", (_key, entry) => {
      expect(entry.name).toBeTruthy();
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
    });

    it.each(entries)(
      "%s category is a valid LicenseCategory",
      (_key, entry) => {
        expect(validCategories).toContain(entry.category);
      },
    );

    it.each(entries)("%s has a non-empty summary", (_key, entry) => {
      expect(entry.summary).toBeTruthy();
      expect(typeof entry.summary).toBe("string");
      expect(entry.summary.length).toBeGreaterThan(0);
    });

    it.each(entries)("%s has at least 1 permission", (_key, entry) => {
      expect(Array.isArray(entry.permissions)).toBe(true);
      expect(entry.permissions.length).toBeGreaterThanOrEqual(1);
    });

    it.each(entries)("%s has at least 1 limitation", (_key, entry) => {
      expect(Array.isArray(entry.limitations)).toBe(true);
      expect(entry.limitations.length).toBeGreaterThanOrEqual(1);
    });

    it.each(entries)("%s has at least 1 gotcha", (_key, entry) => {
      expect(Array.isArray(entry.gotchas)).toBe(true);
      expect(entry.gotchas.length).toBeGreaterThanOrEqual(1);
    });

    it.each(entries)("%s conditions is an array", (_key, entry) => {
      expect(Array.isArray(entry.conditions)).toBe(true);
    });

    it.each(entries)(
      "%s compatibility has proprietary, openSource, saas booleans",
      (_key, entry) => {
        expect(typeof entry.compatibility.proprietary).toBe("boolean");
        expect(typeof entry.compatibility.openSource).toBe("boolean");
        expect(typeof entry.compatibility.saas).toBe("boolean");
      },
    );
  });
});

// ---------------------------------------------------------------------------
// explainLicense — direct lookups
// ---------------------------------------------------------------------------
describe("explainLicense", () => {
  describe("direct lookups return correct category for each license", () => {
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
    ] as [string, LicenseCategory][])(
      "explainLicense(%s) returns category %s",
      (id, expectedCategory) => {
        const result = explainLicense(id);
        expect(result).not.toBeNull();
        expect(result!.category).toBe(expectedCategory);
      },
    );

    it.each([
      "MIT",
      "ISC",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "Apache-2.0",
      "0BSD",
      "Unlicense",
      "CC0-1.0",
      "MPL-2.0",
      "LGPL-2.1-only",
      "LGPL-3.0-only",
      "EPL-2.0",
      "GPL-2.0-only",
      "GPL-3.0-only",
      "AGPL-3.0-only",
    ])("explainLicense(%s) returns an object with matching identifier", (id) => {
      const result = explainLicense(id);
      expect(result).not.toBeNull();
      expect(result!.identifier).toBe(id);
    });
  });

  // -------------------------------------------------------------------------
  // Returns null for unknown identifiers
  // -------------------------------------------------------------------------
  describe("returns null for unknown identifiers", () => {
    it("returns null for a random string", () => {
      expect(explainLicense("My-Custom-License")).toBeNull();
    });

    it("returns null for UNKNOWN", () => {
      expect(explainLicense("UNKNOWN")).toBeNull();
    });

    it("returns null for UNLICENSED", () => {
      expect(explainLicense("UNLICENSED")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe("edge cases", () => {
    it("returns null for empty string", () => {
      expect(explainLicense("")).toBeNull();
    });

    it("returns null for lowercase 'mit' (case sensitive)", () => {
      expect(explainLicense("mit")).toBeNull();
    });

    it("returns null for 'MIT ' with trailing whitespace", () => {
      expect(explainLicense("MIT ")).toBeNull();
    });

    it("returns null for ' MIT' with leading whitespace", () => {
      expect(explainLicense(" MIT")).toBeNull();
    });

    it("returns null for UNLICENSED", () => {
      expect(explainLicense("UNLICENSED")).toBeNull();
    });

    it("returns null for UNKNOWN", () => {
      expect(explainLicense("UNKNOWN")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Deprecated mappings
  // -------------------------------------------------------------------------
  describe("deprecated SPDX identifier mappings", () => {
    it("GPL-2.0 resolves to GPL-2.0-only", () => {
      const result = explainLicense("GPL-2.0");
      expect(result).not.toBeNull();
      expect(result!.identifier).toBe("GPL-2.0-only");
    });

    it("GPL-2.0+ maps to GPL-2.0-or-later which is not in KNOWN_LICENSES, so returns null", () => {
      const result = explainLicense("GPL-2.0+");
      expect(result).toBeNull();
    });

    it("GPL-3.0 resolves to GPL-3.0-only", () => {
      const result = explainLicense("GPL-3.0");
      expect(result).not.toBeNull();
      expect(result!.identifier).toBe("GPL-3.0-only");
    });

    it("GPL-3.0+ maps to GPL-3.0-or-later which is not in KNOWN_LICENSES, so returns null", () => {
      const result = explainLicense("GPL-3.0+");
      expect(result).toBeNull();
    });

    it("LGPL-2.0 maps to LGPL-2.0-only which is not in KNOWN_LICENSES, so returns null", () => {
      const result = explainLicense("LGPL-2.0");
      expect(result).toBeNull();
    });

    it("LGPL-2.1 resolves to LGPL-2.1-only", () => {
      const result = explainLicense("LGPL-2.1");
      expect(result).not.toBeNull();
      expect(result!.identifier).toBe("LGPL-2.1-only");
    });

    it("LGPL-3.0 resolves to LGPL-3.0-only", () => {
      const result = explainLicense("LGPL-3.0");
      expect(result).not.toBeNull();
      expect(result!.identifier).toBe("LGPL-3.0-only");
    });

    it("AGPL-3.0 resolves to AGPL-3.0-only", () => {
      const result = explainLicense("AGPL-3.0");
      expect(result).not.toBeNull();
      expect(result!.identifier).toBe("AGPL-3.0-only");
    });

    it("AGPL-3.0+ maps to AGPL-3.0-or-later which is not in KNOWN_LICENSES, so returns null", () => {
      const result = explainLicense("AGPL-3.0+");
      expect(result).toBeNull();
    });

    it("LGPL-2.0+ maps to LGPL-2.0-or-later which is not in KNOWN_LICENSES, so returns null", () => {
      const result = explainLicense("LGPL-2.0+");
      expect(result).toBeNull();
    });

    it("LGPL-2.1+ maps to LGPL-2.1-or-later which is not in KNOWN_LICENSES, so returns null", () => {
      const result = explainLicense("LGPL-2.1+");
      expect(result).toBeNull();
    });

    it("LGPL-3.0+ maps to LGPL-3.0-or-later which is not in KNOWN_LICENSES, so returns null", () => {
      const result = explainLicense("LGPL-3.0+");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Compatibility facts — domain-specific correctness
  // -------------------------------------------------------------------------
  describe("compatibility facts", () => {
    describe("permissive licenses: proprietary=true, openSource=true, saas=true", () => {
      it.each(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD"])(
        "%s allows proprietary, open source, and SaaS use",
        (id) => {
          const result = explainLicense(id)!;
          expect(result.compatibility.proprietary).toBe(true);
          expect(result.compatibility.openSource).toBe(true);
          expect(result.compatibility.saas).toBe(true);
        },
      );
    });

    describe("public-domain licenses: proprietary=true, saas=true", () => {
      it.each(["Unlicense", "CC0-1.0"])(
        "%s allows proprietary and SaaS use",
        (id) => {
          const result = explainLicense(id)!;
          expect(result.compatibility.proprietary).toBe(true);
          expect(result.compatibility.saas).toBe(true);
        },
      );
    });

    describe("GPL licenses: proprietary=false, saas=true (only distribution triggers copyleft)", () => {
      it("GPL-2.0-only: proprietary=false, saas=true", () => {
        const result = explainLicense("GPL-2.0-only")!;
        expect(result.compatibility.proprietary).toBe(false);
        expect(result.compatibility.saas).toBe(true);
      });

      it("GPL-3.0-only: proprietary=false, saas=true", () => {
        const result = explainLicense("GPL-3.0-only")!;
        expect(result.compatibility.proprietary).toBe(false);
        expect(result.compatibility.saas).toBe(true);
      });
    });

    describe("AGPL: proprietary=false, saas=false (network use triggers copyleft)", () => {
      it("AGPL-3.0-only: proprietary=false, saas=false", () => {
        const result = explainLicense("AGPL-3.0-only")!;
        expect(result.compatibility.proprietary).toBe(false);
        expect(result.compatibility.saas).toBe(false);
      });
    });

    describe("weak-copyleft licenses that allow proprietary combination", () => {
      it("MPL-2.0: proprietary=true (file-level copyleft allows combination)", () => {
        const result = explainLicense("MPL-2.0")!;
        expect(result.compatibility.proprietary).toBe(true);
      });

      it("LGPL-2.1-only: proprietary=true (linking exception)", () => {
        const result = explainLicense("LGPL-2.1-only")!;
        expect(result.compatibility.proprietary).toBe(true);
      });

      it("LGPL-3.0-only: proprietary=true (linking exception)", () => {
        const result = explainLicense("LGPL-3.0-only")!;
        expect(result.compatibility.proprietary).toBe(true);
      });

      it("EPL-2.0: proprietary=true (module-level copyleft)", () => {
        const result = explainLicense("EPL-2.0")!;
        expect(result.compatibility.proprietary).toBe(true);
      });
    });

    describe("all licenses have openSource=true", () => {
      it.each(Object.keys(KNOWN_LICENSES))(
        "%s has openSource=true",
        (id) => {
          const result = explainLicense(id)!;
          expect(result.compatibility.openSource).toBe(true);
        },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Gotcha content — verifying important domain-specific warnings
  // -------------------------------------------------------------------------
  describe("gotcha content", () => {
    it("Apache-2.0 mentions GPL-2.0 incompatibility", () => {
      const result = explainLicense("Apache-2.0")!;
      const hasGpl2Note = result.gotchas.some((g) => g.includes("GPL-2.0"));
      expect(hasGpl2Note).toBe(true);
    });

    it("Apache-2.0 mentions GPL-3.0 compatibility", () => {
      const result = explainLicense("Apache-2.0")!;
      const hasGpl3Note = result.gotchas.some((g) => g.includes("GPL-3.0"));
      expect(hasGpl3Note).toBe(true);
    });

    it("AGPL-3.0-only mentions Google banning AGPL", () => {
      const result = explainLicense("AGPL-3.0-only")!;
      const hasGoogleNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("google") && g.toLowerCase().includes("ban"),
      );
      expect(hasGoogleNote).toBe(true);
    });

    it("AGPL-3.0-only mentions SaaS triggering copyleft", () => {
      const result = explainLicense("AGPL-3.0-only")!;
      const hasSaasNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("saas") || g.toLowerCase().includes("server"),
      );
      expect(hasSaasNote).toBe(true);
    });

    it("GPL-2.0-only mentions SaaS does NOT trigger copyleft", () => {
      const result = explainLicense("GPL-2.0-only")!;
      const hasSaasNote = result.gotchas.some(
        (g) => g.includes("SaaS") && g.includes("NOT"),
      );
      expect(hasSaasNote).toBe(true);
    });

    it("GPL-3.0-only mentions Apache-2.0 compatibility (unlike GPL-2.0)", () => {
      const result = explainLicense("GPL-3.0-only")!;
      const hasApacheNote = result.gotchas.some(
        (g) => g.includes("Apache-2.0"),
      );
      expect(hasApacheNote).toBe(true);
    });

    it("GPL-3.0-only mentions SaaS does NOT trigger copyleft", () => {
      const result = explainLicense("GPL-3.0-only")!;
      const hasSaasNote = result.gotchas.some(
        (g) => g.includes("SaaS") && g.includes("NOT"),
      );
      expect(hasSaasNote).toBe(true);
    });

    it("LGPL-2.1-only mentions npm bundling ambiguity", () => {
      const result = explainLicense("LGPL-2.1-only")!;
      const hasBundlingNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("bundl") || g.toLowerCase().includes("npm"),
      );
      expect(hasBundlingNote).toBe(true);
    });

    it("LGPL-3.0-only mentions npm bundling ambiguity", () => {
      const result = explainLicense("LGPL-3.0-only")!;
      const hasBundlingNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("bundl") || g.toLowerCase().includes("npm"),
      );
      expect(hasBundlingNote).toBe(true);
    });

    it("0BSD mentions being more permissive than MIT", () => {
      const result = explainLicense("0BSD")!;
      const hasMitNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("more permissive than mit") || g.toLowerCase().includes("mit"),
      );
      expect(hasMitNote).toBe(true);
    });

    it("GPL-2.0-only mentions NOT compatible with Apache-2.0", () => {
      const result = explainLicense("GPL-2.0-only")!;
      const hasApacheNote = result.gotchas.some(
        (g) => g.includes("Apache-2.0") && g.includes("NOT"),
      );
      expect(hasApacheNote).toBe(true);
    });

    it("GPL-2.0-only mentions NOT compatible with GPL-3.0", () => {
      const result = explainLicense("GPL-2.0-only")!;
      const hasGpl3Note = result.gotchas.some(
        (g) => g.includes("GPL-3.0") && g.includes("NOT"),
      );
      expect(hasGpl3Note).toBe(true);
    });

    it("MPL-2.0 mentions file-level copyleft", () => {
      const result = explainLicense("MPL-2.0")!;
      const hasFileNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("file-level") || g.toLowerCase().includes("file"),
      );
      expect(hasFileNote).toBe(true);
    });

    it("Unlicense mentions public domain jurisdictional issues", () => {
      const result = explainLicense("Unlicense")!;
      const hasJurisdictionNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("jurisdiction") || g.toLowerCase().includes("public domain"),
      );
      expect(hasJurisdictionNote).toBe(true);
    });

    it("CC0-1.0 mentions no patent rights", () => {
      const result = explainLicense("CC0-1.0")!;
      const hasPatentNote = result.gotchas.some(
        (g) => g.toLowerCase().includes("patent"),
      );
      expect(hasPatentNote).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Return value shape
  // -------------------------------------------------------------------------
  describe("return value shape", () => {
    it("returned object satisfies the LicenseExplanation interface", () => {
      const result = explainLicense("MIT");
      expect(result).not.toBeNull();
      const explanation = result as LicenseExplanation;
      expect(typeof explanation.identifier).toBe("string");
      expect(typeof explanation.name).toBe("string");
      expect(typeof explanation.category).toBe("string");
      expect(typeof explanation.summary).toBe("string");
      expect(Array.isArray(explanation.permissions)).toBe(true);
      expect(Array.isArray(explanation.conditions)).toBe(true);
      expect(Array.isArray(explanation.limitations)).toBe(true);
      expect(typeof explanation.compatibility).toBe("object");
      expect(typeof explanation.compatibility.proprietary).toBe("boolean");
      expect(typeof explanation.compatibility.openSource).toBe("boolean");
      expect(typeof explanation.compatibility.saas).toBe("boolean");
      expect(Array.isArray(explanation.gotchas)).toBe(true);
    });

    it("null return for unknown license is exactly null (not undefined)", () => {
      const result = explainLicense("NONEXISTENT");
      expect(result).toBeNull();
      expect(result).not.toBeUndefined();
    });
  });
});
