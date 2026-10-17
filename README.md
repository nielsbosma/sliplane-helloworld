# Sliplane Hello World

[![Deploy to Sliplane](https://sliplane.opendeploy.cloud/button.svg)](https://sliplane.opendeploy.cloud/?repo=https://github.com/nielsbosma/sliplane-helloworld)

A minimal web app that says Hello World behind a single master password. It exists to show how a repository becomes deployable with [Sliplane Deployer](https://github.com/nielsbosma/sliplane-deployer).

## How it works

- [server.js](server.js) is a dependency-free Node server. It reads the password from `MASTER_PASSWORD`.
- [publish-image.yml](.github/workflows/publish-image.yml) builds the Docker image and pushes `ghcr.io/nielsbosma/sliplane-helloworld:<tag>` on every GitHub release.
- [sliplane.yaml](sliplane.yaml) asks the visitor for a master password (stored as a secret) and deploys the image for the latest release.

## Run locally

```sh
MASTER_PASSWORD=change-me node server.js
```

Or with Docker:

```sh
docker run -p 3000:3000 -e MASTER_PASSWORD=change-me ghcr.io/nielsbosma/sliplane-helloworld:v1.0.0
```

| Variable          |                                                                   |
| ----------------- | ----------------------------------------------------------------- |
| `MASTER_PASSWORD` | Required. The password that signs you in.                         |
| `SESSION_SECRET`  | Signs the session cookie. Random on each start if not set.        |
| `PORT`            | Defaults to `3000`.                                               |
