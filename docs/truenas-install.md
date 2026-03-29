# TrueNAS Install Direction

## Goal

The project is intended to be deployable on a TrueNAS home-lab system as a persistent LAN-reachable service.

The preferred distribution target is a custom app deployment flow, not a one-off manual container hack.

## Why TrueNAS is a first-class target

TrueNAS is part of the core intended use case.

The bridge should be:

- easy to deploy from a container image
- easy to reinstall
- easy to configure with environment variables
- stable enough to act as a persistent MCP endpoint for Codex

## Planned deployment model

The expected deployment path is:

- build the bridge as a container image
- publish that image
- install it on TrueNAS as a custom app
- expose the HTTP MCP endpoint on the local network
- point Codex to the LAN endpoint

## Preferred install artifact

The preferred long-term artifact is a reusable YAML-based install definition suitable for the TrueNAS custom app flow.

That gives a better reinstall story than relying only on click-by-click manual setup.

## First-version runtime expectations

The first deployment should likely require only:

- application container
- network port mapping
- environment variables
- no persistent storage volume

That keeps the first deployment simple.

## Planned environment variables

Expected runtime configuration will likely include:

- `PORT`
- `MCP_BEARER_TOKEN`
- `VIKUNJA_URL`
- `VIKUNJA_API_TOKEN`
- optional SSL-related configuration if needed

## Planned network exposure

The first deployment target is local-network access only.

This means:

- reachable from the developer machine and other trusted LAN clients
- no public internet exposure
- no unnecessary ingress complexity in v1

## Health and operability

The deployed service should expose a health endpoint.

That should make it easy to confirm:

- container is up
- configuration loaded correctly
- Vikunja is reachable

## Non-goals for the first deployment

The first TrueNAS deployment should avoid unnecessary complexity such as:

- public exposure
- external auth providers
- multi-user management
- extra infrastructure services
- persistent databases or caches

## What this document is for

This file records the intended deployment direction.

It is not yet the final installation guide.
That should be written only after the containerized version actually exists and has been tested.
