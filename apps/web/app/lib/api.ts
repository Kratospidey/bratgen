import { spotifyLinkSchema } from "@/lib/validation";
import type { SegmentCandidate } from "@bratgen/analysis";

export interface SpotifyMetadataResponse {
  id: string;
  title: string;
  artist: string;
  duration: number;
  albumArt: string | null;
  previewUrl: string | null;
  candidates: SegmentCandidate[];
}

export async function fetchSpotifyMetadata(url: string): Promise<SpotifyMetadataResponse> {
  const parsed = spotifyLinkSchema.safeParse({ url });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid link");
  }

  const response = await fetch("/api/spotify/metadata", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ url })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "failed to load metadata" }));
    throw new Error(payload.message ?? "failed to load metadata");
  }

  return (await response.json()) as SpotifyMetadataResponse;
}

export type RenderResolution = "720p" | "1080p";
export type RenderAspect = "9:16" | "1:1" | "16:9";

export interface RenderJobOutput {
  originalName: string;
  checksum: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
}

export interface RenderJob {
  id: string;
  uploadId: string;
  createdAt: string;
  updatedAt: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  segment: { start: number; end: number };
  options: {
    resolution: RenderResolution;
    aspect: RenderAspect;
    includeMusic: boolean;
    includeOriginal: boolean;
    musicGainDb?: number;
    duckingDb?: number;
    fadeMs?: number;
    musicAutomation?: Array<{ at: number; gainDb: number }>;
  };
  output: RenderJobOutput | null;
  error: string | null;
  progress: number;
  attempts: number;
}

export interface RenderQueueHealth {
  redis: boolean;
  worker: {
    state: string;
    activeJobId: string | null;
    failed: number;
    waiting: number;
    completed: number;
  };
}

export interface RenderQueueSnapshot {
  jobs: RenderJob[];
  health: RenderQueueHealth | null;
}

export interface RenderRequestPayload {
  uploadId: string;
  segment: { start: number; end: number };
  options: {
    resolution: RenderResolution;
    aspect: RenderAspect;
    includeMusic: boolean;
    includeOriginal: boolean;
    musicGainDb?: number;
    duckingDb?: number;
    fadeMs?: number;
    musicAutomation?: Array<{ at: number; gainDb: number }>;
  };
}

async function handleRenderResponse(response: Response): Promise<RenderJob> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "render request failed" }));
    throw new Error(payload.message ?? "render request failed");
  }
  const payload = (await response.json()) as { job: RenderJob };
  return payload.job;
}

export async function queueRenderJob(payload: RenderRequestPayload): Promise<RenderJob> {
  const response = await fetch("/api/render", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleRenderResponse(response);
}

export async function fetchRenderJob(id: string): Promise<RenderJob> {
  const response = await fetch(`/api/render/${id}`);
  return handleRenderResponse(response);
}

export async function fetchRenderQueue(): Promise<RenderQueueSnapshot> {
  const response = await fetch("/api/render");
  if (!response.ok) {
    throw new Error("failed to fetch render queue");
  }
  const body = (await response.json()) as { jobs: RenderJob[]; health: RenderQueueHealth | null };
  return { jobs: body.jobs ?? [], health: body.health ?? null };
}

export async function cancelRenderJobRequest(id: string): Promise<RenderJob> {
  const response = await fetch(`/api/render/${id}/cancel`, { method: "POST" });
  return handleRenderResponse(response);
}

export async function retryRenderJobRequest(id: string): Promise<RenderJob> {
  const response = await fetch(`/api/render/${id}/retry`, { method: "POST" });
  return handleRenderResponse(response);
}

export interface AudioAnalysisResponse {
  id: string;
  uploadId: string;
  duration: number;
  sampleRate: number;
  waveform: number[];
  beats: number[];
  tempo: number;
  energy: number;
  chroma: number[];
  segments: SegmentCandidate[];
}

export async function analyzeAudio(payload: { uploadId: string; targetDuration?: number }): Promise<AudioAnalysisResponse> {
  const response = await fetch("/api/analyze/audio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const message = await response.json().catch(() => ({ message: "analysis failed" }));
    throw new Error(message.message ?? "analysis failed");
  }
  const body = (await response.json()) as { analysis: AudioAnalysisResponse };
  return body.analysis;
}

export interface AlignedLyric {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface AlignedLyricWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface LyricAlignmentResponse {
  lines: AlignedLyric[];
  duration: number;
  model: "beats" | "whisper";
  words: AlignedLyricWord[];
}

export async function alignLyrics(payload: { uploadId: string; lyrics: string }): Promise<LyricAlignmentResponse> {
  const response = await fetch("/api/lyrics/align", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const message = await response.json().catch(() => ({ message: "alignment failed" }));
    throw new Error(message.message ?? "alignment failed");
  }
  const body = (await response.json()) as { alignment: LyricAlignmentResponse };
  return body.alignment;
}
