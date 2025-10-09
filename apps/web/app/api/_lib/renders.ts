import { createHash, randomUUID } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import type { StoredFileSummary } from "@/lib/uploads";
import { storageRoot } from "@/app/api/_lib/storage";

export type RenderJobStatus = "queued" | "processing" | "completed" | "failed";

export interface RenderJobOptions {
  resolution: "720p" | "1080p";
  aspect: "9:16" | "1:1" | "16:9";
  includeMusic: boolean;
  includeOriginal: boolean;
  musicGainDb?: number;
}

export interface RenderSegment {
  start: number;
  end: number;
}

export interface RenderJobManifest {
  id: string;
  uploadId: string;
  createdAt: string;
  updatedAt: string;
  status: RenderJobStatus;
  segment: RenderSegment;
  options: RenderJobOptions;
  output?: StoredFileSummary | null;
  error?: string | null;
}

const renderRoot = path.join(storageRoot, "renders");

let ensuredRoot = false;

async function ensureRenderRoot() {
  if (ensuredRoot) {
    return;
  }
  await mkdir(renderRoot, { recursive: true });
  ensuredRoot = true;
}

function jobDir(id: string) {
  return path.join(renderRoot, id);
}

function metaPath(id: string) {
  return path.join(jobDir(id), "meta.json");
}

export async function createRenderJobManifest({
  uploadId,
  segment,
  options
}: {
  uploadId: string;
  segment: RenderSegment;
  options: RenderJobOptions;
}): Promise<RenderJobManifest> {
  await ensureRenderRoot();
  const id = randomUUID();
  const manifest: RenderJobManifest = {
    id,
    uploadId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "queued",
    segment,
    options,
    output: null,
    error: null
  };

  await mkdir(jobDir(id), { recursive: true });
  await writeFile(metaPath(id), JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function getRenderJobManifest(id: string): Promise<RenderJobManifest | null> {
  try {
    const raw = await readFile(metaPath(id), "utf-8");
    return JSON.parse(raw) as RenderJobManifest;
  } catch (error) {
    return null;
  }
}

export type RenderJobUpdate = Partial<Pick<RenderJobManifest, "status" | "output" | "error" >>;

export async function updateRenderJobManifest(
  id: string,
  update: RenderJobUpdate
): Promise<RenderJobManifest | null> {
  const current = await getRenderJobManifest(id);
  if (!current) {
    return null;
  }

  const next: RenderJobManifest = {
    ...current,
    ...update,
    updatedAt: new Date().toISOString(),
    output: update.output ?? current.output ?? null,
    error: update.error ?? current.error ?? null,
    status: update.status ?? current.status
  };

  await writeFile(metaPath(id), JSON.stringify(next, null, 2));
  return next;
}

export function renderOutputPath(id: string) {
  return path.join(jobDir(id), "output.mp4");
}

export async function summarizeRenderOutput({
  id,
  originalName,
  mimeType
}: {
  id: string;
  originalName: string;
  mimeType: string;
}): Promise<StoredFileSummary> {
  const output = renderOutputPath(id);
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(output);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve());
    stream.on("error", (error) => reject(error));
  });
  const stats = await stat(output);
  return {
    path: output,
    size: stats.size,
    originalName,
    mimeType,
    checksum: hash.digest("hex")
  };
}

export function ensureDownloadUrl(id: string) {
  return `/api/render/${id}/file`;
}
