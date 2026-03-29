# vikunja-mcp-http

Self-hostable HTTP MCP bridge for Vikunja, designed for Codex and easy deployment on TrueNAS.

## Status

Core implementation is in the repo now:

- TypeScript + Express runtime
- official MCP Streamable HTTP server on `/mcp`
- Vikunja client and the first useful tool set
- Docker packaging and `.env.example`
- Codex, local testing, release, and TrueNAS docs

Local development is pinned to Node.js 24.x.
Use `nvm install` and `nvm use` with the repo's `.nvmrc`.

Verified in this repo:

- `npm run typecheck`
- `npm run build`
- `npm run test`
- Docker image build
- packaged smoke checks for `/healthz` and `/mcp`

Still pending in a real environment:

- live validation against a real Vikunja instance
- a real GHCR publish and pull
- a real TrueNAS deployment
- broader integration and live-environment coverage

The goal of this project is to provide a stable HTTP MCP service that sits between AI coding tools and a self-hosted Vikunja instance.

Target use case:

- use Codex or other MCP-compatible tools from VS Code
- connect to a persistent LAN-reachable MCP endpoint
- read and write Vikunja projects, tasks, labels, views, and buckets
- avoid the cold-start friction of local STDIO-only MCP processes
- make deployment straightforward on TrueNAS through a custom app / YAML flow

## Why this exists

A local STDIO MCP server is fast to validate, but repeated real usage can become annoying:

- each new agent session starts from a fresh local process
- first operations can feel slower or less consistent
- project and bucket discovery may be repeated over and over
- write operations benefit from stronger server-side verification

This project aims to solve that by exposing Vikunja through a persistent HTTP MCP service.

## Current v1 surface

Implemented now:

- remote HTTP MCP endpoint for Vikunja
- `projects_list`
- `tasks_list`
- `task_get`
- `task_create`
- `task_update`
- `labels_list`
- `task_add_label`
- `views_list`
- `buckets_list`
- read projects, tasks, views, and buckets
- create and update tasks
- add labels to tasks
- verify final state after write operations
- health endpoint
- inbound bearer auth on `/mcp`

Packaged in-repo:

- Docker image
- `.env.example`
- manual GHCR publishing instructions
- TrueNAS deployment guide
- Codex configuration guide

## Not in the first version

- public internet exposure
- OAuth
- broad destructive delete operations
- full coverage of every Vikunja API endpoint
- official TrueNAS catalog publication on day one

## Project documents

See:

- `docs/architecture.md`
- `docs/codex-config.md`
- `docs/implementation-blueprint.md`
- `docs/local-testing.md`
- `docs/release.md`
- `docs/roadmap.md`
- `docs/truenas-install.md`

The documents under `docs/` are the canonical project references.
Temporary handoff notes or imported planning artifacts should be treated as working input until they are folded into those docs.

## License

Apache-2.0
