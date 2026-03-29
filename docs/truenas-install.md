# TrueNAS Install Guide

## Goal

Deploy `vikunja-mcp-http` on TrueNAS as an always-on LAN service that exposes:

- `GET /healthz`
- `POST /mcp`

The recommended v1 path is TrueNAS `Install via YAML`, because it gives the cleanest reinstall story for a single-container service.

## What the Container Needs

The bridge is intentionally small.

For v1 it requires:

- one container image
- one TCP port mapping
- four required environment variables
- no persistent storage volumes

## Prerequisites

Before installing on TrueNAS, have these ready:

- a published OCI image, preferably an immutable tag such as `ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http:sha-<shortsha>`
- the base URL for your Vikunja instance
- a Vikunja API token for the bridge
- a bearer token that Codex or other MCP clients will send to `/mcp`
- a LAN host name or IP for the TrueNAS box

If the Vikunja instance uses a self-signed certificate, plan to set `VERIFY_SSL` to `false`.

## Recommended TrueNAS YAML

From the TrueNAS Apps screen, open `Discover Apps`, then use `Install via YAML`.

Paste a Compose file like this:

```yaml
name: vikunja-mcp-http

services:
  app:
    image: ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http:sha-<shortsha>
    restart: unless-stopped
    environment:
      PORT: "4010"
      MCP_BEARER_TOKEN: "replace-me"
      VIKUNJA_URL: "https://vikunja.example.internal"
      VIKUNJA_API_TOKEN: "replace-me"
      VERIFY_SSL: "true"
    ports:
      - "4010:4010/tcp"
```

Notes:

- prefer a `sha-<shortsha>` image tag for repeatable deployments and rollback clarity
- reserve `:latest` for quick smoke tests or when you explicitly want the newest image
- keep the host and container port the same for the first deployment
- no volume mounts are needed for v1
- if you later change `PORT`, update the container-side port mapping too

## Install Steps

1. Open `Apps`.
2. Open `Discover Apps`.
3. Use `Install via YAML`.
4. Enter a lowercase app name, for example `vikunja-mcp-http`.
5. Paste the Compose YAML.
6. Save and wait for the app to deploy.

## Post-Install Checks

Once the container is running, verify the health endpoint from another machine on the LAN:

```bash
curl http://TRUENAS_IP_OR_HOSTNAME:4010/healthz
```

Expected result:

- `200` when Vikunja is reachable and the bridge token is valid
- `503` when the bridge is up but Vikunja is unreachable or misconfigured

Then confirm the MCP endpoint is reachable:

```bash
curl -i -X POST http://TRUENAS_IP_OR_HOSTNAME:4010/mcp \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer replace-me' \
  -d '{}'
```

Expected result:

- an MCP-shaped error or protocol response
- not a connection failure
- not an HTML page

## Updating an Existing TrueNAS Install

When a new image is published from a merge to `main`, update the existing app instead of reinstalling it.

Recommended flow:

1. open the GitHub `Actions` tab for this repository
2. confirm `Publish GHCR Image` passed for the merge commit
3. note the new immutable image tag, for example `ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http:sha-abc1234`
4. in TrueNAS, open `Apps`
5. open the installed `vikunja-mcp-http` app
6. use the app edit flow and replace the old image tag with the new `sha-...` tag
7. save the update and wait for TrueNAS to redeploy the app

Then rerun the LAN checks:

```bash
curl http://TRUENAS_IP_OR_HOSTNAME:4010/healthz
curl -i -X POST http://TRUENAS_IP_OR_HOSTNAME:4010/mcp \
  -H 'content-type: application/json' \
  -d '{}'
```

Expected result:

- `/healthz` still returns `200` when Vikunja is reachable
- `/mcp` still returns `401` without the configured bearer token

Rollback is the same process in reverse: edit the app again and switch the image back to the previous `sha-...` tag.

## Codex LAN Endpoint

After the app is up, point Codex at:

```text
http://TRUENAS_IP_OR_HOSTNAME:4010/mcp
```

Use the same bearer token you set as `MCP_BEARER_TOKEN`.

The matching Codex setup flow is documented in `docs/codex-config.md`.

## Operational Notes

- keep this service LAN-only in v1
- do not put it directly on the public internet
- there is no persistent storage requirement for the bridge itself
- if the image is private in GHCR, TrueNAS must be able to authenticate before deployment
- runtime logs are written to container stdout/stderr, so the TrueNAS app logs are the primary place to inspect startup, `/healthz`, auth failures, `/mcp` request summaries, tool activity, and Vikunja upstream failures
- log lines are intentionally short and single-line, and they do not include bearer tokens, API tokens, auth headers, raw request bodies, or full response payloads

## Notes From Live Validation

The deployment shape in this document has now been validated with a real public GHCR image and a real TrueNAS deployment.

Live checks confirmed:

- `/healthz` returned `200` against a real Vikunja instance
- `/mcp` returned `401` when called without the configured bearer token
- a fresh Codex session could list the `Stonegate Descent` project and read its kanban tasks through the deployed bridge

Known quirk:

- `buckets_list` may surface bucket count-style metadata from Vikunja as `0` even when `tasks_list` for the same kanban view shows tasks inside those buckets. For occupancy, prefer `tasks_list`.
