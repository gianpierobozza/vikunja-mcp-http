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

- a published OCI image, for example `ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http:latest`
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
    image: ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http:latest
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

## Notes From Live Validation

The deployment shape in this document has now been validated with a real public GHCR image and a real TrueNAS deployment.

Live checks confirmed:

- `/healthz` returned `200` against a real Vikunja instance
- `/mcp` returned `401` when called without the configured bearer token
- a fresh Codex session could list the `Stonegate Descent` project and read its kanban tasks through the deployed bridge

Known quirk:

- `buckets_list` may surface bucket count-style metadata from Vikunja as `0` even when `tasks_list` for the same kanban view shows tasks inside those buckets. For occupancy, prefer `tasks_list`.
