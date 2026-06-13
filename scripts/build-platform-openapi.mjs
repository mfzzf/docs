import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../api-reference/platform-openapi.json");

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const p = (name) => ({ $ref: `#/components/parameters/${name}` });
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });

const jsonBody = (schema, description) => ({
  required: true,
  content: {
    "application/json": {
      schema: typeof schema === "string" ? ref(schema) : schema,
    },
  },
  ...(description ? { description } : {}),
});

const jsonResponse = (schema, description = "Success") => ({
  description,
  content: {
    "application/json": {
      schema: typeof schema === "string" ? ref(schema) : schema,
    },
  },
});

const emptyResponse = (description) => ({ description });

function operation({
  tag,
  summary,
  operationId,
  description,
  parameters = [],
  requestBody,
  response,
  status = "200",
  extraResponses = {},
}) {
  return {
    tags: [tag],
    summary,
    operationId,
    ...(description ? { description } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    security: [{ bearerAuth: [] }],
    responses: {
      [status]: response,
      "400": { $ref: "#/components/responses/BadRequest" },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "422": { $ref: "#/components/responses/ValidationError" },
      ...extraResponses,
    },
  };
}

const listOf = (schemaName) => ({
  type: "object",
  required: ["object", "data", "has_more"],
  properties: {
    object: { type: "string", const: "list" },
    data: { type: "array", items: ref(schemaName) },
    has_more: { type: "boolean" },
    next_cursor: nullable({ type: "string" }),
  },
});

const timestamp = {
  type: "string",
  format: "date-time",
  description: "RFC 3339 timestamp.",
};

const metadata = {
  type: "object",
  additionalProperties: true,
  description: "Arbitrary metadata stored with the resource.",
};

const stringMap = {
  type: "object",
  additionalProperties: { type: "string" },
};

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Astraflow Platform API",
    version: "0.1.0",
    license: {
      name: "Proprietary",
      identifier: "LicenseRef-Proprietary",
    },
    description:
      "Public platform API contract for Astraflow workspace resources. The web app currently backs some of these surfaces with Server Actions; this specification documents the external REST contract exposed in product documentation.",
  },
  servers: [
    {
      url: "http://agents.plumzz.com",
      description: "Production API host.",
    },
  ],
  tags: [
    { name: "Models", description: "Model catalog and ModelVerse routing." },
    { name: "Agents", description: "Agent definitions, versions, YAML, skills, and tool configuration." },
    { name: "Environments", description: "Sandbox environments and environment-level MCP attachments." },
    { name: "Sessions", description: "Interactive agent sessions, timeline events, approvals, and cancellation." },
    { name: "Files", description: "Workspace file uploads, downloads, and deletions." },
    { name: "Skills", description: "Custom skill definitions and attached resource files." },
    { name: "MCP Servers", description: "Workspace MCP server registry." },
    { name: "Memory Stores", description: "Vector memory stores and ingestion jobs." },
    { name: "Credentials", description: "Encrypted workspace secrets referenced by environments and MCP headers." },
    { name: "Deployments", description: "Manual, scheduled, and webhook deployment runs." },
    { name: "API Keys", description: "Workspace API key lifecycle." },
    { name: "Analytics", description: "Usage charts and request logs." },
    { name: "Workspace Settings", description: "Workspace profile, members, limits, and billing surfaces." },
    { name: "Account", description: "Authenticated user profile settings." },
  ],
  paths: {
    "/v1/models": {
      get: operation({
        tag: "Models",
        summary: "List available agent models",
        operationId: "listModels",
        description:
          "Returns the workspace model catalog. Current production routes all listed models through ModelVerse with per-million-token pricing metadata.",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("ModelProvider"), p("ModelApi")],
        response: jsonResponse(listOf("ModelCatalogEntry")),
      }),
    },

    "/v1/agents": {
      get: operation({
        tag: "Agents",
        summary: "List agents",
        operationId: "listAgents",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("AgentStatus")],
        response: jsonResponse(listOf("Agent")),
      }),
      post: operation({
        tag: "Agents",
        summary: "Create agent",
        operationId: "createAgent",
        description:
          "Creates an agent and its first version. The body mirrors the Create Agent surface, including model, runtime, tools, MCP servers, skills, and metadata.",
        requestBody: jsonBody("CreateAgentRequest"),
        response: jsonResponse("Agent", "Created"),
        status: "201",
      }),
    },
    "/v1/agents/generate-yaml": {
      post: operation({
        tag: "Agents",
        summary: "Generate agent YAML",
        operationId: "generateAgentYaml",
        requestBody: jsonBody("GenerateAgentYamlRequest"),
        response: jsonResponse("GenerateAgentYamlResponse"),
      }),
    },
    "/v1/agents/{agent_id}": {
      get: operation({
        tag: "Agents",
        summary: "Get agent",
        operationId: "getAgent",
        parameters: [p("AgentId"), p("IncludeVersions")],
        response: jsonResponse("Agent"),
      }),
      patch: operation({
        tag: "Agents",
        summary: "Update agent",
        operationId: "updateAgent",
        parameters: [p("AgentId")],
        requestBody: jsonBody("UpdateAgentRequest"),
        response: jsonResponse("Agent"),
      }),
      delete: operation({
        tag: "Agents",
        summary: "Archive agent",
        operationId: "archiveAgent",
        parameters: [p("AgentId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/agents/{agent_id}/versions": {
      get: operation({
        tag: "Agents",
        summary: "List agent versions",
        operationId: "listAgentVersions",
        parameters: [p("AgentId"), p("Limit"), p("Cursor")],
        response: jsonResponse(listOf("AgentVersion")),
      }),
    },
    "/v1/agents/{agent_id}/versions/{version_id}/activate": {
      post: operation({
        tag: "Agents",
        summary: "Activate agent version",
        operationId: "activateAgentVersion",
        parameters: [p("AgentId"), p("VersionId")],
        response: jsonResponse("Agent"),
      }),
    },

    "/v1/environments": {
      get: operation({
        tag: "Environments",
        summary: "List environments",
        operationId: "listEnvironments",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("EnvironmentStatus")],
        response: jsonResponse(listOf("Environment")),
      }),
      post: operation({
        tag: "Environments",
        summary: "Create environment",
        operationId: "createEnvironment",
        requestBody: jsonBody("CreateEnvironmentRequest"),
        response: jsonResponse("Environment", "Created"),
        status: "201",
      }),
    },
    "/v1/environments/{environment_id}": {
      get: operation({
        tag: "Environments",
        summary: "Get environment",
        operationId: "getEnvironment",
        parameters: [p("EnvironmentId")],
        response: jsonResponse("Environment"),
      }),
      patch: operation({
        tag: "Environments",
        summary: "Update environment",
        operationId: "updateEnvironment",
        parameters: [p("EnvironmentId")],
        requestBody: jsonBody("UpdateEnvironmentRequest"),
        response: jsonResponse("Environment"),
      }),
      delete: operation({
        tag: "Environments",
        summary: "Disable environment",
        operationId: "disableEnvironment",
        parameters: [p("EnvironmentId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/environments/{environment_id}/clone": {
      post: operation({
        tag: "Environments",
        summary: "Clone environment",
        operationId: "cloneEnvironment",
        parameters: [p("EnvironmentId")],
        requestBody: jsonBody("CloneEnvironmentRequest"),
        response: jsonResponse("Environment", "Created"),
        status: "201",
      }),
    },
    "/v1/environments/{environment_id}/mcp-servers": {
      put: operation({
        tag: "Environments",
        summary: "Replace environment MCP servers",
        operationId: "replaceEnvironmentMcpServers",
        parameters: [p("EnvironmentId")],
        requestBody: jsonBody("ReplaceEnvironmentMcpServersRequest"),
        response: jsonResponse("EnvironmentMcpServers"),
      }),
    },

    "/v1/sessions": {
      get: operation({
        tag: "Sessions",
        summary: "List sessions",
        operationId: "listSessions",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("SessionStatus"), p("AgentIdOptional")],
        response: jsonResponse(listOf("Session")),
      }),
      post: operation({
        tag: "Sessions",
        summary: "Create session",
        operationId: "createSession",
        requestBody: jsonBody("CreateSessionRequest"),
        response: jsonResponse("Session", "Created"),
        status: "201",
      }),
    },
    "/v1/sessions/{session_id}": {
      get: operation({
        tag: "Sessions",
        summary: "Get session",
        operationId: "getSession",
        parameters: [p("SessionId"), p("IncludeEvents")],
        response: jsonResponse("Session"),
      }),
    },
    "/v1/sessions/{session_id}/events": {
      get: operation({
        tag: "Sessions",
        summary: "List session events",
        operationId: "listSessionEvents",
        parameters: [p("SessionId"), p("Limit"), p("Cursor"), p("SinceEventId")],
        response: jsonResponse(listOf("SessionEvent")),
      }),
    },
    "/v1/sessions/{session_id}/stream": {
      get: operation({
        tag: "Sessions",
        summary: "Stream session events",
        operationId: "streamSessionEvents",
        parameters: [p("SessionId"), p("LastEventId")],
        response: {
          description: "Server-sent event stream of session timeline events.",
          content: {
            "text/event-stream": {
              schema: { type: "string" },
            },
          },
        },
      }),
    },
    "/v1/sessions/{session_id}/messages": {
      post: operation({
        tag: "Sessions",
        summary: "Send session message",
        operationId: "sendSessionMessage",
        parameters: [p("SessionId")],
        requestBody: jsonBody("SendSessionMessageRequest"),
        response: jsonResponse("SessionMessageAccepted", "Accepted"),
        status: "202",
      }),
    },
    "/v1/sessions/{session_id}/approvals": {
      post: operation({
        tag: "Sessions",
        summary: "Approve or reject a tool call",
        operationId: "createSessionApproval",
        parameters: [p("SessionId")],
        requestBody: jsonBody("SessionApprovalRequest"),
        response: jsonResponse("SessionApproval"),
      }),
    },
    "/v1/sessions/{session_id}/cancel": {
      post: operation({
        tag: "Sessions",
        summary: "Cancel session",
        operationId: "cancelSession",
        parameters: [p("SessionId")],
        response: jsonResponse("Session"),
      }),
    },

    "/v1/files": {
      get: operation({
        tag: "Files",
        summary: "List files",
        operationId: "listFiles",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("FilePurpose")],
        response: jsonResponse(listOf("FileResource")),
      }),
      post: operation({
        tag: "Files",
        summary: "Upload file",
        operationId: "uploadFile",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: ref("UploadFileRequest"),
            },
          },
        },
        response: jsonResponse("FileResource", "Created"),
        status: "201",
      }),
    },
    "/v1/files/{file_id}": {
      get: operation({
        tag: "Files",
        summary: "Get file metadata",
        operationId: "getFile",
        parameters: [p("FileId")],
        response: jsonResponse("FileResource"),
      }),
      delete: operation({
        tag: "Files",
        summary: "Delete file",
        operationId: "deleteFile",
        parameters: [p("FileId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/files/{file_id}/download": {
      get: operation({
        tag: "Files",
        summary: "Download file",
        operationId: "downloadFile",
        parameters: [p("FileId")],
        response: {
          description: "Raw file bytes.",
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
      }),
    },

    "/v1/skills": {
      get: operation({
        tag: "Skills",
        summary: "List skills",
        operationId: "listSkills",
        parameters: [p("Limit"), p("Cursor"), p("Search")],
        response: jsonResponse(listOf("Skill")),
      }),
      post: operation({
        tag: "Skills",
        summary: "Create skill",
        operationId: "createSkill",
        requestBody: jsonBody("CreateSkillRequest"),
        response: jsonResponse("Skill", "Created"),
        status: "201",
      }),
    },
    "/v1/skills/{skill_id}": {
      get: operation({
        tag: "Skills",
        summary: "Get skill",
        operationId: "getSkill",
        parameters: [p("SkillId"), p("IncludeVersions")],
        response: jsonResponse("Skill"),
      }),
      patch: operation({
        tag: "Skills",
        summary: "Update skill",
        operationId: "updateSkill",
        parameters: [p("SkillId")],
        requestBody: jsonBody("UpdateSkillRequest"),
        response: jsonResponse("Skill"),
      }),
      delete: operation({
        tag: "Skills",
        summary: "Delete skill",
        operationId: "deleteSkill",
        parameters: [p("SkillId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/skills/{skill_id}/versions": {
      get: operation({
        tag: "Skills",
        summary: "List skill versions",
        operationId: "listSkillVersions",
        parameters: [p("SkillId"), p("Limit"), p("Cursor")],
        response: jsonResponse(listOf("SkillVersion")),
      }),
    },

    "/v1/mcp-servers": {
      get: operation({
        tag: "MCP Servers",
        summary: "List MCP servers",
        operationId: "listMcpServers",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("McpServerType")],
        response: jsonResponse(listOf("McpServer")),
      }),
      post: operation({
        tag: "MCP Servers",
        summary: "Create MCP server",
        operationId: "createMcpServer",
        requestBody: jsonBody("CreateMcpServerRequest"),
        response: jsonResponse("McpServer", "Created"),
        status: "201",
      }),
    },
    "/v1/mcp-servers/{mcp_server_id}": {
      get: operation({
        tag: "MCP Servers",
        summary: "Get MCP server",
        operationId: "getMcpServer",
        parameters: [p("McpServerId")],
        response: jsonResponse("McpServer"),
      }),
      patch: operation({
        tag: "MCP Servers",
        summary: "Update MCP server",
        operationId: "updateMcpServer",
        parameters: [p("McpServerId")],
        requestBody: jsonBody("UpdateMcpServerRequest"),
        response: jsonResponse("McpServer"),
      }),
      delete: operation({
        tag: "MCP Servers",
        summary: "Delete MCP server",
        operationId: "deleteMcpServer",
        parameters: [p("McpServerId")],
        response: jsonResponse("DeletedObject"),
      }),
    },

    "/v1/memory-stores": {
      get: operation({
        tag: "Memory Stores",
        summary: "List memory stores",
        operationId: "listMemoryStores",
        parameters: [p("Limit"), p("Cursor"), p("Search")],
        response: jsonResponse(listOf("MemoryStore")),
      }),
      post: operation({
        tag: "Memory Stores",
        summary: "Create memory store",
        operationId: "createMemoryStore",
        requestBody: jsonBody("CreateMemoryStoreRequest"),
        response: jsonResponse("MemoryStore", "Created"),
        status: "201",
      }),
    },
    "/v1/memory-stores/{memory_store_id}": {
      get: operation({
        tag: "Memory Stores",
        summary: "Get memory store",
        operationId: "getMemoryStore",
        parameters: [p("MemoryStoreId")],
        response: jsonResponse("MemoryStore"),
      }),
      delete: operation({
        tag: "Memory Stores",
        summary: "Delete memory store",
        operationId: "deleteMemoryStore",
        parameters: [p("MemoryStoreId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/memory-stores/{memory_store_id}/documents": {
      get: operation({
        tag: "Memory Stores",
        summary: "List memory documents",
        operationId: "listMemoryDocuments",
        parameters: [p("MemoryStoreId"), p("Limit"), p("Cursor"), p("Search")],
        response: jsonResponse(listOf("MemoryDocument")),
      }),
      post: operation({
        tag: "Memory Stores",
        summary: "Ingest memory document",
        operationId: "ingestMemoryDocument",
        parameters: [p("MemoryStoreId")],
        requestBody: jsonBody("IngestMemoryDocumentRequest"),
        response: jsonResponse("MemoryDocument", "Created"),
        status: "201",
      }),
    },
    "/v1/memory-stores/{memory_store_id}/search": {
      post: operation({
        tag: "Memory Stores",
        summary: "Search memory chunks",
        operationId: "searchMemoryStore",
        parameters: [p("MemoryStoreId")],
        requestBody: jsonBody("SearchMemoryStoreRequest"),
        response: jsonResponse("SearchMemoryStoreResponse"),
      }),
    },

    "/v1/credentials": {
      get: operation({
        tag: "Credentials",
        summary: "List credentials",
        operationId: "listCredentials",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("CredentialType")],
        response: jsonResponse(listOf("Credential")),
      }),
      post: operation({
        tag: "Credentials",
        summary: "Create credential",
        operationId: "createCredential",
        requestBody: jsonBody("CreateCredentialRequest"),
        response: jsonResponse("Credential", "Created"),
        status: "201",
      }),
    },
    "/v1/credentials/{credential_id}": {
      get: operation({
        tag: "Credentials",
        summary: "Get credential metadata",
        operationId: "getCredential",
        parameters: [p("CredentialId")],
        response: jsonResponse("Credential"),
      }),
      delete: operation({
        tag: "Credentials",
        summary: "Delete credential",
        operationId: "deleteCredential",
        parameters: [p("CredentialId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/credentials/{credential_id}/rotate": {
      post: operation({
        tag: "Credentials",
        summary: "Rotate credential secret",
        operationId: "rotateCredential",
        parameters: [p("CredentialId")],
        requestBody: jsonBody("RotateCredentialRequest"),
        response: jsonResponse("Credential"),
      }),
    },

    "/v1/deployments": {
      get: operation({
        tag: "Deployments",
        summary: "List deployments",
        operationId: "listDeployments",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("DeploymentTrigger"), p("DeploymentEnabled")],
        response: jsonResponse(listOf("Deployment")),
      }),
      post: operation({
        tag: "Deployments",
        summary: "Create deployment",
        operationId: "createDeployment",
        requestBody: jsonBody("CreateDeploymentRequest"),
        response: jsonResponse("Deployment", "Created"),
        status: "201",
      }),
    },
    "/v1/deployments/{deployment_id}": {
      get: operation({
        tag: "Deployments",
        summary: "Get deployment",
        operationId: "getDeployment",
        parameters: [p("DeploymentId")],
        response: jsonResponse("Deployment"),
      }),
      patch: operation({
        tag: "Deployments",
        summary: "Update deployment",
        operationId: "updateDeployment",
        parameters: [p("DeploymentId")],
        requestBody: jsonBody("UpdateDeploymentRequest"),
        response: jsonResponse("Deployment"),
      }),
      delete: operation({
        tag: "Deployments",
        summary: "Disable deployment",
        operationId: "disableDeployment",
        parameters: [p("DeploymentId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/deployments/{deployment_id}/runs": {
      get: operation({
        tag: "Deployments",
        summary: "List deployment runs",
        operationId: "listDeploymentRuns",
        parameters: [p("DeploymentId"), p("Limit"), p("Cursor")],
        response: jsonResponse(listOf("DeploymentRun")),
      }),
      post: operation({
        tag: "Deployments",
        summary: "Run deployment",
        operationId: "runDeployment",
        parameters: [p("DeploymentId")],
        requestBody: jsonBody("RunDeploymentRequest"),
        response: jsonResponse("DeploymentRun", "Created"),
        status: "201",
      }),
    },
    "/v1/deployment-runs/{deployment_run_id}": {
      get: operation({
        tag: "Deployments",
        summary: "Get deployment run",
        operationId: "getDeploymentRun",
        parameters: [p("DeploymentRunId")],
        response: jsonResponse("DeploymentRun"),
      }),
    },

    "/v1/api-keys": {
      get: operation({
        tag: "API Keys",
        summary: "List API keys",
        operationId: "listApiKeys",
        parameters: [p("Limit"), p("Cursor"), p("Search")],
        response: jsonResponse(listOf("ApiKey")),
      }),
      post: operation({
        tag: "API Keys",
        summary: "Create API key",
        operationId: "createApiKey",
        requestBody: jsonBody("CreateApiKeyRequest"),
        response: jsonResponse("CreateApiKeyResponse", "Created"),
        status: "201",
      }),
    },
    "/v1/api-keys/{api_key_id}/revoke": {
      post: operation({
        tag: "API Keys",
        summary: "Revoke API key",
        operationId: "revokeApiKey",
        parameters: [p("ApiKeyId")],
        response: jsonResponse("ApiKey"),
      }),
    },
    "/v1/api-keys/{api_key_id}": {
      delete: operation({
        tag: "API Keys",
        summary: "Delete API key",
        operationId: "deleteApiKey",
        parameters: [p("ApiKeyId")],
        response: jsonResponse("DeletedObject"),
      }),
    },

    "/v1/usage": {
      get: operation({
        tag: "Analytics",
        summary: "Get usage summary",
        operationId: "getUsageSummary",
        parameters: [p("UsageFrom"), p("UsageTo"), p("UsageInterval"), p("AgentIdOptional"), p("ModelOptional")],
        response: jsonResponse("UsageSummary"),
      }),
    },
    "/v1/request-logs": {
      get: operation({
        tag: "Analytics",
        summary: "List LLM request logs",
        operationId: "listRequestLogs",
        parameters: [p("Limit"), p("Cursor"), p("Search"), p("RequestLogProvider"), p("AgentIdOptional"), p("SessionIdOptional")],
        response: jsonResponse(listOf("RequestLog")),
      }),
    },
    "/v1/request-logs/{request_id}": {
      get: operation({
        tag: "Analytics",
        summary: "Get request log",
        operationId: "getRequestLog",
        parameters: [p("RequestId")],
        response: jsonResponse("RequestLog"),
      }),
    },

    "/v1/workspaces/{workspace_id}/dashboard": {
      get: operation({
        tag: "Workspace Settings",
        summary: "Get workspace dashboard",
        operationId: "getWorkspaceDashboard",
        parameters: [p("WorkspaceId")],
        response: jsonResponse("WorkspaceDashboard"),
      }),
    },
    "/v1/workspaces/{workspace_id}/settings": {
      get: operation({
        tag: "Workspace Settings",
        summary: "Get workspace settings",
        operationId: "getWorkspaceSettings",
        parameters: [p("WorkspaceId")],
        response: jsonResponse("WorkspaceSettings"),
      }),
      patch: operation({
        tag: "Workspace Settings",
        summary: "Update workspace settings",
        operationId: "updateWorkspaceSettings",
        parameters: [p("WorkspaceId")],
        requestBody: jsonBody("UpdateWorkspaceSettingsRequest"),
        response: jsonResponse("WorkspaceSettings"),
      }),
    },
    "/v1/workspaces/{workspace_id}/limits": {
      get: operation({
        tag: "Workspace Settings",
        summary: "Get workspace limits",
        operationId: "getWorkspaceLimits",
        parameters: [p("WorkspaceId")],
        response: jsonResponse("WorkspaceLimits"),
      }),
      patch: operation({
        tag: "Workspace Settings",
        summary: "Update workspace limits",
        operationId: "updateWorkspaceLimits",
        parameters: [p("WorkspaceId")],
        requestBody: jsonBody("UpdateWorkspaceLimitsRequest"),
        response: jsonResponse("WorkspaceLimits"),
      }),
    },
    "/v1/workspaces/{workspace_id}/members": {
      get: operation({
        tag: "Workspace Settings",
        summary: "List workspace members",
        operationId: "listWorkspaceMembers",
        parameters: [p("WorkspaceId"), p("Limit"), p("Cursor"), p("Search")],
        response: jsonResponse(listOf("WorkspaceMember")),
      }),
      post: operation({
        tag: "Workspace Settings",
        summary: "Invite workspace member",
        operationId: "inviteWorkspaceMember",
        parameters: [p("WorkspaceId")],
        requestBody: jsonBody("InviteWorkspaceMemberRequest"),
        response: jsonResponse("WorkspaceInvite", "Created"),
        status: "201",
      }),
    },
    "/v1/workspaces/{workspace_id}/members/{member_id}": {
      patch: operation({
        tag: "Workspace Settings",
        summary: "Update workspace member role",
        operationId: "updateWorkspaceMember",
        parameters: [p("WorkspaceId"), p("MemberId")],
        requestBody: jsonBody("UpdateWorkspaceMemberRequest"),
        response: jsonResponse("WorkspaceMember"),
      }),
      delete: operation({
        tag: "Workspace Settings",
        summary: "Remove workspace member",
        operationId: "removeWorkspaceMember",
        parameters: [p("WorkspaceId"), p("MemberId")],
        response: jsonResponse("DeletedObject"),
      }),
    },
    "/v1/workspaces/{workspace_id}/billing": {
      get: operation({
        tag: "Workspace Settings",
        summary: "Get billing overview",
        operationId: "getBillingOverview",
        parameters: [p("WorkspaceId")],
        response: jsonResponse("BillingOverview"),
      }),
    },

    "/v1/me": {
      get: operation({
        tag: "Account",
        summary: "Get current profile",
        operationId: "getCurrentProfile",
        response: jsonResponse("Profile"),
      }),
      patch: operation({
        tag: "Account",
        summary: "Update current profile",
        operationId: "updateCurrentProfile",
        requestBody: jsonBody("UpdateProfileRequest"),
        response: jsonResponse("Profile"),
      }),
    },
    "/v1/me/password": {
      put: operation({
        tag: "Account",
        summary: "Update password",
        operationId: "updatePassword",
        requestBody: jsonBody("UpdatePasswordRequest"),
        response: emptyResponse("Password updated."),
      }),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Astraflow API key",
        description: "Use a workspace API key in the Authorization header.",
      },
    },
    parameters: {
      Limit: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        description: "Maximum number of resources to return.",
      },
      Cursor: {
        name: "cursor",
        in: "query",
        schema: { type: "string" },
        description: "Pagination cursor from the previous response.",
      },
      Search: {
        name: "search",
        in: "query",
        schema: { type: "string", maxLength: 200 },
        description: "Case-insensitive search term.",
      },
      AgentStatus: {
        name: "status",
        in: "query",
        schema: { type: "string", enum: ["draft", "active", "archived"] },
      },
      EnvironmentStatus: {
        name: "status",
        in: "query",
        schema: { type: "string", enum: ["ready", "building", "error", "disabled"] },
      },
      SessionStatus: {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending", "queued", "running", "waiting_approval", "completed", "failed", "canceled", "expired"],
        },
      },
      FilePurpose: {
        name: "purpose",
        in: "query",
        schema: { type: "string", enum: ["general", "skill_attachment"] },
      },
      McpServerType: {
        name: "server_type",
        in: "query",
        schema: { type: "string", enum: ["streamable_http", "sse"] },
      },
      CredentialType: {
        name: "type",
        in: "query",
        schema: { type: "string", enum: ["env", "header"] },
      },
      DeploymentTrigger: {
        name: "trigger",
        in: "query",
        schema: { type: "string", enum: ["manual", "schedule", "webhook"] },
      },
      DeploymentEnabled: {
        name: "enabled",
        in: "query",
        schema: { type: "boolean" },
      },
      ModelProvider: {
        name: "provider",
        in: "query",
        schema: { type: "string", enum: ["modelverse"] },
      },
      ModelApi: {
        name: "api",
        in: "query",
        schema: { type: "string", enum: ["responses", "chat_completions", "messages"] },
      },
      IncludeVersions: {
        name: "include_versions",
        in: "query",
        schema: { type: "boolean", default: false },
      },
      IncludeEvents: {
        name: "include_events",
        in: "query",
        schema: { type: "boolean", default: true },
      },
      SinceEventId: {
        name: "since_event_id",
        in: "query",
        schema: { type: "string" },
      },
      LastEventId: {
        name: "last_event_id",
        in: "query",
        schema: { type: "string" },
      },
      UsageFrom: {
        name: "from",
        in: "query",
        required: true,
        schema: { type: "string", format: "date" },
      },
      UsageTo: {
        name: "to",
        in: "query",
        required: true,
        schema: { type: "string", format: "date" },
      },
      UsageInterval: {
        name: "interval",
        in: "query",
        schema: { type: "string", enum: ["hour", "day", "month"], default: "day" },
      },
      RequestLogProvider: {
        name: "provider",
        in: "query",
        schema: { type: "string", enum: ["modelverse", "runtime"] },
      },
      ModelOptional: {
        name: "model",
        in: "query",
        schema: { type: "string" },
      },
      AgentIdOptional: {
        name: "agent_id",
        in: "query",
        schema: { type: "string", pattern: "^agt_[a-f0-9]+$" },
      },
      SessionIdOptional: {
        name: "session_id",
        in: "query",
        schema: { type: "string", pattern: "^sess_[a-f0-9]+$" },
      },
      AgentId: {
        name: "agent_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^agt_[a-f0-9]+$" },
      },
      EnvironmentId: {
        name: "environment_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^env_[a-f0-9]+$" },
      },
      SessionId: {
        name: "session_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^sess_[a-f0-9]+$" },
      },
      FileId: {
        name: "file_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^file_[a-f0-9]+$" },
      },
      SkillId: {
        name: "skill_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^skl_[a-f0-9]+$" },
      },
      McpServerId: {
        name: "mcp_server_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^mcp_[a-f0-9]+$" },
      },
      MemoryStoreId: {
        name: "memory_store_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^mem_[a-f0-9]+$" },
      },
      CredentialId: {
        name: "credential_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^cred_[a-f0-9]+$" },
      },
      DeploymentId: {
        name: "deployment_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^dep_[a-f0-9]+$" },
      },
      DeploymentRunId: {
        name: "deployment_run_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^depr_[a-f0-9]+$" },
      },
      ApiKeyId: {
        name: "api_key_id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      VersionId: {
        name: "version_id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      RequestId: {
        name: "request_id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      WorkspaceId: {
        name: "workspace_id",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^ws_[a-f0-9]+$" },
      },
      MemberId: {
        name: "member_id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    },
    responses: {
      BadRequest: jsonResponse("Error", "Bad request."),
      Unauthorized: jsonResponse("Error", "Missing or invalid API key."),
      Forbidden: jsonResponse("Error", "The API key does not have access to this resource."),
      NotFound: jsonResponse("Error", "Resource not found."),
      ValidationError: jsonResponse("Error", "Request validation failed."),
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["type", "message"],
            properties: {
              type: { type: "string" },
              message: { type: "string" },
              code: nullable({ type: "string" }),
              param: nullable({ type: "string" }),
              request_id: nullable({ type: "string" }),
            },
          },
        },
      },
      DeletedObject: {
        type: "object",
        required: ["id", "object", "deleted"],
        properties: {
          id: { type: "string" },
          object: { type: "string" },
          deleted: { type: "boolean", const: true },
        },
      },
      ModelCatalogEntry: {
        type: "object",
        required: ["id", "provider", "api", "sdk", "display_name", "pricing"],
        properties: {
          id: { type: "string", examples: ["gpt-5.5", "claude-sonnet-4-6", "deepseek-v4-pro"] },
          display_name: { type: "string" },
          provider: { type: "string", enum: ["modelverse"] },
          api: { type: "string", enum: ["responses", "chat_completions", "messages"] },
          sdk: { type: "string", enum: ["openai_agents", "claude_agent_sdk"] },
          context_window_tokens: nullable({ type: "integer", minimum: 1 }),
          max_output_tokens: nullable({ type: "integer", minimum: 1 }),
          pricing: ref("ModelPricing"),
          metadata,
        },
      },
      ModelPricing: {
        type: "object",
        required: ["currency", "input_per_million", "output_per_million"],
        properties: {
          currency: { type: "string", default: "USD" },
          input_per_million: { type: "number", minimum: 0 },
          output_per_million: { type: "number", minimum: 0 },
          cached_input_per_million: nullable({ type: "number", minimum: 0 }),
          reasoning_per_million: nullable({ type: "number", minimum: 0 }),
          cache_create_5m_per_million: nullable({ type: "number", minimum: 0 }),
          cache_create_1h_per_million: nullable({ type: "number", minimum: 0 }),
        },
      },
      AgentModel: {
        type: "object",
        required: ["id", "provider", "api", "sdk", "speed", "reasoning"],
        properties: {
          id: { type: "string", maxLength: 160 },
          provider: { type: "string", enum: ["modelverse"] },
          api: { type: "string", enum: ["responses", "chat_completions", "messages"] },
          sdk: { type: "string", enum: ["openai_agents", "claude_agent_sdk"] },
          speed: { type: "string", enum: ["standard", "fast"], default: "standard" },
          reasoning: { type: "boolean", default: true },
        },
      },
      RuntimeConfig: {
        type: "object",
        properties: {
          max_steps: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        },
        additionalProperties: false,
      },
      PermissionPolicy: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["always_allow", "always_ask"] },
        },
      },
      ToolConfig: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", maxLength: 160, examples: ["agent_toolset_20260601", "mcp_toolset", "custom"] },
          name: { type: "string", maxLength: 128 },
          enabled: { type: "boolean", default: true },
          permission_policy: nullable(ref("PermissionPolicy")),
          input_schema: { type: "object", additionalProperties: true },
          description: { type: "string", maxLength: 1024 },
          configs: { type: "array", items: { type: "object", additionalProperties: true } },
          default_config: { type: "object", additionalProperties: true },
        },
        additionalProperties: true,
      },
      CredentialReference: {
        type: "object",
        required: ["$credential"],
        properties: {
          $credential: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" },
          prefix: { type: "string", maxLength: 64 },
        },
      },
      McpHeaderValue: {
        oneOf: [{ type: "string", maxLength: 4096 }, ref("CredentialReference")],
      },
      AgentMcpServerConfig: {
        oneOf: [
          {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", pattern: "^mcp_[a-f0-9]+$" },
            },
          },
          {
            type: "object",
            required: ["name", "type", "url"],
            properties: {
              name: { type: "string", minLength: 1, maxLength: 80 },
              type: { type: "string", maxLength: 80 },
              url: { type: "string", format: "uri", maxLength: 2048 },
              headers: {
                type: "object",
                additionalProperties: ref("McpHeaderValue"),
              },
            },
            additionalProperties: true,
          },
        ],
      },
      AgentSkillReference: {
        type: "object",
        required: ["skill_id"],
        properties: {
          skill_id: { type: "string", pattern: "^skl_[a-f0-9]+$" },
          slug: { type: "string", minLength: 1, maxLength: 64 },
          version: nullable({ type: "integer", minimum: 1 }),
        },
      },
      AgentVersion: {
        type: "object",
        required: ["id", "version", "agent_id", "model", "runtime_config", "created_at"],
        properties: {
          id: { type: "string" },
          object: { type: "string", const: "agent_version" },
          version: { type: "integer", minimum: 1 },
          agent_id: { type: "string", pattern: "^agt_[a-f0-9]+$" },
          model: ref("AgentModel"),
          runtime_config: ref("RuntimeConfig"),
          system_prompt: nullable({ type: "string" }),
          tools: { type: "array", maxItems: 128, items: ref("ToolConfig") },
          mcp_servers: { type: "array", maxItems: 20, items: ref("AgentMcpServerConfig") },
          skills: { type: "array", maxItems: 20, items: ref("AgentSkillReference") },
          metadata,
          created_at: timestamp,
          created_by: nullable({ type: "string" }),
        },
      },
      Agent: {
        type: "object",
        required: ["id", "object", "name", "status", "model", "runtime_config", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^agt_[a-f0-9]+$" },
          object: { type: "string", const: "agent" },
          name: { type: "string", minLength: 1, maxLength: 256 },
          description: nullable({ type: "string", maxLength: 1000 }),
          status: { type: "string", enum: ["draft", "active", "archived"] },
          model: ref("AgentModel"),
          runtime_config: ref("RuntimeConfig"),
          system_prompt: nullable({ type: "string", maxLength: 100000 }),
          tools: { type: "array", maxItems: 128, items: ref("ToolConfig") },
          mcp_servers: { type: "array", maxItems: 20, items: ref("AgentMcpServerConfig") },
          skills: { type: "array", maxItems: 20, items: ref("AgentSkillReference") },
          active_version: nullable(ref("AgentVersion")),
          versions: { type: "array", items: ref("AgentVersion") },
          metadata,
          created_at: timestamp,
          updated_at: timestamp,
          archived_at: nullable(timestamp),
        },
      },
      CreateAgentRequest: {
        type: "object",
        required: ["name", "model"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 256 },
          description: nullable({ type: "string", maxLength: 1000 }),
          model: ref("AgentModel"),
          system_prompt: nullable({ type: "string", maxLength: 100000 }),
          runtime_config: ref("RuntimeConfig"),
          max_steps: { type: "integer", minimum: 1, maximum: 200, deprecated: true },
          tools: { type: "array", maxItems: 128, default: [{ type: "agent_toolset_20260601" }], items: ref("ToolConfig") },
          mcp_servers: { type: "array", maxItems: 20, items: ref("AgentMcpServerConfig") },
          skills: { type: "array", maxItems: 20, items: ref("AgentSkillReference") },
          metadata,
        },
      },
      UpdateAgentRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 256 },
          description: nullable({ type: "string", maxLength: 1000 }),
          model: ref("AgentModel"),
          system_prompt: nullable({ type: "string", maxLength: 100000 }),
          runtime_config: ref("RuntimeConfig"),
          tools: { type: "array", maxItems: 128, items: ref("ToolConfig") },
          mcp_servers: { type: "array", maxItems: 20, items: ref("AgentMcpServerConfig") },
          skills: { type: "array", maxItems: 20, items: ref("AgentSkillReference") },
          metadata,
          status: { type: "string", enum: ["draft", "active", "archived"] },
        },
      },
      GenerateAgentYamlRequest: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: { type: "string", minLength: 1, maxLength: 4000 },
        },
      },
      GenerateAgentYamlResponse: {
        type: "object",
        required: ["yaml"],
        properties: {
          yaml: { type: "string" },
        },
      },
      EnvironmentNetwork: {
        oneOf: [
          {
            type: "object",
            required: ["type"],
            properties: {
              type: { type: "string", const: "unrestricted" },
            },
          },
          {
            type: "object",
            required: ["type"],
            properties: {
              type: { type: "string", const: "limited" },
              allowed_hosts: { type: "array", maxItems: 100, items: { type: "string", maxLength: 255 } },
              allow_mcp_servers: { type: "boolean", default: false },
              allow_package_managers: { type: "boolean", default: false },
            },
          },
        ],
      },
      EnvironmentPackages: {
        type: "object",
        properties: {
          type: { type: "string", const: "packages" },
          apt: { type: "array", maxItems: 100, items: { type: "string", maxLength: 160 } },
          cargo: { type: "array", maxItems: 100, items: { type: "string", maxLength: 160 } },
          gem: { type: "array", maxItems: 100, items: { type: "string", maxLength: 160 } },
          go: { type: "array", maxItems: 100, items: { type: "string", maxLength: 160 } },
          npm: { type: "array", maxItems: 100, items: { type: "string", maxLength: 160 } },
          pip: { type: "array", maxItems: 100, items: { type: "string", maxLength: 160 } },
        },
      },
      EnvironmentSecret: {
        type: "object",
        required: ["env", "credential"],
        properties: {
          env: { type: "string", pattern: "^[A-Z][A-Z0-9_]{0,63}$" },
          credential: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" },
        },
      },
      EnvironmentConfig: {
        type: "object",
        required: ["type", "networking", "packages", "secrets"],
        properties: {
          type: { type: "string", const: "cloud" },
          networking: ref("EnvironmentNetwork"),
          packages: ref("EnvironmentPackages"),
          secrets: { type: "array", maxItems: 32, items: ref("EnvironmentSecret") },
        },
      },
      Environment: {
        type: "object",
        required: ["id", "object", "name", "status", "config", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^env_[a-f0-9]+$" },
          object: { type: "string", const: "environment" },
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: nullable({ type: "string", maxLength: 1000 }),
          status: { type: "string", enum: ["ready", "building", "error", "disabled"] },
          config: ref("EnvironmentConfig"),
          mcp_server_ids: { type: "array", items: { type: "string", pattern: "^mcp_[a-f0-9]+$" } },
          metadata,
          created_at: timestamp,
          updated_at: timestamp,
          last_build_error: nullable({ type: "string" }),
        },
      },
      CreateEnvironmentRequest: {
        type: "object",
        required: ["name", "config"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: nullable({ type: "string", maxLength: 1000 }),
          config: ref("EnvironmentConfig"),
          metadata,
        },
      },
      UpdateEnvironmentRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: nullable({ type: "string", maxLength: 1000 }),
          config: ref("EnvironmentConfig"),
          metadata,
        },
      },
      CloneEnvironmentRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: nullable({ type: "string", maxLength: 1000 }),
        },
      },
      ReplaceEnvironmentMcpServersRequest: {
        type: "object",
        required: ["mcp_server_ids"],
        properties: {
          mcp_server_ids: { type: "array", maxItems: 50, items: { type: "string", pattern: "^mcp_[a-f0-9]+$" } },
        },
      },
      EnvironmentMcpServers: {
        type: "object",
        required: ["environment_id", "mcp_server_ids"],
        properties: {
          environment_id: { type: "string", pattern: "^env_[a-f0-9]+$" },
          mcp_server_ids: { type: "array", items: { type: "string", pattern: "^mcp_[a-f0-9]+$" } },
        },
      },
      SessionApprovalMode: {
        type: "string",
        enum: ["default", "strict", "auto_sandbox"],
        description: "`auto_sandbox` only applies to sandbox-local tools, not external MCP tools or credentialed services.",
      },
      SessionResource: {
        oneOf: [
          {
            type: "object",
            required: ["type", "file_id"],
            properties: {
              type: { type: "string", const: "file" },
              file_id: { type: "string", pattern: "^file_[a-f0-9]+$" },
            },
          },
          {
            type: "object",
            required: ["type", "memory_store_id"],
            properties: {
              type: { type: "string", const: "memory_store" },
              memory_store_id: { type: "string", pattern: "^mem_[a-f0-9]+$" },
            },
          },
        ],
      },
      SessionUsage: {
        type: "object",
        properties: {
          input: { type: "integer", minimum: 0 },
          output: { type: "integer", minimum: 0 },
          reasoning: { type: "integer", minimum: 0 },
          cached_input: { type: "integer", minimum: 0 },
          cache_create_5m: { type: "integer", minimum: 0 },
          cache_create_1h: { type: "integer", minimum: 0 },
        },
      },
      Session: {
        type: "object",
        required: ["id", "object", "status", "agent_id", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^sess_[a-f0-9]+$" },
          object: { type: "string", const: "session" },
          title: nullable({ type: "string", maxLength: 160 }),
          status: { type: "string", enum: ["pending", "queued", "running", "waiting_approval", "completed", "failed", "canceled", "expired"] },
          approval_mode: ref("SessionApprovalMode"),
          agent_id: { type: "string", pattern: "^agt_[a-f0-9]+$" },
          environment_id: nullable({ type: "string", pattern: "^env_[a-f0-9]+$" }),
          resources: { type: "array", items: ref("SessionResource") },
          usage: ref("SessionUsage"),
          events: { type: "array", items: ref("SessionEvent") },
          error: nullable({ type: "string" }),
          created_at: timestamp,
          updated_at: timestamp,
          completed_at: nullable(timestamp),
        },
      },
      CreateSessionRequest: {
        type: "object",
        required: ["agent_id", "prompt"],
        properties: {
          agent_id: { type: "string", pattern: "^agt_[a-f0-9]+$" },
          environment_id: nullable({ type: "string", pattern: "^env_[a-f0-9]+$" }),
          approval_mode: ref("SessionApprovalMode"),
          title: nullable({ type: "string", maxLength: 160 }),
          prompt: { type: "string", minLength: 1, maxLength: 32000 },
          file_ids: { type: "array", maxItems: 20, items: { type: "string", pattern: "^file_[a-f0-9]+$" } },
        },
      },
      SendSessionMessageRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, maxLength: 32000 },
        },
      },
      SessionMessageAccepted: {
        type: "object",
        required: ["session_id", "accepted"],
        properties: {
          session_id: { type: "string", pattern: "^sess_[a-f0-9]+$" },
          accepted: { type: "boolean", const: true },
        },
      },
      SessionApprovalRequest: {
        type: "object",
        required: ["tool_call_id", "decision"],
        properties: {
          tool_call_id: { type: "string", minLength: 1 },
          decision: { type: "string", enum: ["approve", "reject"] },
          reason: nullable({ type: "string", maxLength: 1000 }),
        },
      },
      SessionApproval: {
        type: "object",
        required: ["session_id", "tool_call_id", "decision"],
        properties: {
          session_id: { type: "string", pattern: "^sess_[a-f0-9]+$" },
          tool_call_id: { type: "string" },
          decision: { type: "string", enum: ["approve", "reject"] },
          created_at: timestamp,
        },
      },
      SessionEvent: {
        type: "object",
        required: ["id", "session_id", "type", "created_at"],
        properties: {
          id: { type: "string" },
          session_id: { type: "string", pattern: "^sess_[a-f0-9]+$" },
          type: {
            type: "string",
            examples: ["user.message", "agent.message", "tool.start", "tool.result", "session.status"],
          },
          sequence: { type: "integer", minimum: 0 },
          role: nullable({ type: "string", enum: ["user", "assistant", "system", "tool"] }),
          content: nullable({ type: "string" }),
          tool_call_id: nullable({ type: "string" }),
          tool_name: nullable({ type: "string" }),
          payload: { type: "object", additionalProperties: true },
          created_at: timestamp,
        },
      },
      UploadFileRequest: {
        type: "object",
        required: ["file"],
        properties: {
          file: { type: "string", format: "binary" },
          purpose: { type: "string", enum: ["general", "skill_attachment"], default: "general" },
        },
      },
      FileResource: {
        type: "object",
        required: ["id", "object", "filename", "purpose", "size_bytes", "created_at"],
        properties: {
          id: { type: "string", pattern: "^file_[a-f0-9]+$" },
          object: { type: "string", const: "file" },
          filename: { type: "string", maxLength: 512 },
          purpose: { type: "string", enum: ["general", "skill_attachment"] },
          mime_type: nullable({ type: "string" }),
          size_bytes: { type: "integer", minimum: 0, maximum: 52428800 },
          checksum_sha256: nullable({ type: "string" }),
          created_at: timestamp,
          expires_at: nullable(timestamp),
        },
      },
      SkillAttachment: {
        type: "object",
        required: ["file_id", "name", "size_bytes"],
        properties: {
          file_id: { type: "string", pattern: "^file_[a-f0-9]+$" },
          name: { type: "string", minLength: 1, maxLength: 512 },
          mime_type: nullable({ type: "string" }),
          size_bytes: { type: "integer", minimum: 0 },
        },
      },
      SkillVersion: {
        type: "object",
        required: ["id", "version", "instructions", "created_at"],
        properties: {
          id: { type: "string" },
          version: { type: "integer", minimum: 1 },
          instructions: { type: "string", maxLength: 100000 },
          attachments: { type: "array", items: ref("SkillAttachment") },
          created_at: timestamp,
        },
      },
      Skill: {
        type: "object",
        required: ["id", "object", "slug", "name", "description", "current_version_id", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^skl_[a-f0-9]+$" },
          object: { type: "string", const: "skill" },
          slug: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" },
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: { type: "string", minLength: 1, maxLength: 1024 },
          current_version_id: { type: "string" },
          current_version: nullable(ref("SkillVersion")),
          versions: { type: "array", items: ref("SkillVersion") },
          created_at: timestamp,
          updated_at: timestamp,
        },
      },
      CreateSkillRequest: {
        type: "object",
        required: ["slug", "name", "description", "instructions"],
        properties: {
          slug: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" },
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: { type: "string", minLength: 1, maxLength: 1024 },
          instructions: { type: "string", minLength: 1, maxLength: 100000 },
          attachments: { type: "array", items: ref("SkillAttachment") },
        },
      },
      UpdateSkillRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: { type: "string", minLength: 1, maxLength: 1024 },
          instructions: { type: "string", minLength: 1, maxLength: 100000 },
          attachments: { type: "array", items: ref("SkillAttachment") },
        },
      },
      McpServer: {
        type: "object",
        required: ["id", "object", "name", "server_type", "url", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^mcp_[a-f0-9]+$" },
          object: { type: "string", const: "mcp_server" },
          name: { type: "string", minLength: 1, maxLength: 120 },
          description: nullable({ type: "string", maxLength: 1000 }),
          server_type: { type: "string", enum: ["streamable_http", "sse"] },
          url: { type: "string", format: "uri", maxLength: 2048 },
          created_at: timestamp,
          updated_at: timestamp,
        },
      },
      CreateMcpServerRequest: {
        type: "object",
        required: ["name", "url"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          description: nullable({ type: "string", maxLength: 1000 }),
          server_type: { type: "string", enum: ["streamable_http", "sse"], default: "streamable_http" },
          url: { type: "string", format: "uri", maxLength: 2048 },
        },
      },
      UpdateMcpServerRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          description: nullable({ type: "string", maxLength: 1000 }),
          server_type: { type: "string", enum: ["streamable_http", "sse"] },
          url: { type: "string", format: "uri", maxLength: 2048 },
        },
      },
      MemoryStore: {
        type: "object",
        required: ["id", "object", "name", "embedding_model", "document_count", "chunk_count", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^mem_[a-f0-9]+$" },
          object: { type: "string", const: "memory_store" },
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: nullable({ type: "string", maxLength: 1000 }),
          embedding_model: { type: "string", minLength: 1, maxLength: 160, default: "text-embedding-3-large" },
          document_count: { type: "integer", minimum: 0 },
          chunk_count: { type: "integer", minimum: 0 },
          created_at: timestamp,
          updated_at: timestamp,
        },
      },
      CreateMemoryStoreRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          description: nullable({ type: "string", maxLength: 1000 }),
          embedding_model: { type: "string", minLength: 1, maxLength: 160, default: "text-embedding-3-large" },
        },
      },
      IngestMemoryDocumentRequest: {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 512 },
          content: { type: "string", minLength: 1, maxLength: 200000 },
          metadata,
        },
      },
      MemoryDocument: {
        type: "object",
        required: ["id", "object", "memory_store_id", "title", "status", "created_at"],
        properties: {
          id: { type: "string" },
          object: { type: "string", const: "memory_document" },
          memory_store_id: { type: "string", pattern: "^mem_[a-f0-9]+$" },
          title: { type: "string" },
          status: { type: "string", enum: ["queued", "ingesting", "ready", "error"] },
          chunk_count: { type: "integer", minimum: 0 },
          created_at: timestamp,
        },
      },
      SearchMemoryStoreRequest: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", minLength: 1, maxLength: 4000 },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          min_score: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      SearchMemoryStoreResponse: {
        type: "object",
        required: ["object", "data"],
        properties: {
          object: { type: "string", const: "search_results" },
          data: { type: "array", items: ref("MemorySearchResult") },
        },
      },
      MemorySearchResult: {
        type: "object",
        required: ["document_id", "chunk_id", "content", "score"],
        properties: {
          document_id: { type: "string" },
          chunk_id: { type: "string" },
          title: nullable({ type: "string" }),
          content: { type: "string" },
          score: { type: "number", minimum: 0, maximum: 1 },
          metadata,
        },
      },
      Credential: {
        type: "object",
        required: ["id", "object", "name", "type", "last4", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^cred_[a-f0-9]+$" },
          object: { type: "string", const: "credential" },
          name: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" },
          type: { type: "string", enum: ["env", "header"] },
          last4: { type: "string", maxLength: 4 },
          created_at: timestamp,
          updated_at: timestamp,
        },
      },
      CreateCredentialRequest: {
        type: "object",
        required: ["name", "value"],
        properties: {
          name: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" },
          type: { type: "string", enum: ["env", "header"], default: "env" },
          value: { type: "string", minLength: 1, maxLength: 16384, format: "password" },
        },
      },
      RotateCredentialRequest: {
        type: "object",
        required: ["value"],
        properties: {
          value: { type: "string", minLength: 1, maxLength: 16384, format: "password" },
        },
      },
      Deployment: {
        type: "object",
        required: ["id", "object", "name", "trigger", "agent_id", "initial_message", "enabled", "created_at", "updated_at"],
        properties: {
          id: { type: "string", pattern: "^dep_[a-f0-9]+$" },
          object: { type: "string", const: "deployment" },
          name: { type: "string", minLength: 1, maxLength: 160 },
          trigger: { type: "string", enum: ["manual", "schedule", "webhook"] },
          schedule: nullable({ type: "string", maxLength: 120, description: "UTC cron expression for scheduled deployments." }),
          agent_id: { type: "string", pattern: "^agt_[a-f0-9]+$" },
          environment_id: nullable({ type: "string", pattern: "^env_[a-f0-9]+$" }),
          approval_mode: ref("SessionApprovalMode"),
          initial_message: { type: "string", minLength: 1, maxLength: 32000 },
          credential_refs: { type: "array", maxItems: 32, items: { type: "string", pattern: "^cred_[a-f0-9]+$" } },
          memory_store_refs: { type: "array", maxItems: 32, items: { type: "string", pattern: "^mem_[a-f0-9]+$" } },
          enabled: { type: "boolean" },
          metadata,
          created_at: timestamp,
          updated_at: timestamp,
        },
      },
      CreateDeploymentRequest: {
        type: "object",
        required: ["name", "agent_id", "initial_message"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          agent_id: { type: "string", pattern: "^agt_[a-f0-9]+$" },
          environment_id: nullable({ type: "string", pattern: "^env_[a-f0-9]+$" }),
          trigger: { type: "string", enum: ["manual", "schedule", "webhook"], default: "manual" },
          schedule: nullable({ type: "string", maxLength: 120 }),
          approval_mode: ref("SessionApprovalMode"),
          initial_message: { type: "string", minLength: 1, maxLength: 32000 },
          credential_refs: { type: "array", maxItems: 32, items: { type: "string", pattern: "^cred_[a-f0-9]+$" } },
          memory_store_refs: { type: "array", maxItems: 32, items: { type: "string", pattern: "^mem_[a-f0-9]+$" } },
          metadata,
        },
      },
      UpdateDeploymentRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          trigger: { type: "string", enum: ["manual", "schedule", "webhook"] },
          schedule: nullable({ type: "string", maxLength: 120 }),
          approval_mode: ref("SessionApprovalMode"),
          initial_message: { type: "string", minLength: 1, maxLength: 32000 },
          enabled: { type: "boolean" },
          credential_refs: { type: "array", maxItems: 32, items: { type: "string", pattern: "^cred_[a-f0-9]+$" } },
          memory_store_refs: { type: "array", maxItems: 32, items: { type: "string", pattern: "^mem_[a-f0-9]+$" } },
          metadata,
        },
      },
      RunDeploymentRequest: {
        type: "object",
        properties: {
          initial_message: { type: "string", minLength: 1, maxLength: 32000 },
          idempotency_key: { type: "string", maxLength: 200 },
        },
      },
      DeploymentRun: {
        type: "object",
        required: ["id", "object", "deployment_id", "status", "created_at"],
        properties: {
          id: { type: "string", pattern: "^depr_[a-f0-9]+$" },
          object: { type: "string", const: "deployment_run" },
          deployment_id: { type: "string", pattern: "^dep_[a-f0-9]+$" },
          session_id: nullable({ type: "string", pattern: "^sess_[a-f0-9]+$" }),
          status: { type: "string", enum: ["queued", "running", "completed", "failed", "canceled"] },
          created_at: timestamp,
          started_at: nullable(timestamp),
          completed_at: nullable(timestamp),
        },
      },
      ApiKey: {
        type: "object",
        required: ["id", "object", "name", "prefix", "created_at"],
        properties: {
          id: { type: "string" },
          object: { type: "string", const: "api_key" },
          name: { type: "string", minLength: 1, maxLength: 120 },
          prefix: { type: "string" },
          expires_at: nullable(timestamp),
          revoked_at: nullable(timestamp),
          last_used_at: nullable(timestamp),
          created_at: timestamp,
        },
      },
      CreateApiKeyRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          expires_in_days: { type: "string", enum: ["never", "30", "90", "365"], default: "never" },
        },
      },
      CreateApiKeyResponse: {
        type: "object",
        required: ["api_key", "secret"],
        properties: {
          api_key: ref("ApiKey"),
          secret: { type: "string", format: "password", description: "Full secret is returned only once." },
        },
      },
      UsageSummary: {
        type: "object",
        required: ["from", "to", "currency", "totals", "buckets"],
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
          currency: { type: "string", default: "USD" },
          totals: ref("UsageTotals"),
          buckets: { type: "array", items: ref("UsageBucket") },
        },
      },
      UsageTotals: {
        type: "object",
        properties: {
          input_tokens: { type: "integer", minimum: 0 },
          output_tokens: { type: "integer", minimum: 0 },
          reasoning_tokens: { type: "integer", minimum: 0 },
          cached_input_tokens: { type: "integer", minimum: 0 },
          cache_create_5m_tokens: { type: "integer", minimum: 0 },
          cache_create_1h_tokens: { type: "integer", minimum: 0 },
          cost: { type: "number", minimum: 0 },
        },
      },
      UsageBucket: {
        type: "object",
        required: ["start", "end", "totals"],
        properties: {
          start: timestamp,
          end: timestamp,
          model: nullable({ type: "string" }),
          provider: nullable({ type: "string" }),
          totals: ref("UsageTotals"),
        },
      },
      RequestLog: {
        type: "object",
        required: ["id", "object", "provider", "model", "status", "created_at"],
        properties: {
          id: { type: "string" },
          object: { type: "string", const: "request_log" },
          provider: { type: "string" },
          sdk: nullable({ type: "string" }),
          model: { type: "string" },
          status: { type: "string", enum: ["success", "error"] },
          agent_id: nullable({ type: "string", pattern: "^agt_[a-f0-9]+$" }),
          session_id: nullable({ type: "string", pattern: "^sess_[a-f0-9]+$" }),
          request: { type: "object", additionalProperties: true },
          response: { type: "object", additionalProperties: true },
          usage: ref("SessionUsage"),
          error: nullable({ type: "string" }),
          created_at: timestamp,
        },
      },
      WorkspaceDashboard: {
        type: "object",
        required: ["workspace", "counts", "usage"],
        properties: {
          workspace: ref("WorkspaceSettings"),
          counts: {
            type: "object",
            properties: {
              agents: { type: "integer", minimum: 0 },
              sessions: { type: "integer", minimum: 0 },
              environments: { type: "integer", minimum: 0 },
              deployments: { type: "integer", minimum: 0 },
            },
          },
          usage: ref("UsageTotals"),
        },
      },
      WorkspaceSettings: {
        type: "object",
        required: ["id", "object", "slug", "name", "created_at"],
        properties: {
          id: { type: "string", pattern: "^ws_[a-f0-9]+$" },
          object: { type: "string", const: "workspace" },
          slug: { type: "string" },
          name: { type: "string", minLength: 1, maxLength: 160 },
          default_locale: nullable({ type: "string" }),
          created_at: timestamp,
          updated_at: timestamp,
        },
      },
      UpdateWorkspaceSettingsRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 160 },
          default_locale: nullable({ type: "string" }),
        },
      },
      WorkspaceLimits: {
        type: "object",
        required: ["workspace_id"],
        properties: {
          workspace_id: { type: "string", pattern: "^ws_[a-f0-9]+$" },
          monthly_budget_usd: nullable({ type: "number", minimum: 0 }),
          max_parallel_sessions: { type: "integer", minimum: 1 },
          max_runtime_minutes_per_session: { type: "integer", minimum: 1 },
          max_upload_bytes: { type: "integer", minimum: 0 },
        },
      },
      UpdateWorkspaceLimitsRequest: {
        type: "object",
        properties: {
          monthly_budget_usd: nullable({ type: "number", minimum: 0 }),
          max_parallel_sessions: { type: "integer", minimum: 1 },
          max_runtime_minutes_per_session: { type: "integer", minimum: 1 },
        },
      },
      WorkspaceMember: {
        type: "object",
        required: ["id", "object", "email", "role", "status", "created_at"],
        properties: {
          id: { type: "string" },
          object: { type: "string", const: "workspace_member" },
          email: { type: "string", format: "email" },
          display_name: nullable({ type: "string" }),
          role: { type: "string", enum: ["owner", "admin", "developer", "viewer"] },
          status: { type: "string", enum: ["active", "invited"] },
          created_at: timestamp,
        },
      },
      InviteWorkspaceMemberRequest: {
        type: "object",
        required: ["email", "role"],
        properties: {
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["admin", "developer", "viewer"] },
        },
      },
      UpdateWorkspaceMemberRequest: {
        type: "object",
        required: ["role"],
        properties: {
          role: { type: "string", enum: ["admin", "developer", "viewer"] },
        },
      },
      WorkspaceInvite: {
        type: "object",
        required: ["id", "email", "role", "expires_at"],
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["admin", "developer", "viewer"] },
          expires_at: timestamp,
        },
      },
      BillingOverview: {
        type: "object",
        properties: {
          plan: { type: "string" },
          current_period_start: timestamp,
          current_period_end: timestamp,
          usage: ref("UsageTotals"),
          limits: ref("WorkspaceLimits"),
        },
      },
      Profile: {
        type: "object",
        required: ["id", "email"],
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          display_name: nullable({ type: "string", maxLength: 120 }),
        },
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          display_name: nullable({ type: "string", maxLength: 120 }),
        },
      },
      UpdatePasswordRequest: {
        type: "object",
        required: ["current_password", "new_password"],
        properties: {
          current_password: { type: "string", minLength: 8, maxLength: 1024, format: "password" },
          new_password: { type: "string", minLength: 8, maxLength: 1024, format: "password" },
        },
      },
    },
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
console.log(`wrote ${outputPath}`);
