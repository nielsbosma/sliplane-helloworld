# Sliplane Hello World

[![Deploy to Sliplane](https://sliplane.opendeploy.cloud/button.svg)](https://sliplane.opendeploy.cloud/?repo=https://github.com/nielsbosma/sliplane-helloworld)

A demo app behind a single master password that exercises what [Sliplane Deployer](https://github.com/nielsbosma/sliplane-deployer) can set up: a Postgres database, an object storage bucket, an OpenAI-compatible LLM, SMTP, and a second service ([Bugsink](https://www.bugsink.com)) sharing the same database.

## What's in it

- **Items** (Postgres): add, rename, tick off and delete items, from the page or the JSON API at `/api/items`.
- **Files** (bucket): upload, download and delete files, stored in an S3-compatible bucket.
- **Ask the LLM**: sends a prompt to `<LLM_BASE_URL>/chat/completions`.
- **Send a test email** over SMTP.
- **Updates**: the page shows its version and, when a newer GitHub release exists, an "Update to version x" button. It opens the deployer's update page, where you sign in to Sliplane and confirm, and the app is redeployed with the new image.
- **Error reporting**: with `SENTRY_DSN` set to a Bugsink project's DSN, errors are reported there. The page has a button that throws one.

Migrations in [migrations/](migrations) run on every start, in order, and only once each. They are tracked in the `hello_migrations` table and guarded by an advisory lock. Add a new numbered `.sql` file to change the schema.

## Deploying

[sliplane.yaml](sliplane.yaml) asks for a master password and your email, and optionally for LLM and SMTP settings. It then creates:

- a Postgres 17 container that is only reachable over the server's private network
- a bucket with its own access key
- the app, from `ghcr.io/nielsbosma/sliplane-helloworld:<release tag>`
- Bugsink, using the same database, with you as its admin (your email and the master password)

[publish-image.yml](.github/workflows/publish-image.yml) builds and pushes the image on every GitHub release.

## Run locally

```sh
npm install
MASTER_PASSWORD=change-me DATABASE_URL=postgres://user:pass@localhost:5432/app npm start
```

| Variable                                                                             |                                                              |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `MASTER_PASSWORD`                                                                    | Required. The password that signs you in.                    |
| `DATABASE_URL`                                                                       | Required. Postgres connection string.                        |
| `SESSION_SECRET`                                                                     | Signs the session cookie. Random on each start if not set.   |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`  | Bucket for file uploads. `S3_REGION` defaults to `auto`.     |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`                                           | Any OpenAI-compatible API.                                   |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | `SMTP_SECURITY` is `starttls` (default), `tls` or `none`.    |
| `SENTRY_DSN`                                                                         | A Bugsink (or Sentry) DSN to report errors to.               |
| `APP_VERSION`                                                                        | Set in the image from the release tag.                       |
| `UPDATE_URL`                                                                         | The deployer's update link for this deployment.              |
| `PORT`                                                                               | Defaults to `3000`.                                          |

Features whose variables aren't set say so on the page instead of failing.
