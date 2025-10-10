# Bratgen Monorepo

This repository contains the Bratgen web application and supporting packages. The project uses PNPM workspaces and Next.js.

## Local Development Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy the example environment file and customize it:
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```
3. Start supporting services (see [Environment variables](#environment-variables) for options).
4. Run the web app:
   ```bash
   pnpm --filter web dev
   ```

If Redis or S3 are not available locally the app can fall back to in-memory storage for the render queue and the local `storage/` directory for artifacts. Configure credentials when you are ready to integrate with managed services.

## Environment Variables

The Next.js app loads variables from `apps/web/.env.local` when running locally and from the process environment in production. The following variables are recognized:

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | Optional (required for multi-process rendering) | Connection string for the BullMQ render queue. Example: `redis://default:password@redis.example.com:6379`. When omitted the app uses an in-memory queue, suitable for basic development but not for horizontal scaling. |
| `BRATGEN_S3_BUCKET` | Optional | Name of the bucket used to store render outputs. Leave empty to use the default local filesystem storage under `storage/`. |
| `BRATGEN_S3_REGION` | Optional | Region for the S3 bucket. |
| `BRATGEN_S3_ENDPOINT` | Optional | Custom endpoint for S3-compatible storage providers. |
| `BRATGEN_S3_FORCE_PATH_STYLE` | Optional | Set to `true` when using providers that require path-style requests. |
| `BRATGEN_ENABLE_WHISPER` | Optional | Enable Whisper-based transcription (`true`/`false`). Defaults to `false`. |
| `BRATGEN_WHISPER_CACHE_TTL` | Optional | TTL in seconds for Whisper inference caching. |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Optional | Credentials for Spotify integrations. |
| `BRATGEN_ENABLE_TELEMETRY` | Optional | Toggle telemetry collection. |

### Local Redis Options

To test queue processing with Redis locally, run a disposable container and point `REDIS_URL` to it:

```bash
docker run --rm -p 6379:6379 redis:7
```

Then edit `apps/web/.env.local`:

```
REDIS_URL=redis://127.0.0.1:6379
```

Restart the dev server after changing environment variables.

### Deployments

Production deployments should set the same variables via the hosting platform's environment configuration. Refer to [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for infrastructure recommendations (Redis sizing, S3 setup, Whisper configuration, etc.).

