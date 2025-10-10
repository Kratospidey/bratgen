import { cache } from "react";
import type { SegmentCandidate } from "@bratgen/analysis";

interface SpotifyAudioAnalysis {
  sections: Array<{
    start: number;
    duration: number;
    loudness: number;
    confidence: number;
  }>;
  segments: Array<{
    start: number;
    duration: number;
    loudness_max: number;
    loudness_max_time: number;
    loudness_start: number;
    confidence: number;
  }>;
}

interface SpotifyAudioFeatures {
  energy: number;
  loudness: number;
  tempo: number;
}

interface SpotifyTrackResponse {
  duration_ms: number;
}

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function requestSpotifyToken(): Promise<string | null> {
  if (!clientId || !clientSecret) {
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    console.warn("spotify token request failed", await response.text());
    return null;
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in - 60) * 1000
  };
  return cachedToken.token;
}

export const getSpotifyToken = cache(requestSpotifyToken);

async function spotifyFetch<T>(path: string): Promise<T | null> {
  const token = await getSpotifyToken();
  if (!token) {
    return null;
  }

  const response = await fetch(`https://api.spotify.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    console.warn("spotify fetch failed", path, await response.text());
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchAudioAnalysisCandidates(trackId: string, targetDuration: number): Promise<SegmentCandidate[]> {
  const analysis = await spotifyFetch<SpotifyAudioAnalysis>(`audio-analysis/${trackId}`);
  const features = await spotifyFetch<SpotifyAudioFeatures & SpotifyTrackResponse>(`audio-features/${trackId}`);

  if (!analysis || !analysis.sections?.length) {
    return [];
  }

  const sections = analysis.sections.slice().sort((a, b) => b.loudness - a.loudness);
  const candidates: SegmentCandidate[] = [];

  for (const section of sections) {
    const start = section.start;
    const end = start + Math.max(section.duration, targetDuration);
    candidates.push({
      start,
      end,
      energy: features?.energy ?? 0.6,
      loudness: section.loudness ?? features?.loudness ?? -8,
      confidence: section.confidence ?? 0.5
    });
    if (candidates.length >= 6) {
      break;
    }
  }

  if (analysis.segments?.length) {
    const loudSegments = analysis.segments
      .slice()
      .sort((a, b) => b.loudness_max - a.loudness_max)
      .slice(0, 6);

    for (const segment of loudSegments) {
      const start = segment.start;
      const end = start + Math.max(segment.duration * 4, targetDuration);
      candidates.push({
        start,
        end,
        energy: features?.energy ?? 0.6,
        loudness: segment.loudness_max ?? features?.loudness ?? -8,
        confidence: segment.confidence ?? 0.5
      });
    }
  }

  return dedupeCandidates(candidates, targetDuration);
}

function dedupeCandidates(candidates: SegmentCandidate[], targetDuration: number) {
  const seen = new Set<string>();
  const unique: SegmentCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${Math.round(candidate.start / targetDuration * 10) / 10}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}
