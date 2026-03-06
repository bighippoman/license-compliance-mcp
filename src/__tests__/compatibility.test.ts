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

describe("getLicenseCategory", () => {
  it.each([
    ["MIT", "permissive"],
    ["ISC", "permissive"],
    ["BSD-2-Clause", "permissive"],
    ["BSD-3-Clause", "permissive"],
    ["Apache-2.0", "permissive"],
    ["0BSD", "permissive"],
    ["Zlib", "permissive"],
    ["BlueOak-1.0.0", "permissive"],
    ["Unlicense", "public-domain"],
    ["CC0-1.0", "public-domain"],
    ["LGPL-2.1-only", "weak-copyleft"],
    ["LGPL-3.0-only", "weak-copyleft"],
    ["MPL-2.0", "weak-copyleft"],
    ["EPL-2.0", "weak-copyleft"],
    ["GPL-2.0-only", "strong-copyleft"],
    ["GPL-3.0-only", "strong-copyleft"],
    ["GPL-3.0", "strong-copyleft"],
    ["AGPL-3.0-only", "network-copyleft"],
    ["AGPL-3.0", "network-copyleft"],
    ["CC-BY-NC-4.0", "proprietary"],
    ["SSPL-1.0", "proprietary"],
    ["BSL-1.1", "proprietary"],
  ] as const)("classifies %s as %s", (license, expected) => {
    expect(getLicenseCategory(license)).toBe(expected);
  });

  it("returns unknown for unrecognized licenses", () => {
    expect(getLicenseCategory("My-Custom-License")).toBe("unknown");
    expect(getLicenseCategory("UNKNOWN")).toBe("unknown");
  });
});

describe("getPresetAllowedLicenses", () => {
  it("permissive preset includes only permissive and public-domain", () => {
    const allowed = new Set(getPresetAllowedLicenses("permissive"));
    for (const id of PERMISSIVE_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of PUBLIC_DOMAIN_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of WEAK_COPYLEFT_LICENSES) expect(allowed.has(id)).toBe(false);
    for (const id of STRONG_COPYLEFT_LICENSES) expect(allowed.has(id)).toBe(false);
  });

  it("weak-copyleft preset adds weak copyleft licenses", () => {
    const allowed = new Set(getPresetAllowedLicenses("weak-copyleft"));
    for (const id of PERMISSIVE_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of WEAK_COPYLEFT_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of STRONG_COPYLEFT_LICENSES) expect(allowed.has(id)).toBe(false);
  });

  it("copyleft preset includes everything except non-commercial", () => {
    const allowed = new Set(getPresetAllowedLicenses("copyleft"));
    for (const id of PERMISSIVE_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of WEAK_COPYLEFT_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of STRONG_COPYLEFT_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of NETWORK_COPYLEFT_LICENSES) expect(allowed.has(id)).toBe(true);
    for (const id of NON_COMMERCIAL_LICENSES) expect(allowed.has(id)).toBe(false);
  });
});
