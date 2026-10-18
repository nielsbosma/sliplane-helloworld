# Sliplane Hello World

[![Deploy to Sliplane](https://sliplane.opendeploy.cloud/button.svg)](https://sliplane.opendeploy.cloud/?repo=https://github.com/nielsbosma/sliplane-helloworld/sliplane.yaml)

Just the app, a database and a volume:

[![Deploy to Sliplane](https://sliplane.opendeploy.cloud/button.svg)](https://sliplane.opendeploy.cloud/?repo=https://github.com/nielsbosma/sliplane-helloworld/sliplane.minimal.yaml)

A demo app behind a single master password that exercises what [Sliplane Deployer](https://github.com/nielsbosma/sliplane-deployer) can set up: a Postgres database, an object storage bucket, a volume, an OpenAI-compatible LLM, SMTP, Composio, and a second service ([Bugsink](https://www.bugsink.com)) sharing the same database.

## What's in it

- **Items** (Postgres): add, rename, tick off and delete items, from the page or the JSON API at `/api/items`.
- **Files** (bucket): upload, download and delete files, stored in an S3-compatible bucket.
- **Disk** (volume): counts how often the app has started and keeps a note, both in files under `DATA_DIR`, so you can see them survive a redeploy.
- **Ask the LLM**: sends a prompt to `<LLM_BASE_URL>/chat/completions`.
- **Send a test email** over SMTP.
- **Agent tools**: lists the apps connected in [Composio](https://composio.dev) for `COMPOSIO_USER_ID`.
- **Updates**: the page shows its version and, when a newer GitHub release exists, an "Update to version x" button. It opens the deployer's update page, where you sign in to Sliplane and confirm, and the app is redeployed with the new image.
- **API token**: a named secret (`secrets.api_token`) that the deployer generates and shows on its done screen. Send it as `Authorization: Bearer <token>` to call `/api/*` without signing in.
- **Error reporting**: with `SENTRY_DSN` set to a Bugsink project's DSN, errors are reported there. The page has a button that throws one.

Migrations in [migrations/](migrations) run on every start, in order, and only once each. They are tracked in the `hello_migrations` table and guarded by an advisory lock. Add a new numbered `.sql` file to change the schema.

## Deploying

[sliplane.yaml](sliplane.yaml) asks for a master password and your email, and optionally for LLM, SMTP and Composio settings. It then creates:

- a managed Postgres 17 database that only accepts connections from the app's server, or, if you pick one, a Postgres you already have (one of your managed databases or a connection string). The deployer warns when it already has tables, and the Items section shows which database the app uses and any tables in it that the app didn't make.
- a bucket with its own access key
- a volume mounted at `/data`
- the app, from `ghcr.io/nielsbosma/sliplane-helloworld:<release tag>`
- Bugsink, using the same database, with you as its admin (your email and the master password)

[sliplane.minimal.yaml](sliplane.minimal.yaml) is a second spec in the same repo. It only asks for the master password and creates the database, the volume and the app; the other demos say they aren't configured. Each button links straight to its spec file, which is how one repo offers several deployments.

[publish-image.yml](.github/workflows/publish-image.yml) builds and pushes the image on every GitHub release.

## Run locally

```sh
npm install
MASTER_PASSWORD=change-me DATABASE_URL=postgres://user:pass@localhost:5432/app npm start
```

| Variable                                                                             |                                                                 |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `MASTER_PASSWORD`                                                                    | Required. The password that signs you in.                       |
| `DATABASE_URL`                                                                       | Required. Postgres connection string.                           |
| `SESSION_SECRET`                                                                     | Signs the session cookie. Random on each start if not set.      |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`  | Bucket for file uploads. `S3_REGION` defaults to `auto`.        |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`                                           | Any OpenAI-compatible API.                                      |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | `SMTP_SECURITY` is `starttls` (default), `tls` or `none`.       |
| `COMPOSIO_API_KEY`, `COMPOSIO_USER_ID`                                               | Composio project key. `COMPOSIO_USER_ID` defaults to `default`. |
| `SENTRY_DSN`                                                                         | A Bugsink (or Sentry) DSN to report errors to.                  |
| `DATA_DIR`                                                                           | A directory on a volume for the disk demo.                      |
| `APP_VERSION`                                                                        | Set in the image from the release tag.                          |
| `UPDATE_URL`                                                                         | The deployer's update link for this deployment.                 |
| `PORT`                                                                               | Defaults to `3000`.                                             |

Features whose variables aren't set say so on the page instead of failing.
