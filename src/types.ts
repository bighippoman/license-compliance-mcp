export interface LicenseInfo {
  packageName: string;
  version: string;
  licenses: string;
  repository?: string;
  path?: string;
}

export type Severity = "critical" | "warning" | "info";

export interface ComplianceIssue {
  severity: Severity;
  packageName: string;
  version: string;
  license: string;
  reason: string;
  dependencyChain: string[];
  correctedLicense?: string;
}

export interface ComplianceReport {
  totalPackages: number;
  issueCount: number;
  issues: ComplianceIssue[];
  scannedPath: string;
  policy: string;
  timestamp: string;
}

export type PolicyPreset = "permissive" | "weak-copyleft" | "copyleft";

export type LicenseCategory =
  | "permissive"
  | "weak-copyleft"
  | "strong-copyleft"
  | "network-copyleft"
  | "public-domain"
  | "proprietary"
  | "unknown";

export interface LicenseExplanation {
  identifier: string;
  name: string;
  category: LicenseCategory;
  summary: string;
  permissions: string[];
  conditions: string[];
  limitations: string[];
  compatibility: {
    proprietary: boolean;
    openSource: boolean;
    saas: boolean;
  };
  gotchas: string[];
}

export interface ScanResult {
  packages: LicenseInfo[];
  projectPath: string;
  projectName: string;
}
