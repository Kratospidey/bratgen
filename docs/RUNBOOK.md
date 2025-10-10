# Deployment Runbook

This document captures the operational requirements for running Bratgen in production. It complements the PRD by translating the infrastructure notes into concrete steps.

## Services

### Redis + BullMQ
- Provision a managed Redis 6.x instance (TLS recommended). Minimum size: 1GB memory, with persistence enabled.
- Configure `REDIS_URL` in the web app environment. Example: `redis://default:password@redis.example.com:6379`.
- Ensure the Redis security group / firewall only allows inbound traffic from application hosts.
- Monitor queue health via `/api/render` (health endpoint) or native Redis metrics (connected clients, memory usage, command latency).
- For horizontal scaling, run at least one dedicated worker process (same bundle as Next.js API) per queue to guarantee render throughput.

### S3-Compatible Storage
- Create an S3 bucket with versioning and lifecycle rules (e.g., expire render outputs after 14 days).
- Set environment variables: `BRATGEN_S3_BUCKET`, `BRATGEN_S3_REGION`, `BRATGEN_S3_ENDPOINT` (for non-AWS providers), and optional `BRATGEN_S3_FORCE_PATH_STYLE`.
- Provide IAM credentials with `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` permissions scoped to the bucket.
- Validate ffprobe/ffmpeg availability on the worker hosts. The storage layer relies on these binaries for metadata and thumbnail generation.

### Whisper (Optional)
- Enable with `BRATGEN_ENABLE_WHISPER=true`. Adjust cache TTL via `BRATGEN_WHISPER_CACHE_TTL` (seconds) depending on capacity.
- Whisper downloads ONNX models on first use; ensure the container filesystem has write access (default `~/.cache`).
- For GPU acceleration, replace the default `onnxruntime` build with a CUDA-enabled variant and set `TRANSFORMERS_CACHE` to a persistent volume.
- When Whisper is disabled, the API gracefully falls back to beat-aligned heuristics.

## Worker Processes
- The render queue uses BullMQ; run `node ./apps/web/.next/server/chunks/app/api/render/queue-worker.js` (or the equivalent compiled entry) as a background process if you split workers from the Next.js API runtime.
- Workers require access to Redis, the uploads storage path or S3 bucket, and ffmpeg/ffprobe binaries.
- Configure process supervision via systemd, PM2, or your orchestrator of choice. Restart on failure and collect stdout/stderr for observability.

## Environment Variables
```
BRATGEN_S3_BUCKET=your-bucket
BRATGEN_S3_REGION=us-east-1
BRATGEN_S3_ENDPOINT=https://s3.amazonaws.com
BRATGEN_S3_FORCE_PATH_STYLE=false
REDIS_URL=redis://user:pass@host:6379
BRATGEN_ENABLE_WHISPER=true
BRATGEN_WHISPER_CACHE_TTL=86400
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
BRATGEN_ENABLE_TELEMETRY=false
```

## Health Checks
- `/api/render` returns queue health and recent jobs. Use it for readiness probes.
- `/api/uploads` (GET) validates storage and manifest access.
- Rendered files stream via `/api/render/:id/file`; monitor response times and size headers to detect S3/local disk issues.

## Backup & Recovery
- Persist `storage/db.json` (metadata store) or migrate to a managed database for durability. Snapshot at least daily.
- For Redis, enable AOF or RDB snapshots. Restoring the queue is optional—the render job manifests can be re-queued from persisted metadata.
- Store ffmpeg logs when renders fail; they help debug codec issues or missing dependencies.

## Security
- Serve the web app behind HTTPS (e.g., Vercel, CloudFront, or Nginx reverse proxy).
- Restrict S3 buckets to least privilege, enforce IAM policies, and consider presigned URL expiration for download endpoints.
- Limit upload size at the proxy/load balancer (expect up to 200 MB per asset as per PRD).

## Observability
- Capture metrics: queue depth, worker throughput, render duration, ffmpeg error rates.
- Aggregate logs from API routes and workers. Tag render job IDs to correlate events.
- Set alerts for Redis connectivity failures, S3 upload errors, and Whisper model load failures.

## Deployment Steps
1. Build the Next.js app: `pnpm install && pnpm build`.
2. Deploy static assets + server bundle to your target environment (Vercel, container registry, etc.).
3. Provision Redis and S3, configure environment variables.
4. Run database migrations if moving away from the JSON datastore.
5. Start Next.js server (`pnpm start`) and ensure worker processes are running.
6. Perform smoke tests: upload clip, request audio analysis, align lyrics, queue render, download file.

Keep this document updated as infrastructure evolves.
