# Implementation Blueprint

## Purpose

This document captured the initial implementation shape for `vikunja-mcp-http` before runtime scaffolding began.

The runtime now exists and follows this blueprint closely, so this file is both a design record and a reference point for future changes.

Important scope note:

- this file documents the original baseline implementation shape
- the current repo has since expanded beyond the original v1 tool surface into a broader core work-management API
- for the current live tool inventory and validation state, prefer `README.md`, `docs/architecture.md`, and `docs/local-testing.md`

The original goal was to make Phase 3 low-risk:

- package manager setup should be minimal and unsurprising
- runtime file structure should already be decided
- the v1 tool surface should map to actual Vikunja API operations
- the deployment shape should stay aligned with TrueNAS from the start

## Implemented direction

### Runtime

Implemented direction:

- Node.js + TypeScript
- official MCP TypeScript SDK
- Express as the HTTP shell
- Streamable HTTP transport on `/mcp`
- single-process, stateless service

### Why this direction

- The MCP TypeScript SDK recommends Streamable HTTP for remote servers.
- The same SDK documents stateless Streamable HTTP as a good fit for simple API-style servers.
- Express keeps the health route, auth middleware, and deployment story straightforward.
- A stateless service is the best fit for LAN deployment and easy redeploys on TrueNAS.

### Options considered

`Streamable HTTP` vs deprecated `HTTP+SSE`

- choose Streamable HTTP
- reason:
  - it is the current MCP direction for remote servers
  - it avoids building around a transport already marked deprecated

`stateless` vs `stateful` MCP sessions

- choose stateless for v1
- reason:
  - this bridge is primarily a thin request/response layer over Vikunja
  - resumable sessions and server-held session state add complexity without helping the first milestone

`Express` vs lower-level or newer HTTP shells

- choose Express
- reason:
  - the routing and middleware model is enough for `/healthz`, `/mcp`, and bearer auth
  - the MCP SDK docs already show Express-oriented integration patterns
  - native `http` would be smaller but more manual, while a newer framework would not buy enough for v1

### Explicit v1 non-choices

The first implementation deliberately did not add:

- a database
- a cache
- background workers
- queues
- session persistence
- deprecated HTTP+SSE compatibility endpoints
- OAuth or public internet exposure

## Runtime structure

The current runtime uses this structure:

- `src/server.ts`
  - process entrypoint
  - load config
  - create the Express app
  - register `/healthz`
  - register `/mcp`
  - start listening on `PORT`
- `src/config.ts`
  - parse and validate environment variables
  - normalize `VIKUNJA_URL`
  - expose a typed config object
- `src/auth.ts`
  - inbound bearer token validation for MCP requests
  - return `401` on missing or invalid bearer token
- `src/health.ts`
  - health handler for `/healthz`
  - report process status, config status, and Vikunja reachability
- `src/mcp.ts`
  - create the MCP server
  - register tools
  - adapt the official Streamable HTTP transport to the Express route
- `src/vikunja-client.ts`
  - thin wrapper around the Vikunja REST API
  - build URLs
  - attach outbound auth
  - parse JSON responses
  - normalize upstream errors
- `src/tools/projects.ts`
  - register `projects_list`
- `src/tools/tasks.ts`
  - register `tasks_list`, `task_get`, `task_create`, `task_update`
- `src/tools/labels.ts`
  - register `labels_list`, `task_add_label`
- `src/tools/views.ts`
  - register `views_list`
- `src/tools/buckets.ts`
  - register `buckets_list`

Do not add extra folders in the first scaffold unless one of the files above becomes obviously overloaded.

## HTTP surface

### `GET /healthz`

Behavior:

- no bearer auth required
- returns JSON
- `200` when the service is up, config is valid, and Vikunja is reachable with the configured token
- `503` when the process is up but Vikunja is unreachable or auth to Vikunja fails
- use a lightweight authenticated Vikunja probe, `GET /api/v1/projects?page=1&per_page=1`, so the health result reflects both reachability and token validity

Current response shape:

```json
{
  "ok": true,
  "service": "vikunja-mcp-http",
  "config_loaded": true,
  "vikunja_reachable": true,
  "message": "Vikunja reachable"
}
```

When Vikunja returns an HTTP status, the handler may also include `vikunja_status_code`.

This endpoint must not leak secrets, raw tokens, or verbose upstream error dumps.

