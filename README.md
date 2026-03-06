# license-compliance-mcp

MCP server that scans npm project dependencies for license compliance issues. Catch GPL contamination before code ships.

## Tools

### `check-licenses`

Scan a project's npm dependencies against a license policy and get a detailed compliance report.

**Parameters:**
- `path` (required) — Absolute path to the project root
- `policy` (optional, default: `"permissive"`) — Policy preset or custom SPDX expression
  - `"permissive"` — Only MIT, ISC, BSD, Apache-2.0, etc.
  - `"weak-copyleft"` — Adds LGPL, MPL-2.0, EPL-2.0
  - `"copyleft"` — Adds GPL, AGPL
  - Custom: `"(MIT OR Apache-2.0)"` — Any valid SPDX expression

### `explain-license`

Get a plain-language explanation of any SPDX license — permissions, conditions, limitations, compatibility, and gotchas.

**Parameters:**
- `license` (required) — SPDX identifier (e.g., `"MIT"`, `"GPL-3.0-only"`, `"Apache-2.0"`)

## Install

### Claude Code

```bash
claude mcp add license-compliance -- npx -y license-compliance-mcp
```

### Claude Desktop / Cursor

Add to your config (`claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "license-compliance": {
      "command": "npx",
      "args": ["-y", "license-compliance-mcp"]
    }
  }
}
```

## How It Works

1. Scans `node_modules` using `license-checker-rseidelsohn`
2. Normalizes license strings to valid SPDX using `spdx-correct`
3. Evaluates each package against the policy using `spdx-satisfies`
4. Traces dependency chains to show how problematic packages entered the project
5. Generates a markdown report grouped by severity (critical > warning > info)

## Requirements

- Node.js >= 18
- Project must have `node_modules` installed (`npm install`)

