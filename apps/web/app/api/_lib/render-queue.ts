import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import { renderPreview } from "@bratgen/ffmpeg";
import {
  createRenderJobManifest,
  ensureDownloadUrl,
  getRenderJobManifest,
  persistRenderOutput,
  renderOutputPath,
  type RenderJobManifest,
  type RenderJobOptions,
  type RenderSegment,
  updateRenderJobManifest
} from "@/app/api/_lib/renders";
import { ensureLocalPath, getUpload } from "@/app/api/_lib/storage";
import type { StoredFileSummary } from "@/lib/uploads";
import { getRedis } from "@/app/api/_lib/redis";

export interface QueueRenderRequest {
  uploadId: string;
  segment: RenderSegment;
  options: RenderJobOptions;
}

export interface PublicRenderJob
  extends Omit<RenderJobManifest, "output" | "error"> {
  output: (Omit<StoredFileSummary, "path"> & { downloadUrl: string }) | null;
  error: string | null;
}

interface RenderQueueState {
  enqueue(request: QueueRenderRequest): Promise<RenderJobManifest>;
}

declare global {
  // eslint-disable-next-line no-var
  var __brat_render_queue: RenderQueueState | undefined;
}

const queueName = "bratgen:renders";

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000
  },
  removeOnComplete: 50,
  removeOnFail: 200
};

async function processManifest(manifestId: string, reportProgress?: (value: number) => void) {
  const manifest = await getRenderJobManifest(manifestId);
  if (!manifest) {
    return;
  }

  await updateRenderJobManifest(manifest.id, {
    status: "processing",
    attempts: (manifest.attempts ?? 0) + 1,
    error: null
  });

  const upload = await getUpload(manifest.uploadId);
  if (!upload) {
    await updateRenderJobManifest(manifest.id, {
      status: "failed",
      error: "upload not found"
    });
    return;
  }

  if (manifest.options.includeMusic && !upload.files.audio) {
    await updateRenderJobManifest(manifest.id, {
      status: "failed",
      error: "upload is missing an audio track for mixing"
    });
    return;
  }

  const videoPath = await ensureLocalPath(upload.files.video);
  const musicPath =
    manifest.options.includeMusic && upload.files.audio ? await ensureLocalPath(upload.files.audio) : undefined;
  const outputPath = renderOutputPath(manifest.id);
  const duration = Math.max(manifest.segment.end - manifest.segment.start, 0);

  try {
    await renderPreview({
      inputVideoPath: videoPath,
      musicPath,
      outputPath,
      muteOriginal: !manifest.options.includeOriginal,
      musicGainDb: manifest.options.musicGainDb ?? 0,
      duckingDb: manifest.options.duckingDb ?? 8,
      fadeMs: manifest.options.fadeMs ?? 250,
      startTime: manifest.segment.start,
      duration: duration > 0 ? duration : undefined,
      onProgress: (value) => reportProgress?.(value)
    });

    const outputSummary = await persistRenderOutput({
      id: manifest.id,
      uploadId: manifest.uploadId,
      originalName: `${manifest.id}.mp4`,
      mimeType: "video/mp4",
      absolutePath: outputPath
    });

    await updateRenderJobManifest(manifest.id, {
      status: "completed",
      output: outputSummary,
      error: null,
      progress: 1
    });
  } catch (error) {
    await updateRenderJobManifest(manifest.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "render failed"
    });
    throw error;
  }
}

class BullRenderQueue implements RenderQueueState {
  private queue: Queue;
  private worker: Worker;
  private events: QueueEvents;

  constructor() {
    const redis = getRedis();
    if (!redis) {
      throw new Error("redis unavailable");
    }

    this.queue = new Queue(queueName, { connection: redis, defaultJobOptions });
    this.worker = new Worker(
      queueName,
      async (job) => {
        await processManifest((job.data as { manifestId: string }).manifestId, (value) => {
          void job.updateProgress(value);
        });
      },
      { connection: redis, concurrency: 1 }
    );

    this.worker.on("failed", async (job, error) => {
      if (!job?.id) return;
      await updateRenderJobManifest(job.id, {
        status: "failed",
        error: error?.message ?? "render failed"
      });
    });

    this.worker.on("progress", async (job) => {
      if (!job.id) return;
      const progress = typeof job.progress === "number" ? job.progress : 0;
      await updateRenderJobManifest(job.id, { progress });
    });

    this.events = new QueueEvents(queueName, { connection: redis });
    void this.events.waitUntilReady();
    this.events.on("completed", async ({ jobId }) => {
      await updateRenderJobManifest(jobId, { status: "completed", progress: 1 });
    });
    this.events.on("failed", async ({ jobId, failedReason }) => {
      await updateRenderJobManifest(jobId, { status: "failed", error: failedReason });
    });
  }

  async enqueue(request: QueueRenderRequest): Promise<RenderJobManifest> {
    const manifest = await createRenderJobManifest(request);
    await this.queue.add(manifest.id, { manifestId: manifest.id }, { jobId: manifest.id });
    return manifest;
  }
}

class InMemoryRenderQueue implements RenderQueueState {
  private processing = false;
  private queue: RenderJobManifest[] = [];

  async enqueue(request: QueueRenderRequest) {
    const manifest = await createRenderJobManifest(request);
    this.queue.push(manifest);
    void this.process();
    return manifest;
  }

  private async process() {
    if (this.processing) {
      return;
    }
    this.processing = true;

    while (this.queue.length) {
      const manifest = this.queue.shift();
      if (!manifest) {
        continue;
      }
      await processManifest(manifest.id).catch((error) => {
        console.error("render job failed", manifest.id, error);
      });
    }

    this.processing = false;
  }
}

function createQueue(): RenderQueueState {
  try {
    const redis = getRedis();
    if (redis) {
      return new BullRenderQueue();
    }
  } catch (error) {
    console.warn("failed to initialize bull queue", error);
  }
  console.warn("redis unavailable, falling back to in-memory render queue");
  return new InMemoryRenderQueue();
}

export async function enqueueRenderJob(request: QueueRenderRequest) {
  const controller = (globalThis.__brat_render_queue ??= createQueue());
  return controller.enqueue(request);
}

export async function getRenderJob(id: string): Promise<PublicRenderJob | null> {
  const manifest = await getRenderJobManifest(id);
  if (!manifest) {
    return null;
  }
  const downloadUrl = manifest.output ? ensureDownloadUrl(id) : null;
  const publicOutput = manifest.output
    ? {
        originalName: manifest.output.originalName,
        checksum: manifest.output.checksum,
        mimeType: manifest.output.mimeType,
        size: manifest.output.size,
        downloadUrl: downloadUrl ?? ensureDownloadUrl(id)
      }
    : null;

  return {
    id: manifest.id,
    uploadId: manifest.uploadId,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    status: manifest.status,
    segment: manifest.segment,
    options: manifest.options,
    output: publicOutput,
    error: manifest.error ?? null,
    attempts: manifest.attempts,
    progress: manifest.progress ?? 0
  } as PublicRenderJob;
}