### `/mcp`

Behavior:

- route all MCP traffic through `/mcp`
- protect the route with inbound bearer auth using `MCP_BEARER_TOKEN`
- use the official Streamable HTTP transport
- run in stateless mode for v1
- do not expose separate `/sse` or `/message` compatibility routes

Current route wiring:

- `POST /mcp` is the active MCP entrypoint
- `GET /mcp` and `DELETE /mcp` return `405`
- the MCP transport owns the protocol-level details
- auth enforcement stays outside the tool handlers

## Configuration model

### Required environment variables

- `PORT`
  - integer TCP port for the bridge
- `MCP_BEARER_TOKEN`
  - inbound bearer token expected on MCP requests
- `VIKUNJA_URL`
  - base URL of the Vikunja instance, without assuming `/api/v1` is already included
- `VIKUNJA_API_TOKEN`
  - outbound Vikunja API token used by the bridge

### Optional environment variables

- `VERIFY_SSL`
  - boolean
  - default: `true`
  - allows local installations with self-signed certs when explicitly disabled

### Normalization rules

- trim whitespace around string values
- normalize `VIKUNJA_URL` to avoid double slashes when building `/api/v1/...` routes
- fail fast during startup if any required variable is missing or malformed

## Auth boundaries

Two secrets are required and must remain separate:

- inbound bridge auth: `MCP_BEARER_TOKEN`
- outbound Vikunja auth: `VIKUNJA_API_TOKEN`

Rules:

- `/mcp` requires `Authorization: Bearer <MCP_BEARER_TOKEN>`
- `/healthz` does not require bridge auth
- outbound Vikunja requests use `Authorization: Bearer <VIKUNJA_API_TOKEN>`
- the bridge must never return the configured token values in logs or responses

## Vikunja API mapping

This bridge should stay thin and map closely to the documented REST API.

Design rule:

- public MCP tools should use stable, bridge-friendly names
- internal client methods should use exact Vikunja endpoint semantics
- when Vikunja path parameter names vary between endpoints, the bridge should normalize them to `project_id`, `view_id`, `task_id`, `label_id`, and `bucket_id` in its own tool inputs

### List and read operations

`projects_list`

- Vikunja endpoint: `GET /api/v1/projects`
- supported tool inputs:
  - `page`
  - `per_page`
  - `search`
- response shape:
  - `items`
  - `pagination`

`views_list`

- Vikunja endpoint: `GET /api/v1/projects/{project}/views`
- required tool input:
  - `project_id`
- response shape:
  - `items`

`buckets_list`

- Vikunja endpoint: `GET /api/v1/projects/{id}/views/{view}/buckets`
- required tool inputs:
  - `project_id`
  - `view_id`
- response shape:
  - `items`
- note:
  - the official API documents this endpoint as returning bucket metadata
  - to get buckets with their tasks, the bridge should use the tasks endpoint with a kanban view

`tasks_list`

- Vikunja endpoint: `GET /api/v1/projects/{id}/views/{view}/tasks`
- required tool inputs:
  - `project_id`
  - `view_id`
- optional tool inputs:
  - `page`
  - `per_page`
  - `search`
  - `filter`
  - `filter_include_nulls`
  - `filter_timezone`
  - `sort_by`
  - `order_by`
- response shape:
  - `items`
  - `pagination`
- design choice:
  - v1 task listing is explicitly view-scoped because that is the documented API shape and it matches real Vikunja workflows
  - when the selected view is kanban, the bridge should preserve Vikunja's bucket-oriented result instead of flattening it silently

`task_get`

- Vikunja endpoint: `GET /api/v1/tasks/{id}`
- required tool input:
  - `task_id`
- optional tool input:
  - `expand`
- response shape:
  - `task`

`labels_list`

- Vikunja endpoint: `GET /api/v1/labels`
- supported tool inputs:
  - `page`
  - `per_page`
  - `search`
- response shape:
  - `items`
  - `pagination`
- note:
  - task-specific label reads should use the internal endpoint `GET /api/v1/tasks/{task}/labels` for verification work, but that does not need to be a public v1 MCP tool

### Write operations

`task_create`

- Vikunja endpoint: `PUT /api/v1/projects/{id}/tasks`
- required tool inputs:
  - `project_id`
  - `title`
