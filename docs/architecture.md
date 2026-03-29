# Architecture

## Purpose

`vikunja-mcp-http` provides a persistent HTTP MCP service in front of a self-hosted Vikunja instance.

The core problem it solves is the friction of relying only on local STDIO MCP processes for repeated real usage.

## Current architecture

The current flow is:

Codex / MCP client → HTTP MCP service → Vikunja REST API

The service is intentionally a thin and reliable bridge.

## Main responsibilities

The service currently:

- exposes an MCP-compatible HTTP endpoint
- authenticates incoming MCP clients
- authenticates to Vikunja using an internal API token
- performs controlled read and write operations against Vikunja
- verifies final state after write operations
- returns precise, useful results to the MCP client
- exposes a health endpoint for operational checks

## Why HTTP instead of local STDIO

A local STDIO MCP process is useful for initial experimentation, but it has limits in repeated daily usage:

- each new agent session can relaunch the local process
- repeated board discovery can slow down the first operation
- operational state is less centralized
- deployment is tied to one development machine

An HTTP service solves those issues better for a home-lab environment.

## Design principles

The service is:

- narrow in scope
- easy to self-host
- predictable
- LAN-friendly
- explicit about state
- simple to package and redeploy

It is not trying to become a generic Vikunja platform.

## Current v1 tool scope

The implemented initial capability set is:

- `projects_list`
- `tasks_list`
- `task_get`
- `task_create`
- `task_update`
- `labels_list`
- `task_add_label`
- `views_list`
- `buckets_list`

This is intentionally smaller than full Vikunja API coverage.

## Known API quirk

In live testing, `buckets_list` has been reliable for bucket identity, title, limits, and ordering, but bucket count-style metadata from Vikunja may still appear as `0` even when tasks are visibly present in those buckets through the kanban task view.

For actual task placement within a kanban board:

- treat `tasks_list` for the target view as the authoritative source
- treat `buckets_list` as bucket metadata rather than occupancy truth

## Write verification rule

Every write-capable operation verifies the final state before reporting success.

Examples:

- after creating a task, read it back and return the resolved final object
- after updating a task, read it back and confirm the changed fields
- after applying a label, verify the label is present

This is a core product behavior, not an optional detail.

## Idempotent behavior

Where practical, the service prefers idempotent results over noisy retries.

Examples:

- if a task already has the requested label, return that state clearly
- if a task update payload is already satisfied, return that state instead of retrying blindly

## Security model

The current version uses two distinct secrets:

- one bearer token for incoming MCP clients
- one Vikunja API token used internally by the bridge

These are intentionally separate.

The initial deployment target is LAN-only, not public internet exposure.

## Operational endpoints

Current endpoints:

- `POST /mcp` for the MCP Streamable HTTP transport
- `GET /healthz` for service health checks
- `GET /mcp` and `DELETE /mcp` return `405`

The health endpoint helps determine:

- whether the service is up
- whether required configuration is present
- whether Vikunja is reachable

## Technology stack

The current implementation uses:

- Node.js 24.x
- TypeScript
- Express 5
- official MCP TypeScript SDK
- Zod for config validation
- stateless Streamable HTTP transport
- Docker packaging
- manual GHCR release documentation
- TrueNAS custom app deployment docs

## Current validation state

The repository has been validated through:

- `npm run typecheck`
- `npm run build`
- `npm run test`
- in-memory MCP checks during implementation
- Docker image build and packaged smoke checks
- real GHCR publication
- real TrueNAS deployment
- live `/healthz` validation against a real Vikunja instance
- live `/mcp` auth validation over the LAN
- fresh Codex read validation against the `Stonegate Descent` project

What is still external to the repo:

- broader write-path validation from fresh Codex sessions
- more live-environment usage coverage
