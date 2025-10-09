import { spotifyLinkSchema } from "@/lib/validation";

export interface SpotifyMetadataResponse {
  id: string;
  title: string;
  artist: string;
  duration: number;
  albumArt: string | null;
  previewUrl: string | null;
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
