import { NextResponse } from "next/server";
import { spotifyLinkSchema } from "@/lib/validation";
import ytDlp from "yt-dlp-exec";
import { fetchAudioAnalysisCandidates } from "@/app/api/_lib/spotify";
import type { SegmentCandidate } from "@bratgen/analysis";

export const runtime = "nodejs";

interface YtDlpSpotifyTrack {
  id: string;
  title: string;
  uploader: string;
  duration: number;
  thumbnail?: string;
  thumbnails?: Array<{ url: string }>;
  webpage_url: string;
  url?: string;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = spotifyLinkSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "invalid link" }, { status: 400 });
    }

    const { url } = parsed.data;
    const metadata = (await ytDlp(url, {
      dumpSingleJson: true,
      skipDownload: true,
      noWarnings: true,
      simulate: true
    })) as YtDlpSpotifyTrack;

    const albumArt = metadata.thumbnail ?? metadata.thumbnails?.[0]?.url ?? null;
    const targetDuration = Math.min(metadata.duration ?? 30, 30);
    let candidates: SegmentCandidate[] = [];

    try {
      candidates = await fetchAudioAnalysisCandidates(metadata.id, targetDuration);
    } catch (analysisError) {
      console.warn("spotify analysis fetch failed", analysisError);
    }

    if (!candidates.length) {
      candidates = Array.from({ length: 3 }).map((_, index) => {
        const start = Math.max(metadata.duration - targetDuration, 0) * (index / 3);
        return {
          start,
          end: start + targetDuration,
          energy: 0.5 + index * 0.1,
          loudness: -10 + index * 2,
          confidence: 0.5 + index * 0.1
        };
      });
    }

    return NextResponse.json({
      id: metadata.id,
      title: metadata.title,
      artist: metadata.uploader,
      duration: metadata.duration,
      albumArt,
      previewUrl: metadata.url ?? null,
      candidates
    });
  } catch (error) {
    console.error("spotify metadata fetch failed", error);
    return NextResponse.json({ message: "failed to fetch spotify metadata" }, { status: 500 });
  }
}
