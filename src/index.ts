#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scanProject, traceDependencyChain } from "./scanner.js";
import { resolvePolicy, evaluatePackage, normalizeLicense } from "./policy.js";
import { formatReport, formatLicenseExplanation } from "./formatter.js";
import { explainLicense } from "./license-explainer.js";
import type { ComplianceIssue, ComplianceReport } from "./types.js";

const server = new McpServer({
  name: "license-compliance",
  version: "1.0.0",
});

server.registerTool(
  "check-licenses",
  {
    title: "Check License Compliance",
    description:
      "Scan a project's npm dependencies for license compliance issues. Checks all installed packages against a policy (permissive, weak-copyleft, copyleft, or a custom SPDX expression). Returns a detailed markdown report with any violations, warnings, and dependency chains.",
    inputSchema: {
      path: z.string().describe("Absolute path to the project root (must contain package.json and node_modules)"),
      policy: z
        .string()
        .optional()
        .default("permissive")
        .describe(
          'Policy preset ("permissive", "weak-copyleft", "copyleft") or a custom SPDX expression like "(MIT OR Apache-2.0)"',
        ),
    },
  },
  async ({ path, policy }) => {
    try {
      const allowedLicenses = resolvePolicy(policy);
      const scanResult = await scanProject(path);
      const allIssues: ComplianceIssue[] = [];

      for (const pkg of scanResult.packages) {
        const chain = traceDependencyChain(
          pkg.packageName,
          scanResult.projectName,
          path,
        );
        const issues = evaluatePackage(pkg, allowedLicenses, chain);
        allIssues.push(...issues);
      }

      const report: ComplianceReport = {
        totalPackages: scanResult.packages.length,
        issueCount: allIssues.length,
        issues: allIssues,
        scannedPath: path,
        policy,
        timestamp: new Date().toISOString(),
      };

      return {
        content: [{ type: "text" as const, text: formatReport(report) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error scanning project: ${message}\n\nMake sure the path exists, contains a package.json, and has node_modules installed (run \`npm install\` first).`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "explain-license",
  {
    title: "Explain License",
    description:
      "Explain what a specific SPDX license means in plain language. Covers permissions, conditions, limitations, compatibility with proprietary/open-source/SaaS use, and common gotchas. Supports 15 major licenses plus deprecated SPDX forms.",
    inputSchema: {
      license: z
        .string()
        .describe('SPDX license identifier (e.g., "MIT", "GPL-3.0-only", "Apache-2.0")'),
    },
  },
  async ({ license }) => {
    // Try direct lookup first
    let explanation = explainLicense(license);

    // If not found, try normalizing
    if (!explanation) {
      const { normalized } = normalizeLicense(license);
      if (normalized !== "UNKNOWN") {
        explanation = explainLicense(normalized);
      }
    }

    if (!explanation) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown license: "${license}"\n\nThis license is not in the knowledge base. Try using the exact SPDX identifier (e.g., "MIT", "GPL-3.0-only", "Apache-2.0").\n\nSupported licenses: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, Unlicense, CC0-1.0, MPL-2.0, LGPL-2.1-only, LGPL-3.0-only, EPL-2.0, GPL-2.0-only, GPL-3.0-only, AGPL-3.0-only`,
          },
        ],
      };
    }

    return {
      content: [
        { type: "text" as const, text: formatLicenseExplanation(explanation) },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
