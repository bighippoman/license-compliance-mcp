import type { ComplianceReport, ComplianceIssue, LicenseExplanation } from "./types.js";

function severityOrder(severity: string): number {
  switch (severity) {
    case "critical": return 0;
    case "warning": return 1;
    case "info": return 2;
    default: return 3;
  }
}

function severityEmoji(severity: string): string {
  switch (severity) {
    case "critical": return "🔴";
    case "warning": return "🟡";
    case "info": return "🔵";
    default: return "⚪";
  }
}

function formatIssue(issue: ComplianceIssue): string {
  const chain = issue.dependencyChain.join(" → ");
  const lines = [
    `- **${issue.packageName}@${issue.version}** — \`${issue.license}\``,
    `  ${issue.reason}`,
    `  _Chain: ${chain}_`,
  ];
  if (issue.correctedLicense) {
    lines.push(`  _Corrected to: \`${issue.correctedLicense}\`_`);
  }
  return lines.join("\n");
}

export function formatReport(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push("# License Compliance Report");
  lines.push("");
  lines.push(`**Path:** ${report.scannedPath}`);
  lines.push(`**Policy:** ${report.policy}`);
  lines.push(`**Scanned:** ${report.totalPackages} packages`);
  lines.push(`**Issues:** ${report.issueCount}`);
  lines.push(`**Time:** ${report.timestamp}`);
  lines.push("");

  if (report.issueCount === 0) {
    lines.push("✅ **All dependencies comply with the selected policy.**");
    return lines.join("\n");
  }

  // Group and sort by severity
  const sorted = [...report.issues].sort(
    (a, b) => severityOrder(a.severity) - severityOrder(b.severity),
  );

  const grouped = new Map<string, ComplianceIssue[]>();
  for (const issue of sorted) {
    const key = issue.severity.toUpperCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(issue);
  }

  for (const [severity, issues] of grouped) {
    const emoji = severityEmoji(severity.toLowerCase());
    lines.push(`## ${emoji} ${severity} (${issues.length})`);
    lines.push("");
    for (const issue of issues) {
      lines.push(formatIssue(issue));
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatLicenseExplanation(explanation: LicenseExplanation): string {
  const lines: string[] = [];

  lines.push(`# ${explanation.name}`);
  lines.push("");
  lines.push(`**SPDX Identifier:** \`${explanation.identifier}\``);
  lines.push(`**Category:** ${explanation.category}`);
  lines.push("");
  lines.push(explanation.summary);
  lines.push("");

  if (explanation.permissions.length > 0) {
    lines.push("## Permissions");
    for (const p of explanation.permissions) lines.push(`- ✅ ${p}`);
    lines.push("");
  }

  if (explanation.conditions.length > 0) {
    lines.push("## Conditions");
    for (const c of explanation.conditions) lines.push(`- 📋 ${c}`);
    lines.push("");
  }

  if (explanation.limitations.length > 0) {
    lines.push("## Limitations");
    for (const l of explanation.limitations) lines.push(`- ❌ ${l}`);
    lines.push("");
  }

  lines.push("## Compatibility");
  lines.push("");
  lines.push(`| Use Case | Compatible |`);
  lines.push(`|----------|-----------|`);
  lines.push(`| Proprietary/Commercial | ${explanation.compatibility.proprietary ? "✅ Yes" : "❌ No"} |`);
  lines.push(`| Open Source | ${explanation.compatibility.openSource ? "✅ Yes" : "❌ No"} |`);
  lines.push(`| SaaS/Network Use | ${explanation.compatibility.saas ? "✅ Yes" : "❌ No"} |`);
  lines.push("");

  if (explanation.gotchas.length > 0) {
    lines.push("## Gotchas");
    for (const g of explanation.gotchas) lines.push(`- ⚠️ ${g}`);
    lines.push("");
  }

  return lines.join("\n");
}
