# Release and Publishing

## Goal

This document records the simplest Phase 7 release path for `vikunja-mcp-http`.

The project now ships with a `Dockerfile`, but it does not yet require a GitHub Actions workflow.
For v1, a documented manual GHCR publish flow is enough.

The Docker image shape has already been validated locally in this repo with a successful `docker build`.

## Prerequisites

Before publishing:

- Docker is installed on the machine doing the build
- the repository has a real GitHub remote
- you know the target image name, for example `ghcr.io/YOUR_GITHUB_NAMESPACE/vikunja-mcp-http`
- you have a GitHub personal access token (classic) with `write:packages`
- if the package will stay private, you also have `read:packages` available for pull validation

## Build the Image Locally

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

## Publish to GHCR

Authenticate to GitHub Container Registry:

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

## Why This Is Manual in v1

GitHub's container registry works well with automated workflows, but the project does not need a CI publishing pipeline before the first real deployment.

This manual flow keeps Phase 7 small and reviewable:

- the image format is fixed now
- the registry path is documented now
- automation can be added later without changing the container contract
