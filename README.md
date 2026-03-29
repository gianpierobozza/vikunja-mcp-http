# vikunja-mcp-http

Self-hostable HTTP MCP bridge for Vikunja, designed for Codex and easy deployment on TrueNAS.

## Status

Early planning and bootstrap phase.

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

## Planned features

Initial scope:

- remote HTTP MCP endpoint for Vikunja
- read projects, tasks, views, and buckets
- create and update tasks
- add labels to tasks
- verify final state after write operations
- health endpoint
- Docker image
- easy TrueNAS deployment
- Codex configuration examples

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
- `docs/roadmap.md`
- `docs/truenas-install.md`

## License

Apache-2.0
