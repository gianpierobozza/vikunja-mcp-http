# Local Testing

## Goal

This document records the Phase 6 local validation flow for `vikunja-mcp-http`.

It is meant to be used before or alongside container deployment so the bridge can be checked against a real Vikunja instance from a fresh Codex session.

## Prerequisites

Export the required environment variables:

- `PORT`
- `MCP_BEARER_TOKEN`
- `VIKUNJA_URL`
- `VIKUNJA_API_TOKEN`
- optional `VERIFY_SSL=false` when testing against a self-signed local Vikunja certificate

Validation notes:

- `PORT` must be digits only
- `VIKUNJA_URL` must use `http://` or `https://`

Example:

```bash
export PORT=4010
export MCP_BEARER_TOKEN='replace-me'
export VIKUNJA_URL='https://your-vikunja-host'
export VIKUNJA_API_TOKEN='replace-me'
export VERIFY_SSL=true
```

## Start the Bridge

For a local validation pass:

```bash
npm install
npm run build
npm start
```

Or for active iteration:

```bash
npm run dev
```

Expected startup result:

- the process starts without config errors
- `/healthz` returns `200` when Vikunja is reachable and the token is valid
- `/healthz` returns `503` when Vikunja is unreachable or auth to Vikunja fails

## Basic HTTP Checks

Health check:

```bash
curl http://127.0.0.1:${PORT}/healthz
```

Unauthorized MCP request:

```bash
curl -i -X POST http://127.0.0.1:${PORT}/mcp \
  -H 'content-type: application/json' \
  -d '{}'
```

Expected result:

- `401` with a JSON error body

Method-not-allowed check:

```bash
curl -i http://127.0.0.1:${PORT}/mcp
```

Expected result:

- `405`

## Codex Validation Flow

Point Codex at the local MCP endpoint:

```bash
codex mcp add vikunja-local \
  --url http://127.0.0.1:4010/mcp \
  --bearer-token-env-var VIKUNJA_MCP_BEARER
```

Set the bearer token in the client environment:

```bash
export VIKUNJA_MCP_BEARER="${MCP_BEARER_TOKEN}"
```

From a fresh Codex session, validate this baseline sequence:

1. list projects and confirm `Stonegate Descent` appears
2. list views for the target project
3. list buckets for the active kanban view
4. get the task that contains the board rules, for example `BOARD RULES`
5. create a disposable task in the correct project
6. update that task description
7. add a label to that task
8. repeat the same label add and confirm the bridge reports `already_present: true`
9. repeat the same task update payload and confirm the bridge reports `already_satisfied: true`

## Expanded Core Work API Validation

For the Milestone 8 surface, run a disposable end-to-end pass using clearly prefixed temporary names such as `Codex test - ...`.

Suggested sequence:

1. create a disposable project
2. update that project metadata
3. create a disposable view inside it
4. update that view
5. create a disposable bucket inside that view
6. update that bucket limit or position
7. create a disposable task
8. move that task into the disposable bucket
9. create a disposable label
10. add the label to the task, then remove it again
11. search for a visible user, assign them to the task, then unassign them
12. add a reaction to the task, then remove it again
13. create a comment on the task, update it, add a reaction to it, remove that reaction, then delete the comment
14. create a relation from the task to another disposable or known-safe task, then delete it
15. delete the disposable task with `confirm=true`
16. delete the disposable bucket with `confirm=true`
17. delete the disposable view with `confirm=true`
18. delete the disposable label with `confirm=true`
19. delete the disposable project with `confirm=true`

Notes:

- plain `task_get` may report `bucket_id: 0` for kanban tasks even when the board shows a real bucket
- `task_move` verifies bucket placement from `task_get` with `expand=["buckets"]` and falls back to `tasks_list` for the board when needed; position is still best-effort unless the board view confirms an exact match
- reaction tools currently support the Vikunja entity kinds `tasks` and `comments`
- `task_relations_list` is derived from the task's `related_tasks` state because the current Vikunja OpenAPI does not expose a dedicated relation-list endpoint
- if user assignment is not available in your Vikunja setup, skip the assignee steps and note the external limitation

When you are done with the local entry, you can remove it with:

```bash
codex mcp remove vikunja-local
```

## Failure Scenarios

Validate these negative cases too:

- invalid `MCP_BEARER_TOKEN`
  - expect `401` from `/mcp`
- invalid `VIKUNJA_API_TOKEN`
  - expect `/healthz` to return `503`
  - expect tools to return MCP tool errors rather than crash the server
- unreachable `VIKUNJA_URL`
  - expect `/healthz` to return `503`
  - expect tool calls to return clear upstream connectivity errors
- invalid JSON sent to Express
  - expect a JSON error response instead of an HTML stack trace

## Notes From Current State

- The codebase has been validated in-process and through in-memory MCP client/server checks.
- `npm run typecheck` and `npm run build` pass in this repo.
- `npm run test` and `npm run test:coverage` now cover config parsing, HTTP/auth behavior, the expanded core work tool surface, and Vikunja client normalization.
- the Docker image builds successfully, and a packaged smoke test confirmed `/healthz` and `/mcp` behavior inside the container.
- a real GHCR image has now been published and pulled for deployment.
- the bridge has now been deployed successfully on TrueNAS and is reachable over the LAN.
- live validation confirmed `/healthz` returns `200` against a real Vikunja instance and `/mcp` returns `401` when called without the bearer token.
- a fresh Codex session has now listed the `Stonegate Descent` project, its views, and its kanban tasks through the deployed bridge.
- the broader Milestone 8 create/update/delete and association flows are implemented and unit-tested, but the full expanded live write-path checklist above is still the main remaining external validation step.
- known quirk: `buckets_list` may show bucket count-style fields from Vikunja as `0` even when `tasks_list` for the same kanban view shows tasks present in those buckets. Use `tasks_list` as the authoritative source for occupancy.
