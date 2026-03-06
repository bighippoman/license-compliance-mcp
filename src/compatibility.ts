import type { LicenseCategory, PolicyPreset } from "./types.js";

export const PERMISSIVE_LICENSES = new Set([
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
]);

export const PUBLIC_DOMAIN_LICENSES = new Set([
  "Unlicense",
  "CC0-1.0",
]);

export const WEAK_COPYLEFT_LICENSES = new Set([
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
]);

export const STRONG_COPYLEFT_LICENSES = new Set([
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  // Deprecated SPDX forms
  "GPL-2.0",
  "GPL-3.0",
  "GPL-2.0+",
  "GPL-3.0+",
]);

export const NETWORK_COPYLEFT_LICENSES = new Set([
  "AGPL-1.0-only",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  // Deprecated SPDX forms
  "AGPL-1.0",
  "AGPL-3.0",
  "AGPL-3.0+",
]);

export const NON_COMMERCIAL_LICENSES = new Set([
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
]);

const categoryMap = new Map<string, LicenseCategory>();
for (const id of PERMISSIVE_LICENSES) categoryMap.set(id, "permissive");
for (const id of PUBLIC_DOMAIN_LICENSES) categoryMap.set(id, "public-domain");
for (const id of WEAK_COPYLEFT_LICENSES) categoryMap.set(id, "weak-copyleft");
for (const id of STRONG_COPYLEFT_LICENSES) categoryMap.set(id, "strong-copyleft");
for (const id of NETWORK_COPYLEFT_LICENSES) categoryMap.set(id, "network-copyleft");
for (const id of NON_COMMERCIAL_LICENSES) categoryMap.set(id, "proprietary");

export function getLicenseCategory(license: string): LicenseCategory {
  return categoryMap.get(license) ?? "unknown";
}

export function getPresetAllowedLicenses(preset: PolicyPreset): string[] {
  const allowed = [
    ...PERMISSIVE_LICENSES,
    ...PUBLIC_DOMAIN_LICENSES,
  ];

  if (preset === "weak-copyleft" || preset === "copyleft") {
    allowed.push(...WEAK_COPYLEFT_LICENSES);
  }

  if (preset === "copyleft") {
    allowed.push(...STRONG_COPYLEFT_LICENSES);
    allowed.push(...NETWORK_COPYLEFT_LICENSES);
  }

  return allowed;
}
