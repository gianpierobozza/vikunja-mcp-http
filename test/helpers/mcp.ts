import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type InternalMcpServer = McpServer & {
  _registeredTools: Record<string, unknown>;
  validateToolInput: (tool: unknown, args: unknown, toolName: string) => Promise<unknown>;
  executeToolHandler: (tool: unknown, args: unknown, extra: Record<string, unknown>) => Promise<unknown>;
};

export function getRegisteredTool(server: McpServer, toolName: string) {
  const internalServer = server as InternalMcpServer;
  const tool = internalServer._registeredTools[toolName];

  if (!tool) {
    throw new Error(`Tool "${toolName}" is not registered.`);
  }

  return tool;
}

export async function callTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const internalServer = server as InternalMcpServer;
  const tool = getRegisteredTool(server, toolName);

  const validatedArgs = await internalServer.validateToolInput(tool, args, toolName);
  return internalServer.executeToolHandler(tool, validatedArgs, {});
}
