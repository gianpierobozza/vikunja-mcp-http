# Codex Configuration

## Goal

This project is intended to be consumed by Codex as a remote HTTP MCP server instead of only as a local STDIO process.

That means the client configuration should ultimately point to a stable network endpoint.

## Why this matters

A persistent HTTP endpoint is preferable when the MCP bridge is used frequently:

- the server can remain always available
- the tooling path is stable across sessions
- the service can live on dedicated infrastructure such as TrueNAS
- the development machine no longer needs to spawn the MCP process locally each time

## Intended Codex shape

The eventual Codex configuration should point to a URL-based MCP server.

Example shape:

```toml
[mcp_servers.vikunja]
url = "http://YOUR_SERVER_IP_OR_HOSTNAME:8080/mcp"
bearer_token_env_var = "VIKUNJA_MCP_BEARER"
required = true
startup_timeout_sec = 20
tool_timeout_sec = 60
```

This is not a final production example yet. It is the intended direction for the project.

## Expected environment variable

The client should provide a bearer token for the MCP bridge, for example:

- `VIKUNJA_MCP_BEARER`

The bridge itself should then use its own internal Vikunja API token.

## Migration intent

This project is meant to support a migration from a local STDIO-based Vikunja MCP setup to a persistent HTTP service reachable on the local network.

The desired result is:

- less cold-start friction
- more predictable repeated operations
- easier reuse across machines
- a cleaner home-lab deployment story

## Validation expectation

Once the bridge exists, a fresh Codex session should be able to:

- list Vikunja projects
- locate a target project
- read task details
- create and update tasks
- verify final state after write operations

without depending on a local per-session MCP process.

## Non-goal

This document is not yet a full setup guide.
It only records the intended configuration shape and client-facing expectations.
