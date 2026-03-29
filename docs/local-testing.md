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

From a fresh Codex session, validate this sequence:

1. list projects and confirm `Stonegate Descent` appears
2. list views for the target project
3. list buckets for the active kanban view
4. get the task that contains the board rules, for example `BOARD RULES`
5. create a disposable task in the correct project
6. update that task description
7. add a label to that task
8. repeat the same label add and confirm the bridge reports `already_present: true`
9. repeat the same task update payload and confirm the bridge reports `already_satisfied: true`

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
- `npm run test` now covers config parsing, HTTP/auth behavior, tool verification logic, and Vikunja client normalization.
- the Docker image builds successfully, and a packaged smoke test confirmed `/healthz` and `/mcp` behavior inside the container.
- This shell session did not have real `VIKUNJA_URL` and `VIKUNJA_API_TOKEN` values available, so a live Vikunja validation run still needs to be completed with real credentials.
