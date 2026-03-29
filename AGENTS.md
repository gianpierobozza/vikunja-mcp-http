# AGENTS.md

## Project stage

This repository is in the implementation hardening, deployment-readiness, and expanded core-work API validation phase.

Core runtime code, packaging artifacts, and deployment docs already exist.
Default to refining the current implementation and validating it in real environments instead of planning from scratch.

## Project goal

Build a self-hostable HTTP MCP bridge for Vikunja.

The intended usage is:

- a persistent MCP server reachable over HTTP on a local network
- Codex or other MCP-capable tools connecting to that endpoint
- the service talking to the Vikunja REST API
- deployment being easy on TrueNAS through a custom app or YAML flow

## Current priorities

Priority order:

1. validate the bridge against a real Vikunja instance and real LAN usage
2. validate the expanded core work-management tool surface in real workflows
3. expand automated test coverage alongside any new behavior
4. keep docs, runtime behavior, and packaging aligned
5. improve reliability and error clarity without widening into non-core API domains

Only after that should the project consider out-of-scope areas such as attachments, sharing, auth flows, or migration endpoints.

## Guardrails

Unless explicitly requested:

- do not replace the current TypeScript, Express, or official MCP SDK stack
- do not broaden the public tool surface beyond the documented core work API without an explicit request
- do not add a generic passthrough tool in place of the explicit MCP tools
- do not add public internet exposure, OAuth, or broad destructive delete flows
- do not add persistent services such as databases, queues, or caches
- do not invent endpoints or features not grounded in the docs
- do not document live Vikunja, GHCR, or TrueNAS validation as complete unless it was actually run
- do not silently change deployment contracts such as endpoints, env vars, or auth boundaries without explanation

When technical choices are needed, present options and tradeoffs before committing.

## Expected behavior

When working in this repo:

1. read the repository docs first
2. keep the public-facing goal in mind
3. prefer small, reviewable steps
4. validate implemented behavior, not just intended behavior
5. keep recommendations practical and opinionated
6. treat TrueNAS deployment as an explicit product goal, not an afterthought
7. update the docs when the runtime behavior changes

## Implementation philosophy

The current implementation should continue to follow these rules:

- keep the server narrow and focused
- prefer a thin bridge over an overengineered platform
- verify final state after write operations
- favor idempotent behavior when practical
- require `confirm=true` for selective destructive delete tools
- keep the service easy to self-host and reason about

## Testing rule

Every new behavior change or implementation change must add or update unit tests in the same change.

For new or modified code:

- cover the changed behavior with focused unit tests
- run `npm run test` and `npm run test:coverage`
- maintain at least 90% coverage on the new code being introduced or changed

Do not treat a change as done if it materially changes behavior without automated coverage, unless the user explicitly approves that tradeoff.

## Documentation rule

Documentation should stay aligned with the actual project state.

Do not document features as complete when they are only planned.
Do not present speculative future work as if it already exists.

## Definition of done for current work

A task is done when it results in one or more of:

- code that matches the existing architecture and passes available checks
- documentation updated to reflect the real project state
- a validated local, container, or deployment step
- new automated coverage for a real behavior
- an explicit note about any remaining external validation gap
