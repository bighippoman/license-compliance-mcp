import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("MCP server", () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["build/index.js"],
      cwd: "/Users/josephnordqvist/Code/license-compliance-mcp",
    });
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  describe("tool discovery", () => {
    it("lists exactly 2 tools", async () => {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(2);
    });

    it("has check-licenses tool", async () => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("check-licenses");
    });

    it("has explain-license tool", async () => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("explain-license");
    });

    it("check-licenses has path and policy parameters", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "check-licenses")!;
      const schema = tool.inputSchema as { properties: Record<string, unknown> };
      expect(schema.properties).toHaveProperty("path");
      expect(schema.properties).toHaveProperty("policy");
    });

    it("explain-license has license parameter", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "explain-license")!;
      const schema = tool.inputSchema as { properties: Record<string, unknown> };
      expect(schema.properties).toHaveProperty("license");
    });
  });

  describe("explain-license", () => {
    it("returns explanation for MIT", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "MIT" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("# MIT License");
      expect(text).toContain("permissive");
      expect(text).toContain("Permissions");
    });

    it("returns explanation for GPL-3.0-only", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "GPL-3.0-only" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("strong-copyleft");
      expect(text).toContain("Proprietary/Commercial | ❌ No");
    });

    it("returns explanation for AGPL-3.0-only with SaaS restriction", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "AGPL-3.0-only" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("SaaS/Network Use | ❌ No");
    });

    it("handles deprecated identifier GPL-3.0 via normalization", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "GPL-3.0" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("GPL-3.0-only");
    });

    it("handles correctable input 'Apache 2.0' via normalization", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "Apache 2.0" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Apache");
    });

    it("returns unknown message for unrecognized license", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "FANTASY-LICENSE-42" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Unknown license");
      expect(text).toContain("FANTASY-LICENSE-42");
    });

    it("returns unknown message for empty-ish identifier", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "xyz-not-real" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Unknown license");
    });

    it("lists supported licenses in unknown response", async () => {
      const result = await client.callTool({
        name: "explain-license",
        arguments: { license: "NOPE" },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("MIT");
      expect(text).toContain("GPL-3.0-only");
      expect(text).toContain("AGPL-3.0-only");
    });
  });

  describe("check-licenses", () => {
    it("scans real project with default permissive policy", async () => {
      const result = await client.callTool({
        name: "check-licenses",
        arguments: {
          path: "/Users/josephnordqvist/Code/license-compliance-mcp",
        },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("# License Compliance Report");
      expect(text).toContain("permissive");
      expect(text).toContain("All dependencies comply");
    }, 30000);

    it("scans with copyleft policy", async () => {
      const result = await client.callTool({
        name: "check-licenses",
        arguments: {
          path: "/Users/josephnordqvist/Code/license-compliance-mcp",
          policy: "copyleft",
        },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("copyleft");
      expect(text).toContain("All dependencies comply");
    }, 30000);

    it("finds violations with restrictive MIT-only policy", async () => {
      const result = await client.callTool({
        name: "check-licenses",
        arguments: {
          path: "/Users/josephnordqvist/Code/license-compliance-mcp",
          policy: "MIT",
        },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("CRITICAL");
      expect(text).toContain("ISC"); // ISC packages should be flagged
    }, 30000);

    it("returns error for non-existent path", async () => {
      const result = await client.callTool({
        name: "check-licenses",
        arguments: {
          path: "/nonexistent/path/that/does/not/exist",
        },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Error scanning project");
      expect(result.isError).toBe(true);
    });

    it("custom SPDX policy works", async () => {
      const result = await client.callTool({
        name: "check-licenses",
        arguments: {
          path: "/Users/josephnordqvist/Code/license-compliance-mcp",
          policy: "(MIT OR ISC OR BSD-2-Clause OR BSD-3-Clause OR Apache-2.0 OR 0BSD OR Unlicense OR CC0-1.0 OR BlueOak-1.0.0 OR Python-2.0)",
        },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("# License Compliance Report");
    }, 30000);

    it("weak-copyleft policy string works", async () => {
      const result = await client.callTool({
        name: "check-licenses",
        arguments: {
          path: "/Users/josephnordqvist/Code/license-compliance-mcp",
          policy: "weak-copyleft",
        },
      });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("weak-copyleft");
    }, 30000);
  });
});
