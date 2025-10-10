import { randomUUID } from "crypto";
import { mkdir } from "fs/promises";
import path from "path";
import type { StoredFileSummary } from "@/lib/uploads";
import { renderRoot } from "@/app/api/_lib/paths";
import { getRecord, listRecords, upsertRecord } from "@/app/api/_lib/datastore";
import { registerGeneratedFile } from "@/app/api/_lib/storage";

export type RenderJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface RenderJobOptions {
  resolution: "720p" | "1080p";
  aspect: "9:16" | "1:1" | "16:9";
  includeMusic: boolean;
  includeOriginal: boolean;
  musicGainDb?: number;
  duckingDb?: number;
  fadeMs?: number;
  musicAutomation?: Array<{ at: number; gainDb: number }>;
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
  attempts: number;
  output?: StoredFileSummary | null;
  error?: string | null;
  progress?: number;
}

const TABLE = "render_jobs";

async function ensureRenderDir(id: string) {
  await mkdir(path.join(renderRoot, id), { recursive: true });
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
  const id = randomUUID();
  const manifest: RenderJobManifest = {
    id,
    uploadId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "queued",
    segment,
    options,
    attempts: 0,
    output: null,
    error: null,
    progress: 0
  };
  await ensureRenderDir(id);
  await upsertRecord(TABLE, manifest);
  return manifest;
}

export async function getRenderJobManifest(id: string): Promise<RenderJobManifest | null> {
  return getRecord<RenderJobManifest>(TABLE, id);
}

export async function updateRenderJobManifest(
  id: string,
  update: Partial<Omit<RenderJobManifest, "id" | "uploadId" | "createdAt" | "segment" | "options">> &
    Partial<Pick<RenderJobManifest, "segment" | "options">>
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
    attempts: update.attempts ?? current.attempts,
    progress: update.progress ?? current.progress
  };
  await upsertRecord(TABLE, next);
  return next;
}

export async function listRenderJobs(): Promise<RenderJobManifest[]> {
  const jobs = await listRecords<RenderJobManifest>(TABLE);
  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function renderOutputPath(id: string) {
  return path.join(renderRoot, id, "output.mp4");
}

export async function persistRenderOutput({
  id,
  uploadId,
  originalName,
  mimeType,
  absolutePath
}: {
  id: string;
  uploadId: string;
  originalName: string;
  mimeType: string;
  absolutePath: string;
}): Promise<StoredFileSummary> {
  await ensureRenderDir(id);
  return registerGeneratedFile({
    absolutePath,
    uploadId,
    originalName,
    mimeType,
    scope: "render"
  });
}

export function ensureDownloadUrl(id: string) {
  return `/api/render/${id}/file`;
}
