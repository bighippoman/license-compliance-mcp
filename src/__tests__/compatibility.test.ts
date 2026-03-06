import { describe, it, expect } from "vitest";
import {
  getLicenseCategory,
  getPresetAllowedLicenses,
  PERMISSIVE_LICENSES,
  PUBLIC_DOMAIN_LICENSES,
  WEAK_COPYLEFT_LICENSES,
  STRONG_COPYLEFT_LICENSES,
  NETWORK_COPYLEFT_LICENSES,
  NON_COMMERCIAL_LICENSES,
} from "../compatibility.js";

// ---------------------------------------------------------------------------
// getLicenseCategory — exhaustive coverage
// ---------------------------------------------------------------------------
describe("getLicenseCategory", () => {
  // --- Permissive licenses (every member of PERMISSIVE_LICENSES) -----------
  describe("permissive licenses", () => {
    it.each([
      "MIT",
      "ISC",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "Apache-2.0",
      "0BSD",
      "Zlib",
      "X11",
      "Artistic-2.0",
      "BSL-1.0",
      "curl",
      "WTFPL",
      "CC-BY-3.0",
      "CC-BY-4.0",
      "Python-2.0",
      "BlueOak-1.0.0",
    ])("classifies %s as permissive", (license) => {
      expect(getLicenseCategory(license)).toBe("permissive");
    });
  });

  // --- Public-domain licenses ----------------------------------------------
  describe("public-domain licenses", () => {
    it.each(["Unlicense", "CC0-1.0"])(
      "classifies %s as public-domain",
      (license) => {
        expect(getLicenseCategory(license)).toBe("public-domain");
      },
    );
  });

  // --- Weak-copyleft licenses (including deprecated SPDX forms) ------------
  describe("weak-copyleft licenses", () => {
    it.each([
      "LGPL-2.0-only",
      "LGPL-2.0-or-later",
      "LGPL-2.1-only",
      "LGPL-2.1-or-later",
      "LGPL-3.0-only",
      "LGPL-3.0-or-later",
      "MPL-2.0",
      "EPL-1.0",
      "EPL-2.0",
      "CDDL-1.0",
      "CDDL-1.1",
      // Deprecated SPDX forms
      "LGPL-2.0",
      "LGPL-2.1",
      "LGPL-3.0",
      "LGPL-2.0+",
      "LGPL-2.1+",
      "LGPL-3.0+",
    ])("classifies %s as weak-copyleft", (license) => {
      expect(getLicenseCategory(license)).toBe("weak-copyleft");
    });
  });

  // --- Strong-copyleft licenses (including deprecated SPDX forms) ----------
  describe("strong-copyleft licenses", () => {
    it.each([
      "GPL-2.0-only",
      "GPL-2.0-or-later",
      "GPL-3.0-only",
      "GPL-3.0-or-later",
      // Deprecated SPDX forms
      "GPL-2.0",
      "GPL-3.0",
      "GPL-2.0+",
      "GPL-3.0+",
    ])("classifies %s as strong-copyleft", (license) => {
      expect(getLicenseCategory(license)).toBe("strong-copyleft");
    });
  });

  // --- Network-copyleft licenses (including deprecated SPDX forms) ---------
  describe("network-copyleft licenses", () => {
    it.each([
      "AGPL-1.0-only",
      "AGPL-3.0-only",
      "AGPL-3.0-or-later",
      // Deprecated SPDX forms
      "AGPL-1.0",
      "AGPL-3.0",
      "AGPL-3.0+",
    ])("classifies %s as network-copyleft", (license) => {
      expect(getLicenseCategory(license)).toBe("network-copyleft");
    });
  });

  // --- Non-commercial / proprietary licenses -------------------------------
  describe("non-commercial licenses", () => {
    it.each([
      "CC-BY-NC-2.0",
      "CC-BY-NC-3.0",
      "CC-BY-NC-4.0",
      "CC-BY-NC-SA-2.0",
      "CC-BY-NC-SA-3.0",
      "CC-BY-NC-SA-4.0",
      "CC-BY-NC-ND-2.0",
      "CC-BY-NC-ND-3.0",
      "CC-BY-NC-ND-4.0",
      "SSPL-1.0",
      "BSL-1.1",
    ])("classifies %s as proprietary", (license) => {
      expect(getLicenseCategory(license)).toBe("proprietary");
    });
  });

  // --- Unknown / unrecognized licenses -------------------------------------
  describe("unknown licenses", () => {
    it("returns unknown for an empty string", () => {
      expect(getLicenseCategory("")).toBe("unknown");
    });

    it('returns unknown for the literal string "UNKNOWN"', () => {
      expect(getLicenseCategory("UNKNOWN")).toBe("unknown");
    });

    it("returns unknown for a random string", () => {
      expect(getLicenseCategory("My-Custom-License")).toBe("unknown");
    });

    it("returns unknown for a string resembling a license but not in any set", () => {
      expect(getLicenseCategory("MIT-0")).toBe("unknown");
    });

    it("returns unknown for a case-mismatched license identifier", () => {
      // The module is case-sensitive; 'mit' is not 'MIT'
      expect(getLicenseCategory("mit")).toBe("unknown");
      expect(getLicenseCategory("apache-2.0")).toBe("unknown");
      expect(getLicenseCategory("gpl-3.0")).toBe("unknown");
    });

    it("returns unknown for whitespace-only input", () => {
      expect(getLicenseCategory(" ")).toBe("unknown");
      expect(getLicenseCategory("  ")).toBe("unknown");
    });

    it("returns unknown for license identifier with surrounding whitespace", () => {
      expect(getLicenseCategory(" MIT ")).toBe("unknown");
      expect(getLicenseCategory(" Apache-2.0")).toBe("unknown");
    });

    it("returns unknown for a null-like string value", () => {
      expect(getLicenseCategory("null")).toBe("unknown");
      expect(getLicenseCategory("undefined")).toBe("unknown");
      expect(getLicenseCategory("none")).toBe("unknown");
    });
  });
});

