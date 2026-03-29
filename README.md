# vikunja-mcp-http

Self-hostable HTTP MCP bridge for Vikunja, designed for Codex and easy deployment on TrueNAS.

## Status

Core implementation is in the repo now:

- TypeScript + Express runtime
- official MCP Streamable HTTP server on `/mcp`
- Vikunja client and a broad core work-management tool set
- Docker packaging and `.env.example`
- Codex, local testing, release, and TrueNAS docs

Local development is pinned to Node.js 24.x.
Use `nvm install` and `nvm use` with the repo's `.nvmrc`.

Verified in this repo:

- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run test:coverage`
- Docker image build
- packaged smoke checks for `/healthz` and `/mcp`
- real GHCR publication
- real TrueNAS deployment
- live `/healthz` validation against a real Vikunja instance
- live `/mcp` auth validation over the LAN
- fresh Codex read validation against the `Stonegate Descent` project

Automation now configured in the repo:

- GitHub Actions CI on pull requests and feature-branch pushes
- automatic GHCR publish on `main` merges using `latest` and `sha-<shortsha>` tags

Still worth expanding in a real environment:

- broader live write-path validation for the expanded Milestone 8 tool surface
- more live-environment usage coverage
- first live GitHub Actions publish run after the next merge to `main`

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

## Current core work surface

Implemented now:

- remote HTTP MCP endpoint for Vikunja
- project tools: `projects_list`, `project_get`, `project_create`, `project_update`, `project_delete`
- task tools: `tasks_list`, `task_get`, `task_create`, `task_update`, `task_delete`, `task_move`
- label tools: `labels_list`, `label_get`, `label_create`, `label_update`, `label_delete`, `task_labels_list`, `task_add_label`, `task_remove_label`
- user and assignee tools: `users_search`, `task_assignees_list`, `task_assign_user`, `task_unassign_user`
- comment tools: `task_comments_list`, `task_comment_get`, `task_comment_create`, `task_comment_update`, `task_comment_delete`
- relation tools: `task_relations_list`, `task_relation_create`, `task_relation_delete`
- view tools: `views_list`, `view_create`, `view_update`, `view_delete`
- bucket tools: `buckets_list`, `bucket_create`, `bucket_update`, `bucket_delete`
- verify final state after write operations
- require `confirm=true` for destructive project, task, label, comment, view, and bucket deletes
- favor idempotent `already_present`, `already_absent`, and `already_satisfied` results when no write is needed
- health endpoint
- inbound bearer auth on `/mcp`

Packaged in-repo:

- Docker image
- `.env.example`
- GitHub Actions CI and automated GHCR publishing
- manual GHCR publishing fallback instructions
- TrueNAS deployment guide
- Codex configuration guide

Known quirk:

- `buckets_list` reflects bucket metadata from Vikunja, but bucket task counts may appear as `0` even when `tasks_list` for the kanban view shows tasks in those buckets. For actual bucket occupancy, treat `tasks_list` as the authoritative source.
- `task_relations_list` is derived from the task's `related_tasks` state because the current Vikunja OpenAPI exposes relation create/delete operations but not a dedicated relation-list endpoint.

## Not in the first version

- public internet exposure
- OAuth
- broad or generic destructive delete passthroughs
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
