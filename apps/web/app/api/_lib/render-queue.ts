import { renderPreview } from "@bratgen/ffmpeg";
import { getUpload } from "@/app/api/_lib/storage";
import type { StoredFileSummary } from "@/lib/uploads";
import {
  createRenderJobManifest,
  ensureDownloadUrl,
  getRenderJobManifest,
  renderOutputPath,
  summarizeRenderOutput,
  type RenderJobManifest,
  type RenderJobOptions,
  type RenderSegment,
  updateRenderJobManifest
} from "@/app/api/_lib/renders";

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

      await this.runJob(manifest).catch((error) => {
        console.error("render job failed", manifest.id, error);
      });
    }

    this.processing = false;
  }

  private async runJob(manifest: RenderJobManifest) {
    await updateRenderJobManifest(manifest.id, { status: "processing", error: null });
    const upload = await getUpload(manifest.uploadId);
    if (!upload) {
      await updateRenderJobManifest(manifest.id, {
        status: "failed",
        error: "upload not found"
      });
      return;
    }

    const outputPath = renderOutputPath(manifest.id);

    const duration = Math.max(manifest.segment.end - manifest.segment.start, 0);
    const musicPath = manifest.options.includeMusic ? upload.files.audio?.path : undefined;

    if (manifest.options.includeMusic && !musicPath) {
      await updateRenderJobManifest(manifest.id, {
        status: "failed",
        error: "upload is missing an audio file for mixing"
      });
      return;
    }

    try {
      await renderPreview({
        inputVideoPath: upload.files.video.path,
        musicPath,
        outputPath,
        muteOriginal: !manifest.options.includeOriginal,
        musicGainDb: manifest.options.musicGainDb ?? 0,
        startTime: manifest.segment.start,
        duration: duration > 0 ? duration : undefined
      });

      const outputSummary = await summarizeRenderOutput({
        id: manifest.id,
        originalName: `${manifest.id}.mp4`,
        mimeType: "video/mp4"
      });

      await updateRenderJobManifest(manifest.id, {
        status: "completed",
        output: outputSummary,
        error: null
      });
    } catch (error) {
      await updateRenderJobManifest(manifest.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "render failed"
      });
    }
  }
}

export async function enqueueRenderJob(request: QueueRenderRequest) {
  const queue = (globalThis.__brat_render_queue ??= new InMemoryRenderQueue());
  return queue.enqueue(request);
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
    error: manifest.error ?? null
  };
}
