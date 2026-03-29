# Release and Publishing

## Goal

This document records the default GHCR release path for `vikunja-mcp-http`.

The repository now includes GitHub Actions workflows that:

- run CI on pull requests to `main`
- run CI on feature-branch pushes
- publish the container image automatically when a merge lands on `main`

The Docker image shape has already been validated locally in this repo with a successful `docker build`, manual GHCR publication, and a real TrueNAS deployment.

## Prerequisites

Before relying on the automated publish path:

- GitHub Actions is enabled for the repository
- the repository has permission to publish to `ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http`
- if the GHCR package was created manually before the workflow existed, confirm the package is linked to this repository or grant this repository GitHub Actions access in the package settings
- if the package will stay private, downstream pull environments still need GHCR credentials

## Default Automated Path

The default release flow is now:

1. push work to a feature branch
2. open a pull request into `main`
3. let the `CI` workflow run the verification checks
4. merge the pull request
5. let the `Publish GHCR Image` workflow build, test, and push the image

The publish workflow runs on `push` to `main`, which matches the current branch-protection model where direct pushes to `main` are blocked and merges happen through pull requests.

Published tags on every successful `main` merge:

- `ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http:latest`
- `ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http:sha-<shortsha>`

Tag guidance:

- use `latest` for quick smoke tests or when you explicitly want the newest image
- use `sha-<shortsha>` for TrueNAS installs you may want to reproduce or roll back

## What the Workflows Run

The workflows use the repository `GITHUB_TOKEN` with `contents: read`, and for the publish job also `packages: write`.

Quality gates run before publishing:

- `npm ci`
- `npm run typecheck`
- `npm run test`
- `docker build`

The publish workflow then pushes the image to:

```text
ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http
```

with OCI metadata including:

- image title
- source repository
- revision SHA

## First-Time Validation Checklist

After the first merge to `main` with the new workflow in place:

1. open the `Actions` tab and confirm `CI` passed on the pull request
2. confirm `Publish GHCR Image` ran on the merge commit in `main`
3. check the GHCR package page for fresh `latest` and `sha-<shortsha>` tags
4. pull the new SHA tag locally
5. run the image with the required environment and recheck `/healthz` and `/mcp`
6. if TrueNAS is already running the bridge, edit the installed app and switch its image to the new `sha-<shortsha>` tag

## Manual Fallback Path

If GitHub Actions is unavailable or the repository/package linkage is not ready yet, the local manual publish flow is still a supported fallback.

Choose the image coordinates and a release tag:

```bash
export IMAGE_NAME="ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http"
export IMAGE_TAG="0.1.0"
export SOURCE_REPOSITORY="https://github.com/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http"
```

Build the image:

```bash
docker build \
  --label "org.opencontainers.image.source=${SOURCE_REPOSITORY}" \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  -t "${IMAGE_NAME}:latest" \
  .
```

Authenticate to GHCR:

```bash
export CR_PAT="YOUR_GITHUB_CLASSIC_PAT"
echo "${CR_PAT}" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Push the versioned tag and `latest`:

```bash
docker push "${IMAGE_NAME}:${IMAGE_TAG}"
docker push "${IMAGE_NAME}:latest"
```

After the first push:

- confirm the package visibility in GitHub matches your intended deployment model
- if you keep the package private, TrueNAS hosts that pull it must authenticate
- if you make it public, GHCR supports anonymous pulls

## Pull and Smoke Test

Verify the published image can be pulled:

```bash
docker pull "${IMAGE_NAME}:${IMAGE_TAG}"
```

Run it locally with the required environment:

```bash
docker run --rm \
  -p 4010:4010 \
  -e PORT=4010 \
  -e MCP_BEARER_TOKEN=replace-me \
  -e VIKUNJA_URL=https://vikunja.example.internal \
  -e VIKUNJA_API_TOKEN=replace-me \
  -e VERIFY_SSL=true \
  "${IMAGE_NAME}:${IMAGE_TAG}"
```

Then check:

- `http://127.0.0.1:4010/healthz`
- `http://127.0.0.1:4010/mcp`

`/mcp` still requires the bearer token, so use the validation flow in `docs/local-testing.md`.

For repeatable local runs, the same values can also be stored in a real env file based on `.env.example`.