// ---------------------------------------------------------------------------
// getPresetAllowedLicenses — preset membership & structural checks
// ---------------------------------------------------------------------------
describe("getPresetAllowedLicenses", () => {
  // --- permissive preset ---------------------------------------------------
  describe("permissive preset", () => {
    it("returns an array (not a Set)", () => {
      const result = getPresetAllowedLicenses("permissive");
      expect(Array.isArray(result)).toBe(true);
    });

    it("includes every PERMISSIVE license", () => {
      const allowed = new Set(getPresetAllowedLicenses("permissive"));
      for (const id of PERMISSIVE_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("includes every PUBLIC_DOMAIN license", () => {
      const allowed = new Set(getPresetAllowedLicenses("permissive"));
      for (const id of PUBLIC_DOMAIN_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("excludes every WEAK_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("permissive"));
      for (const id of WEAK_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("excludes every STRONG_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("permissive"));
      for (const id of STRONG_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("excludes every NETWORK_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("permissive"));
      for (const id of NETWORK_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("excludes every NON_COMMERCIAL license", () => {
      const allowed = new Set(getPresetAllowedLicenses("permissive"));
      for (const id of NON_COMMERCIAL_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("has exactly PERMISSIVE + PUBLIC_DOMAIN count", () => {
      const result = getPresetAllowedLicenses("permissive");
      expect(result.length).toBe(
        PERMISSIVE_LICENSES.size + PUBLIC_DOMAIN_LICENSES.size,
      );
    });

    it("contains no duplicates", () => {
      const result = getPresetAllowedLicenses("permissive");
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });
  });

  // --- weak-copyleft preset ------------------------------------------------
  describe("weak-copyleft preset", () => {
    it("returns an array (not a Set)", () => {
      const result = getPresetAllowedLicenses("weak-copyleft");
      expect(Array.isArray(result)).toBe(true);
    });

    it("includes every PERMISSIVE license", () => {
      const allowed = new Set(getPresetAllowedLicenses("weak-copyleft"));
      for (const id of PERMISSIVE_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("includes every PUBLIC_DOMAIN license", () => {
      const allowed = new Set(getPresetAllowedLicenses("weak-copyleft"));
      for (const id of PUBLIC_DOMAIN_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("includes every WEAK_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("weak-copyleft"));
      for (const id of WEAK_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("excludes every STRONG_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("weak-copyleft"));
      for (const id of STRONG_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("excludes every NETWORK_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("weak-copyleft"));
      for (const id of NETWORK_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("excludes every NON_COMMERCIAL license", () => {
      const allowed = new Set(getPresetAllowedLicenses("weak-copyleft"));
      for (const id of NON_COMMERCIAL_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("has exactly PERMISSIVE + PUBLIC_DOMAIN + WEAK_COPYLEFT count", () => {
      const result = getPresetAllowedLicenses("weak-copyleft");
      expect(result.length).toBe(
        PERMISSIVE_LICENSES.size +
          PUBLIC_DOMAIN_LICENSES.size +
          WEAK_COPYLEFT_LICENSES.size,
      );
    });

    it("contains no duplicates", () => {
      const result = getPresetAllowedLicenses("weak-copyleft");
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });
  });

  // --- copyleft preset -----------------------------------------------------
  describe("copyleft preset", () => {
    it("returns an array (not a Set)", () => {
      const result = getPresetAllowedLicenses("copyleft");
      expect(Array.isArray(result)).toBe(true);
    });

    it("includes every PERMISSIVE license", () => {
      const allowed = new Set(getPresetAllowedLicenses("copyleft"));
      for (const id of PERMISSIVE_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("includes every PUBLIC_DOMAIN license", () => {
      const allowed = new Set(getPresetAllowedLicenses("copyleft"));
      for (const id of PUBLIC_DOMAIN_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("includes every WEAK_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("copyleft"));
      for (const id of WEAK_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("includes every STRONG_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("copyleft"));
      for (const id of STRONG_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("includes every NETWORK_COPYLEFT license", () => {
      const allowed = new Set(getPresetAllowedLicenses("copyleft"));
      for (const id of NETWORK_COPYLEFT_LICENSES) {
        expect(allowed.has(id)).toBe(true);
      }
    });

    it("excludes every NON_COMMERCIAL license", () => {
      const allowed = new Set(getPresetAllowedLicenses("copyleft"));
      for (const id of NON_COMMERCIAL_LICENSES) {
        expect(allowed.has(id)).toBe(false);
      }
    });

    it("has exactly PERMISSIVE + PUBLIC_DOMAIN + WEAK + STRONG + NETWORK count", () => {
      const result = getPresetAllowedLicenses("copyleft");
      expect(result.length).toBe(
        PERMISSIVE_LICENSES.size +
          PUBLIC_DOMAIN_LICENSES.size +
          WEAK_COPYLEFT_LICENSES.size +
          STRONG_COPYLEFT_LICENSES.size +
          NETWORK_COPYLEFT_LICENSES.size,
      );
    });

    it("contains no duplicates", () => {
      const result = getPresetAllowedLicenses("copyleft");
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });
  });

  // --- Non-commercial licenses never appear in any preset ------------------
  describe("non-commercial exclusion across all presets", () => {
    it.each(["permissive", "weak-copyleft", "copyleft"] as const)(
      "%s preset never includes any NON_COMMERCIAL license",
      (preset) => {
        const allowed = new Set(getPresetAllowedLicenses(preset));
        for (const id of NON_COMMERCIAL_LICENSES) {
          expect(allowed.has(id)).toBe(false);
        }
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Set integrity — overlap, completeness, and consistency checks
// ---------------------------------------------------------------------------
describe("license set integrity", () => {
  const allSets = [
    { name: "PERMISSIVE_LICENSES", set: PERMISSIVE_LICENSES },
    { name: "PUBLIC_DOMAIN_LICENSES", set: PUBLIC_DOMAIN_LICENSES },
    { name: "WEAK_COPYLEFT_LICENSES", set: WEAK_COPYLEFT_LICENSES },
    { name: "STRONG_COPYLEFT_LICENSES", set: STRONG_COPYLEFT_LICENSES },
    { name: "NETWORK_COPYLEFT_LICENSES", set: NETWORK_COPYLEFT_LICENSES },
    { name: "NON_COMMERCIAL_LICENSES", set: NON_COMMERCIAL_LICENSES },
  ];

  // --- No overlap between any two sets -------------------------------------
  describe("no overlap between sets", () => {
    for (let i = 0; i < allSets.length; i++) {
      for (let j = i + 1; j < allSets.length; j++) {
        const a = allSets[i];
        const b = allSets[j];
        it(`${a.name} and ${b.name} have no common entries`, () => {
          const intersection = [...a.set].filter((id) => b.set.has(id));
          expect(intersection).toEqual([]);
        });
      }
    }
  });

  // --- categoryMap size matches sum of all sets ----------------------------
  it("total unique licenses across all sets equals the expected count", () => {
    const totalFromSets = allSets.reduce((sum, { set }) => sum + set.size, 0);
    // Collect every license from every set and verify there are no duplicates
    const allLicenses: string[] = [];
    for (const { set } of allSets) {
      allLicenses.push(...set);
    }
    const uniqueCount = new Set(allLicenses).size;
    // Because sets should not overlap, uniqueCount should equal totalFromSets
    expect(uniqueCount).toBe(totalFromSets);
  });

  // --- Every license in every set gets a non-unknown category ---------------
  describe("every license in every set resolves to a known category", () => {
    for (const { name, set } of allSets) {
      it(`all entries in ${name} have a non-unknown category`, () => {
        for (const id of set) {
          const category = getLicenseCategory(id);
          expect(category).not.toBe("unknown");
        }
      });
    }
  });

  // --- Each set maps to the expected category ------------------------------
  describe("each set maps to its expected category", () => {
    it("PERMISSIVE_LICENSES all map to permissive", () => {
      for (const id of PERMISSIVE_LICENSES) {
        expect(getLicenseCategory(id)).toBe("permissive");
      }
    });

    it("PUBLIC_DOMAIN_LICENSES all map to public-domain", () => {
      for (const id of PUBLIC_DOMAIN_LICENSES) {
        expect(getLicenseCategory(id)).toBe("public-domain");
      }
    });

    it("WEAK_COPYLEFT_LICENSES all map to weak-copyleft", () => {
      for (const id of WEAK_COPYLEFT_LICENSES) {
        expect(getLicenseCategory(id)).toBe("weak-copyleft");
      }
    });

    it("STRONG_COPYLEFT_LICENSES all map to strong-copyleft", () => {
      for (const id of STRONG_COPYLEFT_LICENSES) {
        expect(getLicenseCategory(id)).toBe("strong-copyleft");
      }
    });

    it("NETWORK_COPYLEFT_LICENSES all map to network-copyleft", () => {
      for (const id of NETWORK_COPYLEFT_LICENSES) {
        expect(getLicenseCategory(id)).toBe("network-copyleft");
      }
    });

    it("NON_COMMERCIAL_LICENSES all map to proprietary", () => {
      for (const id of NON_COMMERCIAL_LICENSES) {
        expect(getLicenseCategory(id)).toBe("proprietary");
      }
    });
  });

  // --- Expected set sizes (guard against accidental additions/removals) ----
  describe("expected set sizes", () => {
    it("PERMISSIVE_LICENSES has 16 entries", () => {
      expect(PERMISSIVE_LICENSES.size).toBe(16);
    });

    it("PUBLIC_DOMAIN_LICENSES has 2 entries", () => {
      expect(PUBLIC_DOMAIN_LICENSES.size).toBe(2);
    });

    it("WEAK_COPYLEFT_LICENSES has 17 entries", () => {
      expect(WEAK_COPYLEFT_LICENSES.size).toBe(17);
    });

    it("STRONG_COPYLEFT_LICENSES has 8 entries", () => {
      expect(STRONG_COPYLEFT_LICENSES.size).toBe(8);
    });

    it("NETWORK_COPYLEFT_LICENSES has 6 entries", () => {
      expect(NETWORK_COPYLEFT_LICENSES.size).toBe(6);
    });

    it("NON_COMMERCIAL_LICENSES has 11 entries", () => {
      expect(NON_COMMERCIAL_LICENSES.size).toBe(11);
    });
  });
});
