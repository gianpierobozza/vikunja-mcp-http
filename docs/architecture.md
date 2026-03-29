# Architecture

## Purpose

`vikunja-mcp-http` is meant to provide a persistent HTTP MCP service in front of a self-hosted Vikunja instance.

The core problem it solves is the friction of relying only on local STDIO MCP processes for repeated real usage.

## Target architecture

The intended flow is:

Codex / MCP client → HTTP MCP service → Vikunja REST API

This service should act as a thin and reliable bridge.

## Main responsibilities

The service should:

- expose an MCP-compatible HTTP endpoint
- authenticate incoming MCP clients
- authenticate to Vikunja using an internal API token
- perform controlled read and write operations against Vikunja
- verify final state after write operations
- return precise, useful results to the MCP client
- expose a health endpoint for operational checks

## Why HTTP instead of local STDIO

A local STDIO MCP process is useful for initial experimentation, but it has limits in repeated daily usage:

- each new agent session can relaunch the local process
- repeated board discovery can slow down the first operation
- operational state is less centralized
- deployment is tied to one development machine

An HTTP service solves those issues better for a home-lab environment.

## Design principles

The service should be:

- narrow in scope
- easy to self-host
- predictable
- LAN-friendly
- explicit about state
- simple to package and redeploy

It should not try to become a generic Vikunja platform.

## First-version tool scope

The first useful version should focus on the operations needed for real board workflows.

Planned initial capability set:

- list projects
- list tasks
- get a task
- create a task
- update a task
- list labels
- add a label to a task
- list views
- list buckets

This is intentionally smaller than full Vikunja API coverage.

## Write verification rule

Every write-capable operation should verify the final state before reporting success.

Examples:

- after creating a task, read it back and return the resolved final object
- after updating a task, read it back and confirm the changed fields
- after applying a label, verify the label is present
- after moving a task, verify the resulting bucket or state

This is a core product behavior, not an optional detail.

## Idempotent behavior

Where practical, the service should prefer idempotent results over noisy retries.

Examples:

- if a task already has the requested label, return that state clearly
- if a task is already in the requested bucket, report that instead of retrying blindly

## Security model

The first version should use two distinct secrets:

- one bearer token for incoming MCP clients
- one Vikunja API token used internally by the bridge

These should not be the same secret.

The initial deployment target is LAN-only, not public internet exposure.

## Operational endpoints

Planned endpoints:

- `/mcp` for the MCP HTTP transport
- `/healthz` for service health checks

The health endpoint should help determine:

- whether the service is up
- whether required configuration is present
- whether Vikunja is reachable

## Technology direction

The current intended stack is:

- TypeScript
- official MCP TypeScript SDK
- HTTP server framework suitable for a simple stateless service
- Docker packaging
- GHCR image publishing
- TrueNAS custom app deployment

These are still implementation-phase decisions until the bootstrap is complete, but this is the current direction.
