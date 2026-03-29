# AGENTS.md

## Project stage

This repository is in the planning and bootstrap phase.

Do not jump straight into implementation.
Do not create runtime code, scaffolding, package manager setup, or infrastructure files unless explicitly asked.

At this stage, clarity of product scope and deployment shape matters more than speed.

## Project goal

Build a self-hostable HTTP MCP bridge for Vikunja.

The intended usage is:

- a persistent MCP server reachable over HTTP on a local network
- Codex or other MCP-capable tools connecting to that endpoint
- the service talking to the Vikunja REST API
- deployment being easy on TrueNAS through a custom app or YAML flow

## Current priorities

Priority order:

1. define the repository structure
2. define product scope and non-goals
3. define architecture and deployment shape
4. define the first implementation milestone
5. only then begin code and packaging work

## Guardrails

Unless explicitly requested:

- do not create `package.json`
- do not create `src/`
- do not scaffold a TypeScript app
- do not add Docker or compose files
- do not invent endpoints or features not grounded in the docs
- do not silently choose frameworks or dependencies without explanation

When technical choices are needed, present options and tradeoffs before committing.

## Expected behavior

When working in this repo:

1. read the repository docs first
2. keep the public-facing goal in mind
3. prefer small, reviewable steps
4. plan before implementing
5. keep recommendations practical and opinionated
6. treat TrueNAS deployment as an explicit product goal, not an afterthought

## Implementation philosophy

When implementation begins:

- keep the server narrow and focused
- prefer a thin bridge over an overengineered platform
- verify final state after write operations
- favor idempotent behavior when practical
- keep the service easy to self-host and reason about

## Documentation rule

Documentation should stay aligned with the actual project state.

Do not document features as complete when they are only planned.
Do not present speculative future work as if it already exists.

## Definition of done for planning work

A planning task is done when it results in one or more of:

- a clarified requirement
- a documented architecture decision
- a sequenced milestone plan
- explicit non-goals
- a concrete next implementation step