- allowed optional tool inputs in v1:
  - `description`
  - `done`
  - `priority`
  - `percent_done`
  - `due_date`
  - `start_date`
  - `end_date`
- response shape:
  - `task`
  - `verification`

`task_update`

- Vikunja endpoint: `POST /api/v1/tasks/{id}`
- required tool input:
  - `task_id`
- allowed optional patch fields in v1:
  - `title`
  - `description`
  - `done`
  - `priority`
  - `percent_done`
  - `due_date`
  - `start_date`
  - `end_date`
- response shape:
  - `task`
  - `verification`
- design choice:
  - the MCP tool behaves like a patch
  - the bridge should first read the current task, merge the allowed fields, then send the full task object required by Vikunja
  - labels are intentionally excluded from `task_update` because Vikunja documents label management as separate endpoints

`task_add_label`

- Vikunja endpoint: `PUT /api/v1/tasks/{task}/labels`
- verification endpoint: `GET /api/v1/tasks/{task}/labels`
- required tool inputs:
  - `task_id`
  - `label_id`
- response shape:
  - `task_id`
  - `label_id`
  - `already_present`
  - `labels`

### Deferred operations

Documented but deferred from v1 public tools:

- moving a task between buckets
- bulk label replacement
- delete operations
- label creation or update
- project creation or update
- view creation or update

These are valid future additions, but they are not part of the first useful bridge.

## Tool result conventions

### List tools

List tools should return:

- `items`
- `pagination.page`
- `pagination.per_page`
- `pagination.total_pages`
- `pagination.result_count`

The pagination metadata should come from Vikunja response headers where available.

### Single-resource tools

Single-resource tools should return a single top-level object:

- `task`
- `project`
- `view`

For v1, only `task` is needed as a single-resource public tool output.

### Write tools

Write tools should return:

- the final verified resource state
- a small verification object describing what was checked

If a requested change is already satisfied, return success with explicit idempotent metadata instead of pretending a write happened.

## Error handling

### Startup errors

- invalid config must fail the process during startup
- the service should not start in a partially configured state

### Inbound HTTP errors

- invalid or missing MCP bearer token: `401`
- unknown route: normal Express `404`
- health check with unreachable Vikunja: `503`

### Vikunja client errors

Normalize upstream errors into a consistent internal shape:

- upstream HTTP status
- Vikunja message body when present
- a short bridge-level message explaining which operation failed

Do not pass through raw stack traces to MCP clients.

### Tool errors

Tool handlers should return structured MCP errors with `isError: true` and concise text explaining:

- which operation failed
- which identifiers were involved
- whether the failure came from input validation, upstream auth, not found, or verification

## Write verification rules

This is a core product behavior.

`task_create`

- create the task
- read the task back with `task_get`
- return the verified task object

`task_update`

- read the current task
- merge the allowed patch fields
- submit the update
- read the task back
- compare the requested fields against the final state
- fail if the final state cannot be confirmed

`task_add_label`

- read current task labels first
- if the label is already present, return success with `already_present: true`
- otherwise add the label
- read task labels again
- confirm the label now exists

If the upstream write succeeds but verification does not, the bridge must return an error instead of a false success.

## Phase 3 dependency set

These are the implemented Phase 3 dependencies and why they exist:

- `typescript`
  - compile the server and keep types explicit
- `tsx`
  - simple local development runner
- `@modelcontextprotocol/sdk`
  - official MCP server implementation and Streamable HTTP transport
- `express`
  - minimal HTTP shell
- `zod`
  - config validation and tool schemas

No other runtime dependencies should be added casually unless they solve a concrete problem this blueprint does not already cover.

## Phase 3 outcome

Phase 3 established these outcomes:

- the runtime structure above exists
- config validation is working
- `/healthz` responds correctly
- `/mcp` is mounted with bearer auth
- the MCP server boots through the official SDK
- no Vikunja business logic has been overbuilt yet

Those outcomes are now present in the repo.

## Source anchors

This blueprint is grounded in these primary sources:

- Vikunja API documentation: https://vikunja.io/docs/api-documentation/
- Vikunja public OpenAPI spec: https://try.vikunja.io/api/v1/docs.json
- Vikunja filter API reference: https://vikunja.io/docs/filters
- MCP TypeScript SDK server docs: https://ts.sdk.modelcontextprotocol.io/documents/server.html
