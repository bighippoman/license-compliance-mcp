import type { LicenseExplanation } from "./types.js";

const DEPRECATED_MAP: Record<string, string> = {
  "GPL-2.0": "GPL-2.0-only",
  "GPL-2.0+": "GPL-2.0-or-later",
  "GPL-3.0": "GPL-3.0-only",
  "GPL-3.0+": "GPL-3.0-or-later",
  "LGPL-2.0": "LGPL-2.0-only",
  "LGPL-2.0+": "LGPL-2.0-or-later",
  "LGPL-2.1": "LGPL-2.1-only",
  "LGPL-2.1+": "LGPL-2.1-or-later",
  "LGPL-3.0": "LGPL-3.0-only",
  "LGPL-3.0+": "LGPL-3.0-or-later",
  "AGPL-3.0": "AGPL-3.0-only",
  "AGPL-3.0+": "AGPL-3.0-or-later",
};

export const KNOWN_LICENSES: Record<string, LicenseExplanation> = {
  MIT: {
    identifier: "MIT",
    name: "MIT License",
    category: "permissive",
    summary:
      "A short, permissive license with conditions only requiring preservation of copyright and license notices. Licensed works, modifications, and larger works may be distributed under different terms and without source code.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Include copyright and license notice"],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "Must include original MIT license text in all copies or substantial portions",
      "Cannot use contributors' names for endorsement without permission",
    ],
  },

  ISC: {
    identifier: "ISC",
    name: "ISC License",
    category: "permissive",
    summary:
      "A permissive license functionally equivalent to the MIT license, preferred by the OpenBSD project. Simplified wording compared to MIT/BSD.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Include copyright and license notice"],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: ["Functionally identical to MIT — just shorter wording"],
  },

  "BSD-2-Clause": {
    identifier: "BSD-2-Clause",
    name: 'BSD 2-Clause "Simplified" License',
    category: "permissive",
    summary:
      "A permissive license with two conditions: retain copyright notice in source and binary redistributions.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: ["Include copyright notice in source and binary distributions"],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: ["Very similar to MIT — just organized differently"],
  },

  "BSD-3-Clause": {
    identifier: "BSD-3-Clause",
    name: 'BSD 3-Clause "New" or "Revised" License',
    category: "permissive",
    summary:
      "Like BSD-2-Clause but with a third clause: contributors' names cannot be used to endorse derived products without permission.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: [
      "Include copyright notice in source and binary distributions",
      "No endorsement using contributors' names",
    ],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: ["The 'no endorsement' clause is the only difference from BSD-2-Clause"],
  },

  "Apache-2.0": {
    identifier: "Apache-2.0",
    name: "Apache License 2.0",
    category: "permissive",
    summary:
      "A permissive license that also provides an express grant of patent rights from contributors to users. Requires preservation of copyright and license notices.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Patent use",
      "Private use",
    ],
    conditions: [
      "Include copyright and license notice",
      "State changes made to the code",
      "Include NOTICE file if one exists",
    ],
    limitations: ["No liability", "No warranty", "No trademark rights"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "NOT compatible with GPL-2.0 due to patent clause conflict — Apache-2.0 code cannot be included in GPL-2.0 projects",
      "IS compatible with GPL-3.0 (the FSF confirmed this)",
      "Requires stating changes if you modify the code",
    ],
  },

  "0BSD": {
    identifier: "0BSD",
    name: "BSD Zero Clause License",
    category: "permissive",
    summary:
      "The most permissive BSD variant. Grants permission to use, copy, modify, and distribute without any conditions — effectively public domain equivalent.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: [],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: ["Even more permissive than MIT — no attribution required at all"],
  },

  Unlicense: {
    identifier: "Unlicense",
    name: "The Unlicense",
    category: "public-domain",
    summary:
      "A public domain dedication. Releases code with no conditions whatsoever. Anyone can use, modify, distribute, sublicense, or sell the code.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: [],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "Some jurisdictions don't recognize public domain dedications — the Unlicense includes a fallback permissive license",
      "Some companies avoid Unlicense due to the legal ambiguity of public domain",
    ],
  },

  "CC0-1.0": {
    identifier: "CC0-1.0",
    name: "Creative Commons Zero v1.0 Universal",
    category: "public-domain",
    summary:
      "A public domain dedication from Creative Commons. Waives all copyright to the extent possible under law.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: [],
    limitations: ["No liability", "No warranty", "No patent rights"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "Does NOT grant patent rights — unlike Unlicense",
      "Primarily designed for data/content but used for code too",
    ],
  },

  "MPL-2.0": {
    identifier: "MPL-2.0",
    name: "Mozilla Public License 2.0",
    category: "weak-copyleft",
    summary:
      "A weak copyleft license that requires modified files to remain under MPL-2.0, but allows combining with proprietary code in a larger work. File-level copyleft only.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Patent use",
      "Private use",
    ],
    conditions: [
      "Disclose source of modified MPL files",
      "Include copyright and license notice",
      "Same license for modified MPL files",
    ],
    limitations: ["No liability", "No warranty", "No trademark rights"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "Copyleft is file-level only — you can combine MPL files with proprietary files in the same project",
      "If you modify an MPL-2.0 file, your modifications must stay MPL-2.0",
      "Has an explicit GPL compatibility clause (Section 3.3)",
    ],
  },

  "LGPL-2.1-only": {
    identifier: "LGPL-2.1-only",
    name: "GNU Lesser General Public License v2.1 only",
    category: "weak-copyleft",
    summary:
      "A weak copyleft license designed for libraries. Allows proprietary software to link against LGPL libraries without the copyleft applying to the proprietary code, provided dynamic linking is used.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Private use",
    ],
    conditions: [
      "Disclose source of modified LGPL code",
      "Include copyright and license notice",
      "Same license for modifications to LGPL code",
      "Allow relinking (for C/C++ libraries)",
    ],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "In npm/bundling context, the dynamic linking exception is murky — bundled JS is arguably static linking",
      "Some legal teams treat LGPL npm packages as effectively GPL for bundled applications",
      "Modifications to the LGPL code itself must be open-sourced",
    ],
  },

  "LGPL-3.0-only": {
    identifier: "LGPL-3.0-only",
    name: "GNU Lesser General Public License v3.0 only",
    category: "weak-copyleft",
    summary:
      "Updated version of LGPL-2.1. Same concept — allows proprietary use through dynamic linking — but inherits GPL-3.0's anti-tivoization provisions.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Patent use",
      "Private use",
    ],
    conditions: [
      "Disclose source of modified LGPL code",
      "Include copyright and license notice",
      "Same license for modifications to LGPL code",
      "Allow relinking",
      "No hardware restrictions on running modified versions",
    ],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "Same npm bundling ambiguity as LGPL-2.1",
      "Adds anti-tivoization: hardware using the code must allow users to install modified versions",
      "Companies with embedded devices may have issues with this",
    ],
  },

  "EPL-2.0": {
    identifier: "EPL-2.0",
    name: "Eclipse Public License 2.0",
    category: "weak-copyleft",
    summary:
      "A weak copyleft license from the Eclipse Foundation. Module-level copyleft — modified modules must remain EPL but can be combined with other-licensed modules.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Patent use",
      "Private use",
    ],
    conditions: [
      "Disclose source of modified EPL modules",
      "Include copyright and license notice",
    ],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: true, openSource: true, saas: true },
    gotchas: [
      "Module-level copyleft similar to MPL-2.0",
      "Has an optional GPL-2.0 compatibility designation",
    ],
  },

  "GPL-2.0-only": {
    identifier: "GPL-2.0-only",
    name: "GNU General Public License v2.0 only",
    category: "strong-copyleft",
    summary:
      "A strong copyleft license. Any derivative work must also be distributed under GPL-2.0. Cannot be used in proprietary software.",
    permissions: ["Commercial use", "Modification", "Distribution", "Private use"],
    conditions: [
      "Disclose source code",
      "Include copyright and license notice",
      "Same license for derivative works",
      "State changes",
    ],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: false, openSource: true, saas: true },
    gotchas: [
      "NOT compatible with Apache-2.0 (patent clause conflict)",
      "NOT compatible with GPL-3.0 (different license versions are not compatible)",
      "SaaS does NOT trigger copyleft — only distribution does",
      "Internal company use does NOT trigger copyleft",
      "Using a GPL library in your code makes your entire codebase GPL",
    ],
  },

  "GPL-3.0-only": {
    identifier: "GPL-3.0-only",
    name: "GNU General Public License v3.0 only",
    category: "strong-copyleft",
    summary:
      "The latest version of the GPL. Strong copyleft with additional protections against patent claims and tivoization. Derivative works must be GPL-3.0.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Patent use",
      "Private use",
    ],
    conditions: [
      "Disclose source code",
      "Include copyright and license notice",
      "Same license for derivative works",
      "State changes",
      "No hardware restrictions (anti-tivoization)",
    ],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: false, openSource: true, saas: true },
    gotchas: [
      "Compatible with Apache-2.0 (unlike GPL-2.0)",
      "SaaS does NOT trigger copyleft — you can run GPL-3.0 code on a server without releasing your code",
      "Only distribution triggers copyleft obligations",
      "Companies that distribute software (desktop apps, SDKs, embedded) must avoid GPL deps",
      "Adds anti-tivoization: hardware must allow installation of modified software",
    ],
  },

  "AGPL-3.0-only": {
    identifier: "AGPL-3.0-only",
    name: "GNU Affero General Public License v3.0",
    category: "network-copyleft",
    summary:
      "The strongest copyleft license. Like GPL-3.0 but with an additional requirement: providing the software as a network service (SaaS) also triggers copyleft obligations.",
    permissions: [
      "Commercial use",
      "Modification",
      "Distribution",
      "Patent use",
      "Private use",
    ],
    conditions: [
      "Disclose source code",
      "Include copyright and license notice",
      "Same license for derivative works",
      "State changes",
      "Network use triggers copyleft (the 'Affero' clause)",
    ],
    limitations: ["No liability", "No warranty"],
    compatibility: { proprietary: false, openSource: true, saas: false },
    gotchas: [
      "SaaS/server use DOES trigger copyleft — this is the key difference from GPL",
      "Many companies ban AGPL dependencies entirely as a policy",
      "Google famously bans AGPL in all their projects",
      "If you use AGPL code in a web service, you must offer the complete source to all users",
      "Even internal tools may need source disclosure if accessed over a network",
    ],
  },
};

/**
 * Look up a license explanation by SPDX identifier.
 * Handles deprecated SPDX forms by mapping to current identifiers.
 */
export function explainLicense(identifier: string): LicenseExplanation | null {
  if (KNOWN_LICENSES[identifier]) {
    return KNOWN_LICENSES[identifier];
  }

  // Try deprecated mapping
  const mapped = DEPRECATED_MAP[identifier];
  if (mapped && KNOWN_LICENSES[mapped]) {
    return KNOWN_LICENSES[mapped];
  }

  return null;
}
