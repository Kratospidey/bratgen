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
  status: "queued" | "processing" | "completed" | "failed";
  segment: { start: number; end: number };
  options: {
    resolution: RenderResolution;
    aspect: RenderAspect;
    includeMusic: boolean;
    includeOriginal: boolean;
    musicGainDb?: number;
  };
  output: RenderJobOutput | null;
  error: string | null;
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
