# Codex Configuration

## Goal

Connect Codex to `vikunja-mcp-http` as a remote Streamable HTTP MCP server over the local network.

The bridge expects:

- the MCP endpoint at `/mcp`
- a bearer token on incoming MCP requests

## Prerequisites

Before adding the server in Codex:

- the bridge is already running locally or on TrueNAS
- you know the full MCP URL, for example `http://truenas.local:4010/mcp`
- you know the bearer token configured as `MCP_BEARER_TOKEN` on the bridge

Export that token into your local shell:

```bash
export VIKUNJA_MCP_BEARER='replace-me'
```

## Recommended Codex CLI Setup

Add the remote server with the Codex CLI:

```bash
codex mcp add vikunja \
  --url http://TRUENAS_IP_OR_HOSTNAME:4010/mcp \
  --bearer-token-env-var VIKUNJA_MCP_BEARER
```

Check that Codex has the server registered:

```bash
codex mcp list
codex mcp get vikunja
```

## Equivalent Config File Shape

If you manage Codex through `~/.codex/config.toml`, the same server entry looks like:

```toml
[mcp_servers.vikunja]
url = "http://TRUENAS_IP_OR_HOSTNAME:4010/mcp"
bearer_token_env_var = "VIKUNJA_MCP_BEARER"
```

## Fresh-Session Validation

From a fresh Codex session, the first practical checks should be:

1. list projects and confirm `Stonegate Descent` appears
2. list views for that project
3. list buckets for the working kanban view
4. retrieve the `BOARD RULES` task
5. create a disposable task
6. update it
7. add a label

If those pass, the LAN MCP path is working end to end:

- Codex to the bridge over HTTP
- bridge auth on `/mcp`
- bridge to Vikunja over the REST API

Known quirk:

- `buckets_list` may return bucket count-style metadata from Vikunja as `0` even when `tasks_list` for the same kanban view shows tasks present in those buckets. For actual board occupancy, prefer `tasks_list`.

## Local Override

For local-only validation instead of TrueNAS, the same command works with `127.0.0.1`:

```bash
codex mcp add vikunja-local \
  --url http://127.0.0.1:4010/mcp \
  --bearer-token-env-var VIKUNJA_MCP_BEARER
```

That flow is documented in `docs/local-testing.md`.
