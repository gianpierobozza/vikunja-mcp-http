# Roadmap

## Current phase

Post-Milestone-8 live validation and operational polish.

The implementation blueprint has been applied, the runtime exists, and packaging artifacts are in the repo.
The remaining work is:

- run the expanded Milestone 8 live write-path validation from fresh Codex sessions
- run the new reaction add/remove validation for both tasks and comments against the deployed bridge
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

## Milestone 7 — Operational polish (completed)

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

## Milestone 8 — Core work API expansion (completed in repo)

Goal:
Broaden the bridge from the original v1 tool set into a practical core work-management surface while keeping explicit MCP tools and selective delete safety.

Implemented scope:

- project CRUD
- view CRUD
- bucket CRUD
- task delete and task move
- task label list and remove
- generic reactions for tasks and comments
- user search and task assignee add/remove/list
- label CRUD
- task comment CRUD
- task relation list/create/delete
- `confirm=true` protection on destructive delete tools
- verification and idempotency across the new write flows

Success criteria achieved in-repo:

- expanded client methods implemented against official Vikunja endpoints
- new MCP tools registered in the same explicit style as the original v1 surface
- automated coverage expanded alongside the new code
- repo-wide coverage thresholds still pass

Remaining external validation:

- execute the full expanded live checklist from `docs/local-testing.md`
- confirm the new write/delete flows behave as expected from fresh Codex sessions against the deployed bridge

## Later-phase possibilities

Not current priorities, but possible future directions:

- file uploads and attachments
- saved filters
- sharing, teams, memberships, and subscriptions
- auth/login/OpenID/session flows
- migration or import/export endpoints
- better admin/config UX
- reverse proxy examples
- TLS examples
- community contributions
- TrueNAS catalog submission
