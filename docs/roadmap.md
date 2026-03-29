# Roadmap

## Current phase

Post-Phase-7 live deployment follow-through and operational polish.

The implementation blueprint has been applied, the runtime exists, and packaging artifacts are in the repo.
The remaining work is:

- expand live write-path validation from fresh Codex sessions
- continue reliability and usability polish from real usage
- keep documentation aligned with proven deployment behavior

## Milestone 1 — Bootstrap (completed)

Goal:
Establish the public repository, project framing, and documentation baseline.

Target outputs:

- repository created
- initial README
- initial AGENTS.md
- architecture notes
- Codex integration notes
- TrueNAS direction notes
- implementation blueprint
- milestone plan

This milestone should not include runtime code yet.

## Milestone 2 — Local HTTP MCP prototype (completed locally)

Goal:
Build the first local development version of the HTTP MCP bridge.

Target outputs:

- minimal TypeScript service
- MCP HTTP endpoint
- health endpoint
- config validation
- inbound bearer auth
- outbound Vikunja client
- first small tool set

Success criteria:

- service runs locally
- can connect to Vikunja
- can perform the first read operations
- can perform at least one verified write operation

## Milestone 3 — First useful tool set (completed)

Goal:
Support the real-world operations needed for board workflows.

Planned tool scope:

- project listing
- task listing
- task retrieval
- task creation
- task update
- label listing
- label add-to-task
- view listing
- bucket listing

Success criteria:

- task creation works predictably
- task update works predictably
- labels can be applied
- final state is verified and reported clearly

## Milestone 4 — Containerization (completed locally)

Goal:
Package the bridge for repeatable execution.

Target outputs:

- Dockerfile
- `.env.example`
- local container run instructions
- optional compose example

Success criteria:

- image builds cleanly
- container can run locally
- health endpoint and MCP endpoint work inside the container

## Milestone 5 — GHCR publication (completed)

Goal:
Make the image easy to reuse.

Target outputs:

- publishable image
- versioning strategy
- image pull instructions
- README updates

Success criteria:

- image can be pulled from GHCR
- image tags are documented clearly

## Milestone 6 — TrueNAS custom app deployment (completed)

Goal:
Deploy the bridge to TrueNAS as an always-on LAN service.

Target outputs:

- TrueNAS-compatible YAML example
- environment variable mapping
- port exposure plan
- deployment notes

Success criteria:

- service reachable from the local network
- Codex can connect to it over HTTP
- read operations behave consistently in live deployment

## Milestone 7 — Operational polish (in progress)

Goal:
Improve reliability and usability after real usage begins.

Possible follow-ups:

- broader automated unit and integration coverage
- broader live write-path validation from Codex sessions
- stronger error reporting
- more idempotent behavior
- more precise state verification
- better documentation
- additional safe tool coverage

## Later-phase possibilities

Not current priorities, but possible future directions:

- broader Vikunja endpoint coverage
- better admin/config UX
- reverse proxy examples
- TLS examples
- community contributions
- TrueNAS catalog submission
